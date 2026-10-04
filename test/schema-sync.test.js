// The app's rules engine (src/rules.js) and the library's schema formulas encode the same rules twice.
// These tests keep them in sync; schema-only checks live in packages/character/test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schema } from '@gurps-sheet/character';
import { evaluate, recompute } from '@gurps-sheet/character/formula';
import { compute, display, damage, skillCost, num } from '../src/rules.js';

const rurik = JSON.parse(readFileSync(new URL('../packages/character/examples/rurik.json', import.meta.url)));
const tables = schema['x-gurps-tables'];

test('schema rule tables agree with the app rules engine', () => {
  for (let st = 1; st <= 135; st++) {
    const [thr, sw] = damage(st);
    assert.equal(evaluate(`lookup('thrust', ${st})`, { root: {}, tables }).notation, thr, `thrust ST ${st}`);
    assert.equal(evaluate(`lookup('swing', ${st})`, { root: {}, tables }).notation, sw, `swing ST ${st}`);
  }
  const codes = { E: 'F', A: 'M', H: 'D', VH: 'MD' };
  for (const [en, pt] of Object.entries(codes)) {
    for (let rel = -5; rel <= 8; rel++) {
      const got = evaluate(`lookup('skillCost', ${rel} + lookup('difficultyOffset', '${en}'))`, { root: {}, tables });
      assert.equal(got, skillCost(rel, pt).cost, `${en} ${rel}`);
    }
  }
});

test('the example matches what the web app computes for the same character', () => {
  const values = {
    ST: '13', DX: '12', IQ: '10', HT: '12', PV: '15', Per: '11', Pontos_Gastar: '125',
    Custo_Vantagem_1: '10', Custo_Vantagem_2: '15', Custo_lingua_1: '0', Custo_lingua_2: '1', Custo_FC1: '1', Custo_NT: '0',
    Custo_desvantagem_1: '-10', Custo_desvantagem_2: '-10', Custo_desvantagem_3: '-1',
    Pericia1: 'Machado/Maça', NH_Relativo_1A: 'DX', NH_Relativo_1B: '+1', Tipo_1: 'M',
    Pericia2: 'Escudo', NH_Relativo_2A: 'DX', NH_Relativo_2B: '+2', Tipo_2: 'F',
    Pericia3: 'Briga', NH_Relativo_3A: 'DX', NH_Relativo_3B: '0', Tipo_3: 'F',
    Pericia4: 'Observação', NH_Relativo_4A: 'Per', NH_Relativo_4B: '-1', Tipo_4: 'M',
    Aparar2: 'Machado/Maça', Bloqueio2: 'Escudo',
    'Preço1': '50', Peso1: '2', 'Preço6': '50', Peso6: '1', 'Preço16': '230', Peso16: '11,5',
    'Preço17': '60', Peso17: '7', 'Preço18': '60', Peso18: '1,5',
  };
  const { out } = compute(values);
  const shown = (id) => display(id, values, out);
  let checked = 0;
  for (const r of recompute(schema, rurik)) {
    if (!r.sheetField || !/^[\wÀ-ú-]+$/.test(r.sheetField) || !(r.sheetField in out)) continue;
    const expected = typeof r.stored === 'object' && r.stored ? r.stored.notation : r.stored;
    const app = typeof expected === 'string' ? shown(r.sheetField) : (num(shown(r.sheetField)) ?? 0);
    assert.equal(app, expected, `${r.pointer} vs app field ${r.sheetField}`);
    checked++;
  }
  for (const [id, v] of [['Custo_ST', 30], ['Custo_DX', 40], ['Custo_HT', 20], ['NH1', 13], ['NH4', 10], ['Custo_Pericia_2', 4]]) {
    assert.equal(num(shown(id)), v, id);
  }
  assert.ok(checked >= 15, `only ${checked} fields cross-checked — sheetField mapping broke?`); // includes Dano_GdP/GeB
});
