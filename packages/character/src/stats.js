import { getPool } from './update.js';

/**
 * Read-only combat view of a character: everything a combat engine usually needs, in one plain object.
 * A projection of stored values (no rules are re-applied: use verifyCharacter() to check them).
 */
export function combatStats(doc) {
  const s = doc.secondary;
  const skill = (k) => ({ name: k.name, level: k.level, attribute: k.attribute, difficulty: k.difficulty });
  return {
    name: doc.profile.name,
    sizeModifier: doc.profile.sizeModifier ?? 0,
    hp: getPool(doc, 'hp'),
    fp: getPool(doc, 'fp'),
    attributes: Object.fromEntries(Object.entries(doc.attributes).map(([k, a]) => [k, a.value])),
    will: s.will.value,
    perception: s.per.value,
    basicSpeed: s.basicSpeed.value,
    basicMove: s.basicMove.value,
    dodge: doc.defenses.dodge.value,
    parry: { ...doc.defenses.parry },
    block: { ...doc.defenses.block },
    damage: { thrust: { ...doc.damage.thrust }, swing: { ...doc.damage.swing } },
    encumbrance: doc.encumbrance.levels.map((l) => ({ ...l })),
    damageResistance: (doc.damageResistance ?? []).map((d) => ({ ...d })),
    skills: doc.skills.map(skill),
    weapons: { melee: structuredClone(doc.weapons?.melee ?? []), ranged: structuredClone(doc.weapons?.ranged ?? []) },
    experimental: doc.integrity?.experimental === true,
  };
}
