import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { buildPdf } from '../src/pdf.js';
import { compute, display } from '../src/rules.js';

const layout = JSON.parse(readFileSync(new URL('../src/layout.json', import.meta.url)));
const template = readFileSync(new URL('../public/template.pdf', import.meta.url));

test('exports a 2-page PDF with the filled values, including non-WinAnsi characters', async () => {
  const values = {
    Nome: 'Rurik Bjørnsson ✦', ST: '13', DX: '12', IQ: '10', HT: '12',
    Pericia1: 'Machado/Maça', NH_Relativo_1A: 'DX', NH_Relativo_1B: '+1', Tipo_1: 'M',
    Anotações1: 'Texto muito longo que precisa ser reduzido para caber na linha das anotações do personagem',
  };
  const { out } = compute(values);
  const bytes = await buildPdf(template, layout, (id) => display(id, values, out));
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
  // Set GURPS_PDF_OUT=/path/file.pdf to inspect the result by eye.
  if (process.env.GURPS_PDF_OUT) writeFileSync(process.env.GURPS_PDF_OUT, bytes);
});
