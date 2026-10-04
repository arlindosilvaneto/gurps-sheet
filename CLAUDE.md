# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A POC web version of the Brazilian-Portuguese GURPS 4e character sheet `Planilha Personagem Editavel v2.12 GURPS 4ed.pdf` (an Adobe LiveCycle/XFA form that only works in Adobe Reader). The web app keeps the PDF's exact layout, reproduces its point-cost/derived-stat scripts, and exports a filled PDF for game sessions. UI text is pt-BR. It is a static site with no backend; state lives in `localStorage` (key `gurps-sheet:v1`), and users can save/load `.json` files.

## Commands

```bash
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # static build -> dist/
npm test             # node:test (built-in runner; Vitest 5 needs Node 22, this targets Node 20.19+)
node --test test/rules.test.js                         # one file
node --test --test-name-pattern="skill cost" test/     # one test by name
GURPS_PDF_OUT=/tmp/out.pdf node --test test/pdf.test.js  # also write a sample export to inspect
```

Regenerate the derived assets (only needed if the source PDF or extraction logic changes):

```bash
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/extract_assets.py
```

## Architecture

The source PDF is the single source of truth for layout. `scripts/extract_assets.py` reads it once and produces committed artifacts, so the app never parses the original PDF at runtime:

- `src/labels.json`: printed label text with rects, per line and per word (targets for the help tooltips).
- `src/layout.json`: every visible form field (`id`, `page`, `x/y/w/h` in PDF points with a **top-left origin relative to the crop box**, `kind`, `align`, `size`, `print`, `tip`). Field metadata (numeric vs. text, alignment, font size, tooltip, `relevant="-print"`) comes from the XFA `<template>` packet; geometry comes from the AcroForm widgets.
- `public/template.pdf`: the original pages with widgets, annotations, XFA/AcroForm, and usage-rights signature removed (43 MB → ~75 KB).
- `public/bg/page-{1,2}.svg`: vector renders of the blank pages, used as the on-screen background.
- `public/img/`: images embedded in the PDF (GURPS logos, SJG pyramid; the pyramid is a 1-bit stencil mask converted to black-on-transparent).

At runtime the same `layout.json` drives both outputs, which keeps screen and PDF aligned:

- `src/main.js` absolutely positions one `<input>` per field over the SVG background. All geometry is in PDF points, scaled by the CSS variable `--pt` (px per pt; set by `fitToWidth()`).
- `src/pdf.js` (`buildPdf(templateBytes, layout, textFor)`) uses pdf-lib to draw each printable field's text onto `template.pdf` with Helvetica, shrinking text to fit. Coordinates go through `page.getCropBox()` because the template's crop box is offset inside its media box. WinAnsi-unencodable characters become `?`. `main.js` loads it with a dynamic `import()` because pdf-lib makes up most of the bundle.
- Help tooltips ("Ajuda imediata" toolbar toggle, saved in `localStorage` key `gurps-sheet:help`, default off). `src/help.js` holds one pt-BR message per printed title. `resolveHelp()` matches each entry to a rect in `src/labels.json`, which the extractor writes from the blank PDF's text lines and words. Use words (`w: true`) where one PDF line merges several column headers. `main.js` places a `.label-help` hotspot over each title and shows a custom tooltip instantly instead of using the native `title`. Field tooltips (XFA tips) also need the toggle, but validation errors (skill cost below minimum, over budget) always show. `test/help.test.js` fails if an entry doesn't resolve or a printed title has no help. `NOT_TITLES` lists table data and the copyright notice, which are excluded on purpose.
- `src/rules.js` is pure and DOM-free. It contains all the game math, and both the UI and the tests use it.

### Rules / state model

- `values` is a flat `{ fieldId: string }` map holding only what the user typed.
- Every attribute has a free default: ST/DX/IQ/HT default to 10 (`ATTR_DEFAULT`), and PV/Vont/Per/PF/Basic Speed/Basic Move default from them. A blank sheet is therefore a valid 0-point character. The cost field stays blank at the default and only fills in once the value differs.
- `compute(values)` returns `{ out, errors }` for every id in `COMPUTED`. `display(id, values, out)` decides what a field shows.
- Computed fields can be overridden, mirroring XFA `calculate override="warning"`. If a computed field has a non-empty user value, that value wins, and downstream rules use it through `eff()` (e.g. bought-up Per affects Per-based skills, and an overridden NH affects Parry). Clearing the field, or typing the computed value back in, restores the formula. `READ_ONLY` ids (totals, page-2 name mirror) can never be overridden.
- Field ids are the XFA names. Duplicate names keep their index (`AlcanceArma1CC[2]`). Page 2's copy of `Nome` is `Nome_p2`.
- Skill rows use hidden-in-print helper columns: `NH_Relativo_nA` (attribute ST/DX/IQ/HT/Vont/Per), `NH_Relativo_nB` (relative level), `Tipo_n` (difficulty F/M/D/MD, also E/A/H/VH; `print:false`). Parry/Block find their skill by matching the name typed in `Aparar2`/`Bloqueio2` against `Pericia1..25`.
- `Total_Pontos` is points **spent**: attributes + advantages/languages/TL/cultures + disadvantages + skills + "Outros" (`Resumo_Pontos5` on page 2). `Pontos_Gastar` is the campaign **budget** (plain input, not added to the total). When spent > budget, `Total_Pontos` gets an error highlight and a tooltip showing the overrun. This changes the original PDF, which added `Pontos_Gastar` into the total; the owner chose this meaning.

### Deliberate deviations from the original XFA scripts

**Policy (owner's decision): when the PDF's scripts diverge from the GURPS 4e Basic Set (Módulo Básico), follow the Basic Set.** Keep these fixes, and don't "restore" PDF behavior when comparing against the original:

- `Custo_PV` never computed (it assigned to `rawvalue`, lowercase).
- Hard (`D`) skills never computed a cost (it assigned to `rawValuee`). Row 6 wrote its cost into row 1, and `NH6` used row 1's level for ST.
- `Custo_Vel_Basica` was counted in both the attributes and advantages subtotals.
- Dodge used Basic Move. Per the Basic Set it now uses `floor(Basic Speed) + 3`, so buying Move does not raise Dodge.
- Damage above ST 100 was undefined/inconsistent; it now adds +1d per full 10 ST (thrust 11d, swing 13d at 100).
- Basic Lift (`ST²/10` kg, the pt-BR sheet's rule) rounds to whole kg at ≥10.
- Blank primary attributes count as 10 (free) instead of leaving everything derived blank, and their cost is blank rather than `0` at the default.
