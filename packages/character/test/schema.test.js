import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schema, validateCharacter, parseFormula, recompute, deviations } from '../src/index.js';
import rurik from '../examples/rurik.json' with { type: 'json' };
import jotun from '../examples/jotun.json' with { type: 'json' };

const clone = (o) => structuredClone(o);

test('the schema compiles in strict mode and both examples are valid', () => {
  // validateCharacter compiles on first use and throws if the schema or an x-gurps annotation is invalid.
  assert.deepEqual(validateCharacter(rurik), { valid: true, errors: [] });
  assert.deepEqual(validateCharacter(jotun), { valid: true, errors: [] });
});

test('invalid documents are rejected with pointers and keywords', () => {
  const cases = {
    'attribute as string': [(d) => { d.attributes.st.value = '13'; }, '/attributes/st/value', 'type'],
    'unknown top-level key': [(d) => { d.Vantagem1 = 'x'; }, '', 'additionalProperties'],
    'Portuguese difficulty code': [(d) => { d.skills[0].difficulty = 'M'; }, '/skills/0/difficulty', 'enum'],
    'trait without type': [(d) => { delete d.traits[0].type; }, '/traits/0', 'required'],
    'bad dice notation': [(d) => { d.damage.swing.notation = '2 dados'; }, '/damage/swing/notation', 'pattern'],
    'non-namespaced extension': [(d) => { d.extensions = { combat: {} }; }, '/extensions', 'pattern'],
    'basic speed not in 0.25 steps': [(d) => { d.secondary.basicSpeed.value = 6.1; }, '/secondary/basicSpeed/value', 'multipleOf'],
  };
  for (const [name, [mutate, pointer, keyword]] of Object.entries(cases)) {
    const doc = clone(rurik);
    mutate(doc);
    const { valid, errors } = validateCharacter(doc);
    assert.equal(valid, false, name);
    assert.ok(errors.some((e) => e.pointer === pointer && e.keyword === keyword), `${name}: ${JSON.stringify(errors)}`);
  }
  const ok = clone(rurik);
  ok.extensions = { 'com.example.combat': { initiative: 6 } };
  assert.ok(validateCharacter(ok).valid);
});

test('every formula and bound in the schema parses', () => {
  const exprs = JSON.stringify(schema).match(/"(formula|min|max)":"(?:[^"\\]|\\.)*"/g).map((s) => Object.values(JSON.parse(`{${s}}`))[0]);
  assert.ok(exprs.length > 30);
  for (const f of exprs) assert.doesNotThrow(() => parseFormula(f), f);
});

test('derived values in the examples equal their formulas; overridable ones differ only where overridden', () => {
  const results = recompute(schema, rurik);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  assert.deepEqual(results.filter((r) => r.role === 'derived' && !same(r.stored, r.computed)).map((r) => r.pointer), []);
  assert.deepEqual(results.filter((r) => r.role === 'overridable' && !same(r.stored, r.computed)).map((r) => r.pointer),
    ['/secondary/hp/value', '/secondary/per/value']); // bought-up HP and Per (paid)
  // $ref siblings carry formulas too (damage.thrust = dice $def + its own x-gurps.formula).
  assert.deepEqual(results.filter((r) => r.pointer.startsWith('/damage')).map((r) => [r.pointer, r.computed.notation]), [['/damage/thrust', '1d'], ['/damage/swing', '2d-1']]);
  assert.deepEqual(deviations(schema, rurik), []);
  assert.deepEqual(deviations(schema, jotun).map((d) => d.pointer), ['/defenses/dodge/value']); // only the justified Dodge
});
