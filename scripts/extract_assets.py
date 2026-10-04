"""Regenerates every derived asset from the source XFA/AcroForm PDF.

Outputs (all committed, so the web app never needs Python at runtime):
  public/template.pdf     - original pages with all form fields/XFA/annotations removed (PDF export base)
  public/bg/page-{1,2}.svg - vector render of each blank page (on-screen background)
  public/img/*.png|jpg    - images embedded in the PDF (GURPS logos, SJG pyramid)
  src/layout.json         - every visible field: id, page, rect (pt, top-left origin), kind, align, size, print, tip
  src/labels.json         - printed label text + rect per line and per word (targets for src/help.js)

Usage: python scripts/extract_assets.py ["path/to/sheet.pdf"]
"""
import json
import re
import sys
from pathlib import Path

import pymupdf
from lxml import etree

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "Planilha Personagem Editavel v2.12 GURPS 4ed.pdf"

# Screen-only/decorative widgets that make no sense outside Adobe Reader.
SKIP = {"Alerta", "ResetButton1", "Copyright"}


def xfa_template(doc):
    """Return the XFA <template> packet as an lxml tree."""
    acro = doc.xref_get_key(doc.pdf_catalog(), "AcroForm")[1]
    xfa = doc.xref_get_key(int(acro.split()[0]), "XFA")[1]
    refs = re.findall(r"\((\w+)\)\s*(\d+) 0 R", xfa)
    for name, xref in refs:
        if name == "template":
            return etree.fromstring(doc.xref_stream(int(xref)))
    raise SystemExit("XFA template packet not found")


def field_meta(tree):
    ns = tree.nsmap[None]
    q = lambda t: "{%s}%s" % (ns, t)
    meta = {}
    for f in tree.iter(q("field")):
        name = f.get("name")
        if name in meta:
            continue
        ui = f.find(q("ui"))
        font = f.find(q("font"))
        para = f.find(q("para"))
        tip = f.find(f"{q('assist')}/{q('toolTip')}")
        size = font.get("size") if font is not None else None
        meta[name] = {
            "kind": "number" if ui is not None and ui.find(q("numericEdit")) is not None else "text",
            "align": (para.get("hAlign") if para is not None else None) or "left",
            "size": float(size.rstrip("pt")) if size else 10.0,
            "print": f.get("relevant") != "-print",
            "tip": (tip.text or "").strip() if tip is not None else "",
        }
    return meta


def main():
    doc = pymupdf.open(SRC)
    meta = field_meta(xfa_template(doc))

    fields, seen = [], set()
    for page in doc:
        for w in page.widgets():
            # GURPS[0].Page1[0].AlcanceArma1CC[2] -> AlcanceArma1CC[2] ; ...Nome[0] -> Nome
            name = re.sub(r"^GURPS\[0\]\.Page\d\[0\]\.", "", w.field_name)
            name = re.sub(r"\[0\]$", "", name)
            base = re.sub(r"\[\d+\]$", "", name)
            if base in SKIP:
                continue
            fid = name if name not in seen else f"{name}_p{page.number + 1}"
            seen.add(fid)
            m = meta.get(base, {"kind": "text", "align": "left", "size": 10.0, "print": True, "tip": ""})
            r = w.rect
            fields.append({
                "id": fid, "page": page.number,
                "x": round(r.x0, 2), "y": round(r.y0, 2), "w": round(r.width, 2), "h": round(r.height, 2),
                **m,
            })

    (ROOT / "src").mkdir(exist_ok=True)
    (ROOT / "src/layout.json").write_text(json.dumps({
        "pageSize": [round(doc[0].rect.width, 2), round(doc[0].rect.height, 2)],
        "fields": fields,
    }, ensure_ascii=False, indent=1))

    # Embedded images (before stripping, xrefs are stable either way).
    img_dir = ROOT / "public/img"
    img_dir.mkdir(parents=True, exist_ok=True)
    names = {0: ["gurps-logo"], 1: ["sjg-pyramid", "gurps-logo-p2"]}
    for page in doc:
        for i, img in enumerate(page.get_images(full=True)):
            xref, smask = img[0], img[1]
            label = names.get(page.number, [])[i] if i < len(names.get(page.number, [])) else f"p{page.number}-{xref}"
            pix = pymupdf.Pixmap(doc.extract_image(xref)["image"])
            if img[4] == 1:  # 1-bit stencil mask (extracted as white ink on black): make black ink on transparent
                ink = pix.samples[:: pix.n]
                rgba = bytes(b for v in ink for b in (0, 0, 0, v))
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix.width, pix.height, rgba, True)
            pix.save(img_dir / f"{label}.png")

    # Blank template: strip widgets, leftover FreeText annots, and the XFA/AcroForm machinery.
    for page in doc:
        for w in list(page.widgets()):
            page.delete_widget(w)
        for a in list(page.annots()):
            page.delete_annot(a)
    cat = doc.pdf_catalog()
    for key in ("AcroForm", "Perms", "Names", "StructTreeRoot", "Metadata"):
        doc.xref_set_key(cat, key, "null")
    doc.set_metadata({"title": "GURPS 4ed - Planilha de Personagem", "producer": "gurps-sheet"})
    (ROOT / "public").mkdir(exist_ok=True)
    doc.save(ROOT / "public/template.pdf", garbage=4, deflate=True, clean=True)

    bg = ROOT / "public/bg"
    bg.mkdir(exist_ok=True)
    blank = pymupdf.open(ROOT / "public/template.pdf")
    for page in blank:
        (bg / f"page-{page.number + 1}.svg").write_text(page.get_svg_image(text_as_path=True))

    # Printed labels (titles/column headers), for the help-tooltip hotspots in src/help.js.
    # "words" exists because some PDF lines merge several column headers ("Tiros ST Magnitude RCO").
    r = lambda b: [round(b[0], 1), round(b[1], 1), round(b[2] - b[0], 1), round(b[3] - b[1], 1)]
    lines, words = [], []
    for page in blank:
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(s["text"] for s in line["spans"]).strip()
                if text:
                    lines.append([page.number, text, *r(line["bbox"])])
        words += [[page.number, w[4], *r(w[:4])] for w in page.get_text("words")]
    (ROOT / "src/labels.json").write_text(json.dumps({"lines": lines, "words": words}, ensure_ascii=False))

    print(f"{len(fields)} fields, {blank.page_count} pages -> src/layout.json, public/")


if __name__ == "__main__":
    main()
