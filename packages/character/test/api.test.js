import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCharacter, serializeCharacter, verifyCharacter, validateCharacter, CharacterError,
  getUpdatableFields, updateCharacter, getPool, applyDamage, heal, spendFatigue, recoverFatigue, combatStats,
  FORMAT, LATEST_VERSION,
} from '../src/index.js';
import rurik from '../examples/rurik.json' with { type: 'json' };
import jotun from '../examples/jotun.json' with { type: 'json' };

const now = new Date('2026-10-05T10:00:00Z');
const code = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof CharacterError, String(err));
    return err;
  }
  assert.fail('expected a CharacterError');
};

test('parseCharacter loads JSON text or objects and attaches an independent rule report', () => {
  const { character, report } = parseCharacter(JSON.stringify(rurik));
  assert.equal(character.profile.name, 'Rurik Bjornsson');
  assert.deepEqual(report, { rulesCompliant: true, experimental: false, declaredCompliant: true, claimConsistent: true, deviations: [], inconsistencies: [], issues: [] });
  assert.equal(parseCharacter(jotun).report.deviations[0].justification, 'Reflexos sobrenaturais concedidos por Loki (aprovado pelo mestre)');
  assert.equal(FORMAT, 'gurps-character');
  assert.equal(LATEST_VERSION, '1.3.0');
});

test('parseCharacter fails with stable codes and localizable details', () => {
  assert.deepEqual(code(() => parseCharacter('{"format":"gurps-character", ')).details, { line: 1, column: 30 }); // 29 chars, then EOF
  assert.equal(code(() => parseCharacter('{"a":')).details.truncated, true);
  assert.equal(code(() => parseCharacter(' '.repeat(11), { maxBytes: 10 })).code, 'tooLarge');
  assert.equal(code(() => parseCharacter([])).code, 'notAnObject');
  assert.equal(code(() => parseCharacter({ format: 'gurps-sheet', version: 1 })).code, 'legacyFormat');
  assert.equal(code(() => parseCharacter({ format: 'gcs' })).code, 'wrongFormat');
  assert.equal(code(() => parseCharacter({ ...rurik, formatVersion: '2.0.0' })).code, 'unsupportedVersion');
  const newer = code(() => parseCharacter({ ...rurik, formatVersion: '1.4.0' }));
  assert.deepEqual([newer.code, newer.details], ['newerVersion', { formatVersion: '1.4.0', supported: '1.3' }]);
  const bad = code(() => parseCharacter({ ...rurik, profile: { name: 7 } }));
  assert.equal(bad.code, 'schema');
  assert.deepEqual(bad.details.errors.map((e) => [e.pointer, e.keyword]), [['/profile/name', 'type']]);
});

test('verifyCharacter never trusts the file: tampered totals, false claims and overspending are reported', () => {
  const tampered = structuredClone(rurik);
  tampered.points.spent = 50; // derived value edited by hand; still claims rulesCompliant: true
  const r = verifyCharacter(tampered);
  assert.equal(r.rulesCompliant, false);
  assert.equal(r.claimConsistent, false);
  assert.deepEqual(r.inconsistencies.map((d) => d.pointer), ['/points/spent', '/points/unspent']);

  const overspent = structuredClone(rurik);
  overspent.points.budget = 100;
  overspent.points.unspent = -15;
  assert.deepEqual(verifyCharacter(overspent).issues, [{ code: 'overBudget', pointer: '/points/spent', message: 'Points spent (115) exceed the budget (100) by 15.' }]);

  const v10 = structuredClone(rurik);
  v10.formatVersion = '1.0.0';
  delete v10.integrity;
  assert.deepEqual([verifyCharacter(v10).declaredCompliant, verifyCharacter(v10).claimConsistent], [null, true]);
});

test('only schema "state" fields are updatable: current HP and FP, with formula bounds', () => {
  assert.deepEqual(getUpdatableFields().map((f) => [f.pointer, f.type, f.bounds]), [
    ['/secondary/hp/current', 'integer', { min: '-10 * value', max: 'value' }],
    ['/secondary/fp/current', 'integer', { min: '-1 * value', max: 'value' }],
  ]);
  assert.equal(getUpdatableFields()[0].title, 'Hit Points (current)');
  assert.ok(Object.isFrozen(getUpdatableFields()) && Object.isFrozen(getUpdatableFields()[0]));
});

test('updateCharacter returns a new valid document, never touches the input, and refuses anything else', () => {
  const before = JSON.stringify(rurik);
  const hurt = updateCharacter(rurik, { '/secondary/hp/current': 3, '/secondary/fp/current': 9 }, { now });
  assert.equal(JSON.stringify(rurik), before); // immutable
  assert.deepEqual([hurt.secondary.hp.current, hurt.secondary.fp.current, hurt.meta.updatedAt], [3, 9, now.toISOString()]);
  assert.deepEqual(validateCharacter(hurt), { valid: true, errors: [] });
  assert.equal(verifyCharacter(hurt).rulesCompliant, true); // in-play state never affects rule compliance
  assert.deepEqual(updateCharacter(rurik, [{ pointer: '/secondary/hp/current', value: 10 }], { now }).secondary.hp.current, 10);

  const blocked = code(() => updateCharacter(rurik, { '/attributes/st/value': 20 }));
  assert.deepEqual([blocked.code, blocked.details.updatable], ['notUpdatable', ['/secondary/hp/current', '/secondary/fp/current']]);
  assert.equal(code(() => updateCharacter(rurik, { '/secondary/hp/value': 30 })).code, 'notUpdatable'); // max HP is character creation
  assert.equal(code(() => updateCharacter(rurik, { '/secondary/hp/current': 2.5 })).code, 'invalidValue');
  const above = code(() => updateCharacter(rurik, { '/secondary/hp/current': 16 }));
  assert.deepEqual([above.code, above.details], ['outOfBounds', { pointer: '/secondary/hp/current', value: 16, min: -150, max: 15 }]);
  assert.equal(code(() => updateCharacter(rurik, { '/secondary/fp/current': -13 })).code, 'outOfBounds');
  // all-or-nothing: one bad change and nothing is applied (the input is untouched anyway)
  assert.equal(code(() => updateCharacter(rurik, { '/secondary/hp/current': 1, '/profile/name': 'x' })).code, 'notUpdatable');
});

test('combat helpers adjust the pools relative to the current value, clamped to the bounds', () => {
  const fresh = structuredClone(rurik);
  delete fresh.secondary.hp.current; // absent = unhurt
  assert.deepEqual(getPool(fresh, 'hp'), { current: 15, max: 15 });
  const hit = applyDamage(fresh, 7, { now });
  assert.equal(hit.secondary.hp.current, 8);
  assert.equal(heal(hit, 100).secondary.hp.current, 15); // capped at max
  assert.equal(applyDamage(hit, 1000).secondary.hp.current, -150); // -10 × HP: total bodily destruction
  assert.equal(spendFatigue(fresh, 30).secondary.fp.current, -12); // -1 × FP
  assert.equal(recoverFatigue(spendFatigue(fresh, 5), 2).secondary.fp.current, 9);
  assert.equal(code(() => applyDamage(fresh, -3)).code, 'invalidAmount');
  assert.equal(code(() => heal(fresh, 1.5)).code, 'invalidAmount');
});

test('combatStats gives engines one read-only view of what combat needs', () => {
  const s = combatStats(applyDamage(rurik, 4, { now }));
  assert.deepEqual({ hp: s.hp, fp: s.fp, dodge: s.dodge, parry: s.parry, block: s.block, move: s.basicMove }, {
    hp: { current: 11, max: 15 }, fp: { current: 12, max: 12 }, dodge: 9,
    parry: { skill: 'Machado/Maça', value: 9 }, block: { skill: 'Escudo', value: 10 }, move: 6,
  });
  assert.deepEqual(s.damage.swing, { notation: '2d-1', dice: 2, adds: -1 });
  assert.equal(s.encumbrance[2].dodge, 7);
  assert.deepEqual(s.skills[0], { name: 'Machado/Maça', level: 13, attribute: 'dx', difficulty: 'A' });
  s.skills[0].level = 99; // a copy: mutating it never reaches the document
  assert.equal(rurik.skills[0].level, 13);
});

test('serializeCharacter writes valid documents only', () => {
  const text = serializeCharacter(updateCharacter(rurik, { '/secondary/hp/current': 5 }, { now }));
  assert.equal(parseCharacter(text).character.secondary.hp.current, 5);
  assert.equal(code(() => serializeCharacter({ ...rurik, profile: {} })).code, 'schema');
});
