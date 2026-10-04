import type { Dice, DrEntry, EncumbranceLevel, GurpsCharacter, MeleeWeapon, RangedWeapon, Skill } from './character.generated.js';
import { getPool, type Pool } from './update.js';

export interface CombatStats {
  name: string;
  sizeModifier: number;
  hp: Pool;
  fp: Pool;
  attributes: { st: number; dx: number; iq: number; ht: number };
  will: number;
  perception: number;
  basicSpeed: number;
  basicMove: number;
  dodge: number;
  parry: { skill: string | null; value: number | null };
  block: { skill: string | null; value: number | null };
  damage: { thrust: Dice; swing: Dice };
  encumbrance: EncumbranceLevel[];
  damageResistance: DrEntry[];
  skills: Array<Pick<Skill, 'name' | 'level' | 'attribute' | 'difficulty'>>;
  weapons: { melee: MeleeWeapon[]; ranged: RangedWeapon[] };
  experimental: boolean;
}

/**
 * Read-only combat view of a character: everything a combat engine usually needs, in one plain object.
 * A projection of stored values (no rules are re-applied: use verifyCharacter() to check them).
 * It is a copy: mutating it never reaches the document.
 */
export function combatStats(doc: GurpsCharacter): CombatStats {
  const s = doc.secondary;
  const a = doc.attributes;
  return {
    name: doc.profile.name,
    sizeModifier: doc.profile.sizeModifier ?? 0,
    hp: getPool(doc, 'hp'),
    fp: getPool(doc, 'fp'),
    attributes: { st: a.st.value, dx: a.dx.value, iq: a.iq.value, ht: a.ht.value },
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
    skills: doc.skills.map((k) => ({ name: k.name, level: k.level, attribute: k.attribute, difficulty: k.difficulty })),
    weapons: { melee: structuredClone(doc.weapons?.melee ?? []), ranged: structuredClone(doc.weapons?.ranged ?? []) },
    experimental: doc.integrity?.experimental === true,
  };
}
