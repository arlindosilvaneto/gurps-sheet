// The compact form NPCs are written in (src/styles/*.ts). build.ts turns a definition into a full document.
import type { ArmorDef, GearDef, MeleeWeaponDef, RangedWeaponDef, SkillDef, TraitDef } from './catalog/types.js';

export type AdventureStyle = 'fantasy' | 'swashbuckling' | 'western' | 'modern' | 'horror' | 'science-fiction';

/** How dangerous the NPC is meant to be in a fight. */
export type Threat = 'non-combatant' | 'mook' | 'standard' | 'boss';

export type Comprehension = 'none' | 'broken' | 'accented' | 'native';

export interface SkillPick { readonly skill: SkillDef; readonly relativeLevel: number }
export interface LanguagePick { readonly name: string; readonly spoken: Comprehension; readonly written: Comprehension; readonly native: boolean }

export interface NpcDefinition {
  /** Stable identifier, also the file name: "fantasy-town-guard". */
  readonly id: string;
  readonly style: AdventureStyle;
  readonly name: string;
  /** One-line role: "City watchman". */
  readonly role: string;
  readonly threat: Threat;
  /** Point budget; the NPC spends at most this much. */
  readonly budget: number;
  readonly techLevel: number;
  readonly profile?: { readonly age?: string; readonly height?: string; readonly weight?: string; readonly appearance?: string };
  readonly attributes: { readonly st: number; readonly dx: number; readonly iq: number; readonly ht: number };
  /** Bought-up (or down) secondary characteristics; the rest stay at their base value. */
  readonly secondary?: Partial<Record<'hp' | 'will' | 'per' | 'fp' | 'basicMove', number>> & { readonly basicSpeed?: number };
  readonly traits: ReadonlyArray<TraitDef>;
  readonly languages: ReadonlyArray<LanguagePick>;
  readonly skills: ReadonlyArray<SkillPick>;
  /** Skill used for Parry / Block (must be one of `skills`). */
  readonly parry?: SkillDef;
  readonly block?: SkillDef;
  readonly melee?: ReadonlyArray<MeleeWeaponDef>;
  readonly ranged?: ReadonlyArray<RangedWeaponDef>;
  readonly armor?: ReadonlyArray<ArmorDef>;
  readonly gear?: ReadonlyArray<GearDef>;
  readonly notes?: ReadonlyArray<string>;
}

/** A skill at attribute + `relativeLevel` (trait bonuses are added by the builder). */
export const learn = (skill: SkillDef, relativeLevel: number): SkillPick => ({ skill, relativeLevel });

/** The NPC's native language (free when fully literate; -3 when it can't be read). */
export const nativeLanguage = (name: string, written: Comprehension = 'native'): LanguagePick => ({ name, spoken: 'native', written, native: true });
/** An additional language (B24: 1/2/3 points per comprehension level, spoken and written separately). */
export const language = (name: string, spoken: Comprehension, written: Comprehension): LanguagePick => ({ name, spoken, written, native: false });

export const npc = (definition: NpcDefinition): NpcDefinition => Object.freeze(definition);
