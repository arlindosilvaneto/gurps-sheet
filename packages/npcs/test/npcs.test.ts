import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCharacter, verifyCharacter, combatStats, applyDamage, type GurpsCharacter } from '@gurps-sheet/character';
import { getNpc, listNpcs, npcsByStyle, NPC_DEFINITIONS, STYLES, type NpcDefinition } from '@gurps-sheet/npcs';
import { buildNpc, parryOf, rangeOf, weaponDamage } from '../src/build.js';

const BASIC_SET_PAGE = /^B\d+(-\d+)?$/;
const docs = new Map(NPC_DEFINITIONS.map((d) => [d.id, getNpc(d.id)] as const));
const doc = (def: NpcDefinition) => docs.get(def.id) as GurpsCharacter;
const traitLevel = (def: NpcDefinition, prefix: string) =>
  Math.max(0, ...def.traits.filter((t) => t.name.startsWith(prefix)).map((t) => Number(t.name.slice(prefix.length).trim()) || 0));

test('every adventure style has 4 to 6 NPCs, with unique ids prefixed by their style', () => {
  for (const style of STYLES) {
    const count = NPC_DEFINITIONS.filter((d) => d.style === style.id).length;
    assert.ok(count >= 4 && count <= 6, `${style.id}: ${count} NPCs`);
  }
  const ids = NPC_DEFINITIONS.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const d of NPC_DEFINITIONS) assert.ok(d.id.startsWith(`${d.style}-`), d.id);
});

test('every NPC is a valid, rules-compliant document that spends exactly its budget', () => {
  for (const def of NPC_DEFINITIONS) {
    const { character, report } = parseCharacter(JSON.stringify(doc(def))); // schema + independent rule check
    assert.deepEqual([report.rulesCompliant, report.claimConsistent, report.deviations, report.issues], [true, true, [], []], def.id);
    assert.equal(character.points.spent, def.budget, def.id);
    assert.equal(character.secondary.hp.current, character.secondary.hp.value, `${def.id}: built unhurt`);
  }
});

test('everything an NPC is made of comes from the Basic Set (each catalog entry cites its page)', () => {
  for (const def of NPC_DEFINITIONS) {
    const parts = [...def.traits, ...def.skills.map((s) => s.skill), ...def.melee ?? [], ...def.ranged ?? [], ...def.armor ?? [], ...def.gear ?? []];
    for (const p of parts) assert.match(p.reference, BASIC_SET_PAGE, `${def.id}: ${p.name}`);
    for (const w of [...def.melee ?? [], ...def.ranged ?? []]) assert.ok(w.techLevel <= def.techLevel, `${def.id}: ${w.name} is TL${w.techLevel}`);
  }
});

test('prerequisites hold: Magery level for spells, required skills and spells', () => {
  for (const def of NPC_DEFINITIONS) {
    const known = new Set(def.skills.map((s) => s.skill.name));
    for (const { skill } of def.skills) {
      const pre = skill.prereqs;
      if (!pre) continue;
      if (pre.magery) assert.ok(traitLevel(def, 'Magery') >= pre.magery, `${def.id}: ${skill.name} needs Magery ${pre.magery}`);
      for (const group of pre.anyOf ?? []) assert.ok(group.some((n) => known.has(n)), `${def.id}: ${skill.name} needs one of ${group.join(', ')}`);
    }
  }
});

test('NPCs know the skill of every weapon they carry, and defend with skills they have', () => {
  for (const def of NPC_DEFINITIONS) {
    const known = new Set(def.skills.map((s) => s.skill.name));
    for (const w of [...def.melee ?? [], ...def.ranged ?? []]) assert.ok(known.has(w.skill.name), `${def.id}: ${w.name} needs ${w.skill.name}`);
    const { parry, block } = doc(def).defenses;
    for (const d of [parry, block]) if (d.skill) assert.ok(known.has(d.skill), `${def.id}: ${d.skill}`);
  }
});

test('NH bonuses are exactly the ones the NPC\'s traits grant', () => {
  const wizard = getNpc('fantasy-court-wizard');
  const level = (d: GurpsCharacter, name: string) => d.skills.find((s) => s.name === name);
  assert.deepEqual(level(wizard, 'Fireball')?.bonuses, [{ name: 'Magery 2', amount: 2 }]);
  assert.deepEqual(level(wizard, 'Thaumatology')?.bonuses, [{ name: 'Magery 2', amount: 2 }]);
  assert.equal(level(wizard, 'Staff')?.bonuses, undefined);
  assert.deepEqual(level(getNpc('western-gunslinger'), 'Fast-Draw (Pistol)')?.bonuses, [{ name: 'Combat Reflexes', amount: 1 }]);
  assert.deepEqual(level(getNpc('western-scout'), 'Navigation (Land)')?.bonuses, [{ name: 'Absolute Direction', amount: 3 }]);
  assert.deepEqual(level(getNpc('science-fiction-ship-doctor'), 'Psychology')?.bonuses,
    [{ name: 'Healer 1', amount: 1 }, { name: 'Empathy (Sensitive)', amount: 1 }]);
  for (const def of NPC_DEFINITIONS) {
    const names = new Set(def.traits.map((t) => t.name));
    for (const s of doc(def).skills) for (const b of s.bonuses ?? []) assert.ok(names.has(b.name), `${def.id}: ${s.name} bonus from ${b.name}`);
  }
});

test('notations are structured the way the sheet editor parses them', () => {
  assert.deepEqual(weaponDamage('sw+1 cut'), { notation: 'sw+1 cut', base: 'swing', adds: 1, type: 'cut' });
  assert.deepEqual(weaponDamage('2d-1 pi+'), { notation: '2d-1 pi+', base: 'fixed', dice: 2, adds: -1, type: 'pi+' });
  assert.deepEqual(weaponDamage('3d(2) burn'), { notation: '3d(2) burn' }); // armor divisor: text only
  assert.deepEqual(parryOf('0U'), { notation: '0U', modifier: 0, unbalanced: true });
  assert.deepEqual(parryOf('0F'), { notation: '0F', modifier: 0, unbalanced: false });
  assert.deepEqual(parryOf('No'), { notation: 'No', modifier: null });
  assert.deepEqual(rangeOf('x15/x20', 11), { notation: '165/220', halfDamage: 165, max: 220 });
  assert.deepEqual(rangeOf('x3.5', 12), { notation: '42' });
});

test('the committed data/ files are exactly what the library builds', () => {
  const index = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8'));
  assert.equal(index.npcs.length, NPC_DEFINITIONS.length);
  for (const entry of index.npcs) {
    const file = JSON.parse(readFileSync(new URL(`../data/${entry.file}`, import.meta.url), 'utf8'));
    assert.deepEqual(file, getNpc(entry.id), entry.file);
  }
});

test('the API hands out copies and filters by style, threat and tags', () => {
  const a = getNpc('modern-street-thug');
  a.attributes.st.value = 99;
  assert.equal(getNpc('modern-street-thug').attributes.st.value, 11);
  assert.throws(() => getNpc('nobody'), /Unknown NPC "nobody"/);
  assert.equal(npcsByStyle('western').length, 5);
  assert.deepEqual(listNpcs({ style: 'fantasy', tag: 'spellcaster' }).map((s) => s.id), ['fantasy-court-wizard']);
  assert.ok(listNpcs({ tag: ['firearms', 'armored'] }).every((s) => s.tags.includes('firearms') && s.tags.includes('armored')));
  assert.ok(listNpcs({ threat: 'non-combatant' }).some((s) => s.tags.includes('no-weapons')));
  assert.ok(listNpcs({ tag: 'text-only-damage' }).length >= 3); // beam weapons, grenades, the wooden stake
});

test('NPCs work as engine fixtures: in-play updates keep them compliant', () => {
  for (const def of NPC_DEFINITIONS) {
    const hurt = applyDamage(doc(def), 3, { now: new Date('2026-10-05T00:00:00Z') });
    assert.equal(combatStats(hurt).hp.current, doc(def).secondary.hp.value - 3, def.id);
    assert.equal(verifyCharacter(hurt).rulesCompliant, true, def.id);
  }
  assert.throws(() => buildNpc({ ...NPC_DEFINITIONS[0] as NpcDefinition, budget: 10 }), /over its 10-point budget/);
});
