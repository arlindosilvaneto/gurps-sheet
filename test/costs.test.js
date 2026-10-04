import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as lib from '@gurps-sheet/character';
import { compute, costModifiers, modifiedCost, COST_MODS } from '../src/rules.js';
import { sheetDeviations } from '../src/integrity.js';
import { toCharacter, fromCharacter, checkSchema } from '../src/character.js';
import { deviations } from '@gurps-sheet/character/formula';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const layout = read('../src/layout.json');
const { schema } = lib;
const validate = (doc, labels) => checkSchema(lib, doc, labels);
const now = new Date('2026-10-04T12:00:00Z');
const costs = (values) => {
  const { out } = compute(values);
  return Object.fromEntries(['Custo_ST', 'Custo_DX', 'Custo_HT', 'Custo_PV'].map((id) => [id, out[id]]));
};

test('Size discount: -10% per +1 SM on ST and HP only, rounded up', () => {
  assert.deepEqual(costs({ ModificadorTamanho: '2', ST: '14', DX: '11', HT: '11', PV: '16' }),
    { Custo_ST: '32', Custo_DX: '20', Custo_HT: '10', Custo_PV: '4' }); // ⌈40×0.8⌉, DX/HT untouched, ⌈4×0.8⌉ = 4
  assert.deepEqual(costModifiers('ST', { ModificadorTamanho: '1' }), [{ name: 'Tamanho (MT +1)', percent: -10, source: 'size' }]);
  assert.deepEqual(costModifiers('ST', { ModificadorTamanho: '-1' }), []); // small creatures pay full price
  assert.deepEqual(costModifiers('HT', { ModificadorTamanho: '3' }), []);
});

test('custom modifiers stack with Size; the net discount is capped at 80%; selling down is unmodified', () => {
  const values = { ModificadorTamanho: '2', ST: '14', [COST_MODS]: { ST: [{ name: 'Sem Manipuladores Finos', percent: -40 }], DX: [{ name: 'Sobrenatural', percent: 50 }] }, DX: '12' };
  assert.equal(compute(values).out.Custo_ST, '16'); // ⌈40 × (1 − 0.2 − 0.4)⌉
  assert.equal(compute(values).out.Custo_DX, '60'); // 40 × 1.5
  assert.equal(compute({ ...values, ModificadorTamanho: '5' }).out.Custo_ST, '8'); // −90% → capped at −80%
  assert.equal(compute({ ModificadorTamanho: '2', ST: '8' }).out.Custo_ST, '-20');
  assert.deepEqual(modifiedCost(40, [{ percent: -20 }]), { cost: 32, netPercent: -20, multiplier: 0.8, capped: false, applies: true });
  const explained = compute(values).costs.ST;
  assert.equal(explained.rawCost, 40);
  assert.deepEqual(explained.modifiers.map((m) => m.source), ['size', 'custom']);
});

test('discounted costs are rules-compliant: no deviation in the sheet, none for the engine-side check', () => {
  const values = {
    Nome: 'Gigante', ModificadorTamanho: '2', ST: '18', PV: '22', DX: '11',
    [COST_MODS]: { ST: [{ name: 'Sem Manipuladores Finos', percent: -40 }], DX: [{ name: 'Sobrenatural', percent: 50 }] },
  };
  assert.deepEqual(sheetDeviations(values, compute(values).out), []);
  const { doc, problems } = toCharacter(values, layout, { schema, now });
  assert.deepEqual(problems, []);
  assert.deepEqual(validate(doc), { valid: true, problems: [] });
  assert.equal(doc.integrity.rulesCompliant, true);
  assert.deepEqual(doc.attributes.st.costModifiers, [{ name: 'Sem Manipuladores Finos', percent: -40 }]); // Size is derived, not stored
  assert.equal(doc.attributes.st.points, 32); // ⌈80 × 0.4⌉
  assert.deepEqual(deviations(schema, doc), []);
});

test('schema cost formulas equal the app over a grid of ST, SM and modifiers', () => {
  for (const st of [7, 10, 11, 13, 17, 25]) {
    for (const sm of [0, 1, 3, 9]) {
      for (const mods of [[], [{ name: 'L', percent: -40 }], [{ name: 'E', percent: 30 }, { name: 'L', percent: -15 }]]) {
        const values = { ST: String(st), PV: String(st + 3), ModificadorTamanho: String(sm), [COST_MODS]: mods.length ? { ST: mods, PV: mods } : undefined };
        const { doc } = toCharacter(values, layout, { schema, now });
        assert.deepEqual(deviations(schema, doc), [], `ST ${st} SM ${sm} mods ${JSON.stringify(mods)}`);
      }
    }
  }
});

test('cost modifiers survive save/load; a manual cost override is still a deviation', () => {
  const values = { ST: '13', ModificadorTamanho: '1', [COST_MODS]: { ST: [{ name: 'Sem Manipuladores Finos', percent: -40 }], Per: [{ name: 'Só visão', percent: -20 }] }, Per: '12' };
  const { doc } = toCharacter(values, layout, { schema, now });
  const back = fromCharacter(doc, layout).values;
  assert.deepEqual(back, values);
  const cheat = { ...values, Custo_ST: '1' };
  assert.deepEqual(sheetDeviations(cheat, compute(cheat).out).map((d) => d.id), ['Custo_ST']);
});
