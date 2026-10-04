import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAD = 1.5; // pt of inner padding, matching the on-screen inputs
const INK = rgb(0.06, 0.12, 0.32);

/** Replaces characters Helvetica/WinAnsi cannot encode (pdf-lib throws on them). */
function encodable(font, text) {
  let safe = '';
  for (const ch of text.replace(/[−–—]/g, '-')) {
    try {
      font.encodeText(ch);
      safe += ch;
    } catch {
      safe += '?';
    }
  }
  return safe;
}

/**
 * Builds the filled sheet: draws every printable field's text onto the blank template
 * (the original PDF with its form machinery stripped), so the layout is pixel-identical.
 * @param {ArrayBuffer|Uint8Array} templateBytes public/template.pdf
 * @param {{fields: Array}} layout src/layout.json
 * @param {(id: string) => string} textFor what each field currently displays
 * @returns {Promise<Uint8Array>}
 */
export async function buildPdf(templateBytes, layout, textFor) {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const f of layout.fields) {
    if (!f.print) continue;
    const raw = String(textFor(f.id) ?? '').trim();
    if (!raw) continue;
    const text = encodable(font, raw);
    const page = pages[f.page];
    // layout.json is top-left origin relative to the crop box; PDF space is bottom-left of the media box.
    const crop = page.getCropBox();

    let size = Math.min(f.size, f.h * 0.8);
    const maxW = f.w - PAD * 2;
    let width = font.widthOfTextAtSize(text, size);
    if (width > maxW) {
      size = Math.max(4, (size * maxW) / width);
      width = font.widthOfTextAtSize(text, size);
    }
    const left = f.align === 'center' ? f.x + (f.w - width) / 2
      : f.align === 'right' ? f.x + f.w - PAD - width
        : f.x + PAD;
    const baseline = f.y + f.h / 2 + size * 0.35;
    page.drawText(text, { x: crop.x + left, y: crop.y + crop.height - baseline, size, font, color: INK });
  }

  pdf.setTitle('GURPS 4ed - Planilha de Personagem');
  pdf.setProducer('gurps-sheet');
  return pdf.save();
}
