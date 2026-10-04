import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { compute } from '../src/rules.js';
import { STRICT_FIELDS, PAID_OVERRIDES, sheetDeviations, sheetIssues, sameValue, fieldLabel } from '../src/integrity.js';
import { toCharacter, fromCharacter, createValidator } from '../src/character.js';
import { deviations, recompute } from '../schema/formula.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const layout = read('../src/layout.json');
const schema = read('../schema/gurps-character.schema.json');
const validate = createValidator(Ajv2020, addFormats, schema, read('../schema/x-gurps-vocabulary.schema.json'));
const rurik = read('../schema/examples/rurik.json');
const now = new Date('2026-10-04T12:00:00Z');

const drifting = {
  Nome: 'Trapaceiro', Pontos_Gastar: '3', ST: '12', PV: '14', // spends 5: over budget
  Esquiva: '12', Aparar2: 'Espada', Aparar: '13', // rules give floor(NH 16 / 2) + 3 = 11
  Dano_GeB: '3d', Custo_ST: '0', Base_Carga: '40',
  Pericia1: 'Espada', NH_Relativo_1A: 'DX', NH_Relativo_1B: '+1', Tipo_1: 'M', NH1: '16', Custo_Pericia_1: '1',
};

test('strict fields are calculated fields without a cost formula; paid overrides and totals are excluded', () => {
  for (const id of ['Esquiva', 'Esquiva-2', 'Aparar', 'Bloqueio', 'NH1', 'Custo_Pericia_1', 'Custo_ST', 'Dano_GdP', 'Base_Carga', 'DB_Leve']) {
    assert.ok(STRICT_FIELDS.has(id), id);
  }
  for (const id of [...PAID_OVERRIDES, 'Total_Pontos', 'Resumo_Pontos1', 'Nome', 'Vantagem1']) assert.ok(!STRICT_FIELDS.has(id), id);
});

test('paid overrides in the app match the schema (override: "paid" nodes)', () => {
  const paidPointers = recompute(schema, rurik).filter((r) => r.override === 'paid').map((r) => r.pointer).sort();
  assert.deepEqual(paidPointers, ['/secondary/basicMove/value', '/secondary/basicSpeed/value', '/secondary/fp/value', '/secondary/hp/value', '/secondary/per/value', '/secondary/will/value']);
});

test('sheet deviations list only unpaid overrides that differ from the rules', () => {
  const { out } = compute(drifting);
  assert.deepEqual(sheetDeviations(drifting, out).map((d) => d.id).sort(),
    ['Aparar', 'Base_Carga', 'Custo_Pericia_1', 'Dano_GeB', 'Esquiva', 'NH1', 'Custo_ST'].sort());
  // PV 14 is bought (paid); a blank cost equals 0, so typing 0 over a default attribute cost is no drift.
  assert.ok(sameValue('Custo_IQ', '0', ''));
  assert.equal(sheetDeviations({ PV: '14', Custo_IQ: '0' }, compute({ PV: '14', Custo_IQ: '0' }).out).length, 0);
  assert.equal(fieldLabel('NH1', drifting), 'NH da perícia, linha 1 (Espada)');
  assert.equal(fieldLabel('Esquiva-2'), 'Esquiva com carga Média');
});

test('rule issues: over budget and skill below minimum', () => {
  const values = { ...drifting, Pericia2: 'Física', NH_Relativo_2A: 'IQ', NH_Relativo_2B: '-4', Tipo_2: 'D' };
  const { out, errors } = compute(values);
  assert.deepEqual(sheetIssues(values, out, errors).map((i) => i.code), ['overBudget', 'skillBelowMinimum']);
});

test('export flags deviations and issues; the engine-side check finds exactly the same deviations', () => {
  const { doc, problems } = toCharacter(drifting, layout, { schema, now, flags: { experimental: false } });
  assert.deepEqual(problems, []);
  assert.deepEqual(validate(doc), { valid: true, problems: [] });
  assert.equal(doc.integrity.experimental, false);
  assert.equal(doc.integrity.rulesCompliant, false);
  assert.deepEqual(doc.integrity.issues.map((i) => i.code), ['overBudget']);
  const reported = doc.integrity.deviations.map(({ pointer, expected, actual }) => ({ pointer, expected, actual })).sort((a, b) => a.pointer.localeCompare(b.pointer));
  const verified = deviations(schema, doc).map(({ pointer, expected, actual }) => ({ pointer, expected, actual })).sort((a, b) => a.pointer.localeCompare(b.pointer));
  assert.deepEqual(reported, verified);
  assert.deepEqual(reported.find((d) => d.pointer === '/defenses/dodge/value'), { pointer: '/defenses/dodge/value', expected: 8, actual: 12 });
  assert.deepEqual(reported.find((d) => d.pointer === '/damage/swing'), { pointer: '/damage/swing', expected: '1d+2', actual: '3d' });
  assert.ok(deviations(schema, doc).every((d) => d.reason === 'override')); // the app never writes inconsistent totals
});

test('a rules-compliant sheet exports rulesCompliant: true; experimental mode is exported and restored', () => {
  const clean = toCharacter({ ST: '12', PV: '14' }, layout, { schema, now, flags: { experimental: true } }).doc;
  assert.deepEqual(clean.integrity, { experimental: true, rulesCompliant: true, deviations: [], issues: [] });
  assert.deepEqual(fromCharacter(clean, layout).flags, { experimental: true });
});

test('hand-edited files are caught: totals by the engine check, false compliance claims on load', () => {
  const edited = structuredClone(rurik);
  edited.points.spent = 50; // inconsistent derived value
  assert.deepEqual(deviations(schema, edited).filter((d) => d.reason === 'inconsistent').map((d) => d.pointer), ['/points/spent', '/points/unspent']);

  const liar = structuredClone(rurik);
  liar.defenses.dodge.value = 14; // unpaid override, but the file still claims rulesCompliant: true
  liar.encumbrance.levels.forEach((l, i) => { l.dodge = 14 - i; });
  const { warnings } = fromCharacter(liar, layout);
  assert.deepEqual(warnings, ['O arquivo se declarava dentro das regras, mas tem 1 desvio(s): Esquiva.']);
});

test('deviations survive a save/load round trip', () => {
  const { doc } = toCharacter(drifting, layout, { schema, now });
  const { values } = fromCharacter(doc, layout);
  assert.deepEqual(sheetDeviations(values, compute(values).out).map((d) => d.id).sort(), sheetDeviations(drifting, compute(drifting).out).map((d) => d.id).sort());
});
