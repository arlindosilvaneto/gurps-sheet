import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse, evaluate, recompute } from '../schema/formula.js';
import { compute, display, damage, skillCost, num } from '../src/rules.js';
import { createValidator } from '../src/character.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const schema = read('../schema/gurps-character.schema.json');
const vocab = read('../schema/x-gurps-vocabulary.schema.json');
const rurik = read('../schema/examples/rurik.json');
const tables = schema['x-gurps-tables'];

// Same validator the app uses (strict mode; x-gurps annotations checked against the vocabulary).
const check = createValidator(Ajv2020, addFormats, schema, vocab);
const validate = (doc) => check(doc).valid;
const clone = (o) => structuredClone(o);

test('schema compiles in strict mode and its x-gurps annotations match the vocabulary', () => {
  assert.equal(typeof check, 'function'); // createValidator throws at import time if the schema or an annotation is invalid
});

test('example character is valid', () => {
  assert.deepEqual(check(rurik), { valid: true, problems: [] });
});

test('invalid documents are rejected', () => {
  const cases = {
    'attribute as string (old flat format)': (d) => { d.attributes.st.value = '13'; },
    'unknown top-level key': (d) => { d.Vantagem1 = 'coco voador'; },
    'Portuguese difficulty code': (d) => { d.skills[0].difficulty = 'M'; },
    'trait without type': (d) => { delete d.traits[0].type; },
    'bad dice notation': (d) => { d.damage.swing.notation = '2 dados'; },
    'non-namespaced extension': (d) => { d.extensions = { combat: {} }; },
    'basic speed not in 0.25 steps': (d) => { d.secondary.basicSpeed.value = 6.1; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const doc = clone(rurik);
    mutate(doc);
    assert.equal(validate(doc), false, name);
  }
  const ok = clone(rurik);
  ok.extensions = { 'com.example.combat': { initiative: 6 } };
  assert.ok(validate(ok));
});

test('every formula in the schema parses', () => {
  const formulas = JSON.stringify(schema).match(/"formula":"(?:[^"\\]|\\.)*"/g).map((s) => JSON.parse(`{${s}}`).formula);
  assert.ok(formulas.length > 30);
  for (const f of formulas) assert.doesNotThrow(() => parse(f), f);
});

test('derived values in the example equal their formulas; overridable ones differ only where overridden', () => {
  const results = recompute(schema, rurik);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const wrongDerived = results.filter((r) => r.role === 'derived' && !same(r.stored, r.computed));
  assert.deepEqual(wrongDerived.map((r) => `${r.pointer}: stored ${JSON.stringify(r.stored)} != ${JSON.stringify(r.computed)}`), []);
  const overridden = results.filter((r) => r.role === 'overridable' && !same(r.stored, r.computed)).map((r) => r.pointer);
  assert.deepEqual(overridden, ['/secondary/hp/value', '/secondary/per/value']); // bought-up HP 15 and Per 11
  // $ref siblings carry formulas too (damage.thrust = dice $def + its own x-gurps.formula).
  assert.deepEqual(results.filter((r) => r.pointer.startsWith('/damage')).map((r) => [r.pointer, r.computed.notation]), [['/damage/thrust', '1d'], ['/damage/swing', '2d-1']]);
  assert.ok(results.length > 40);
});

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
