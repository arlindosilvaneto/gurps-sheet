// Regression tests for the code-review findings on rule integrity, cost modifiers and NH bonuses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as lib from '@gurps-sheet/character';
import { compute, modifiedCost, COST_MODS, SKILL_BONUSES, JUSTIFICATIONS } from '../src/rules.js';
import { toCharacter, fromCharacter, parseCharacterFile, checkSchema } from '../src/character.js';
import { deviations } from '@gurps-sheet/character/formula';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const layout = read('../src/layout.json');
const { schema } = lib;
const validate = (doc, labels) => checkSchema(lib, doc, labels);
const rurik = read('../packages/character/examples/rurik.json');
const jotun = read('../packages/character/examples/jotun.json');
const now = new Date('2026-10-04T12:00:00Z');

test('manual NH/cost or bonuses on an empty skill row block the save instead of producing a false "compliant" file', () => {
  const { problems } = toCharacter({ Custo_Pericia_7: '4', NH8: '15', [SKILL_BONUSES]: { 9: [{ name: 'Talento', amount: 1 }] } }, layout, { now, schema });
  assert.deepEqual(problems, [
    'Perícias, linha 7: há um valor manual de custo ("4") numa linha sem perícia — apague-o ou preencha a perícia.',
    'Perícias, linha 8: há um valor manual de NH ("15") numa linha sem perícia — apague-o ou preencha a perícia.',
    'Perícias, linha 9: há bônus de NH numa linha sem perícia — remova-os ou preencha a perícia.',
  ]);
});

test('integrity is built from the engine check: whatever the file reports, deviations() agrees', () => {
  const values = { ST: '12', Esquiva: '11', Custo_ST: '15', Pericia1: 'Espada', NH_Relativo_1A: 'DX', NH_Relativo_1B: '+1', Tipo_1: 'M', NH1: '16', [JUSTIFICATIONS]: { NH1: 'Arma de estimação' } };
  const { doc, problems } = toCharacter(values, layout, { now, schema });
  assert.deepEqual(problems, []);
  const pick = ({ pointer, expected, actual }) => ({ pointer, expected, actual });
  assert.deepEqual(doc.integrity.deviations.map(pick), deviations(schema, doc).map(pick));
  assert.deepEqual(doc.integrity.deviations.map((d) => [d.sheetField, d.justification ?? null]).sort(),
    [['Custo_ST', null], ['Esquiva', null], ['NH1', 'Arma de estimação']]);
});

test('pre-1.2 files with SM >= 1 get the Size discount applied, with a warning, instead of a deviation', () => {
  const old = structuredClone(rurik);
  old.formatVersion = '1.0.0';
  delete old.integrity;
  old.profile.sizeModifier = 2;
  old.points.breakdown.attributes = 99; // unchanged totals written by a 1.0 writer
  const { values, warnings } = parseCharacterFile(JSON.stringify(old), lib, layout);
  assert.equal(values.Custo_ST, undefined); // recalculated, not kept as a manual value
  assert.equal(compute(values).out.Custo_ST, '24'); // ⌈30 × 80%⌉
  assert.ok(warnings.includes('Custo de ST recalculado com o desconto de Tamanho (MT +2), regra adotada na versão 1.2 do formato: 30 → 24 pts.'), warnings.join('\n'));
  assert.ok(!warnings.some((w) => w.startsWith('Custo de PV')), 'HP: ⌈4 × 80%⌉ = 4, unchanged, so no warning');
  // A deliberate old manual cost (not the old formula's value) stays a manual value.
  old.attributes.st.points = 18;
  assert.equal(parseCharacterFile(JSON.stringify(old), lib, layout).values.Custo_ST, '18');
});

test('a file claiming compliance while over budget, or with stale totals, is called out on load', () => {
  const liar = structuredClone(rurik);
  liar.points.budget = 10;
  liar.points.unspent = -105;
  const { warnings } = fromCharacter(liar, layout);
  assert.ok(warnings.some((w) => w.startsWith('O arquivo se declarava dentro das regras, mas: Pontos gastos (115) excedem o orçamento (10)')), warnings.join('\n'));
  const stale = structuredClone(rurik);
  stale.points.spent = 50;
  assert.deepEqual(fromCharacter(stale, layout).warnings, ['Totais do arquivo diferentes dos calculados pelas regras (Total de Pontos: arquivo 50, regras 115); a ficha usa os valores calculados.']);
});

test('exactly −80% is not reported as capped', () => {
  assert.equal(modifiedCost(40, [{ percent: -80 }]).capped, false);
  assert.equal(modifiedCost(40, [{ percent: -81 }]).capped, true);
});

test('files are written at the lowest version they need', () => {
  const version = (values) => toCharacter(values, layout, { now, schema }).doc.formatVersion;
  assert.equal(version({ ST: '12' }), '1.1.0');
  assert.equal(version({ ST: '12', ModificadorTamanho: '1' }), '1.2.0'); // Size changes the ST/HP cost formulas
  assert.equal(version({ ST: '12', [COST_MODS]: { ST: [{ name: 'L', percent: -10 }] } }), '1.2.0');
  assert.equal(version({ DX: '12', Pericia1: 'Briga', NH_Relativo_1A: 'DX', NH_Relativo_1B: '0', Tipo_1: 'F', [SKILL_BONUSES]: { 1: [{ name: 'T', amount: 1 }] } }), '1.3.0');
  assert.equal(version({ Esquiva: '12', [JUSTIFICATIONS]: { Esquiva: 'x' } }), '1.3.0');
});

test('exact totals: decimals in costs, weights and "Outros" are not rounded in the file', () => {
  const { doc, problems } = toCharacter({ Armadura1: 'Corda', 'Preço16': '12,345', Peso16: '0,125', Resumo_Pontos5: '0,5' }, layout, { now, schema });
  assert.deepEqual(problems, []);
  assert.deepEqual(doc.possessionsTotal, { cost: 12.345, weight: 0.125 });
  assert.equal(doc.points.spent, 0.5);
});

test('the 1.3 example (Size, cost modifiers, NH bonus, justified deviation) is valid and round-trips', () => {
  assert.deepEqual(validate(jotun), { valid: true, problems: [] });
  assert.equal(jotun.formatVersion, '1.3.0');
  const { values, warnings, context, flags, createdAt } = fromCharacter(jotun, layout);
  assert.deepEqual(warnings, []);
  const { doc } = toCharacter(values, layout, { now: new Date(jotun.meta.updatedAt), createdAt, context, flags, generator: jotun.meta.generator, schema });
  const expected = structuredClone(jotun);
  delete expected.$schema;
  assert.deepEqual(doc, expected);
  assert.deepEqual(deviations(schema, jotun).map((d) => d.pointer), ['/defenses/dodge/value']); // only the justified Dodge
});
