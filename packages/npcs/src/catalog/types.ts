// Shapes of the Basic Set reference catalog. Every entry carries its Basic Set page (`reference`), so an NPC
// can only be built from published material and every number can be checked against the book.

export type Attribute = 'st' | 'dx' | 'iq' | 'ht' | 'will' | 'per';
export type Difficulty = 'E' | 'A' | 'H' | 'VH';

export interface SkillDef {
  /** Full name as written on a sheet, specialty included: "Guns (Pistol)". */
  readonly name: string;
  /** Name without the specialty: "Guns". */
  readonly base: string;
  readonly specialty?: string;
  readonly attribute: Attribute;
  readonly difficulty: Difficulty;
  readonly reference: string;
  readonly kind: 'skill' | 'spell';
  /** Spells: the college (Basic Set pp. 242-253). */
  readonly college?: string;
  /** Prerequisites: Magery level and, for each entry, one of the listed skill/spell names. */
  readonly prereqs?: { readonly magery?: number; readonly anyOf?: ReadonlyArray<ReadonlyArray<string>> };
}

/** A bonus a trait adds to the level of matching skills (Combat Reflexes: +1 to every Fast-Draw). */
export interface TraitSkillBonus {
  readonly appliesTo: (skill: SkillDef) => boolean;
  readonly amount: number;
}

export type ReactionSource = 'appearance' | 'status' | 'reputation' | 'other';

export interface TraitDef {
  /** As written on a sheet, level and self-control number included: "Acute Vision 2", "Bad Temper (12)". */
  readonly name: string;
  readonly points: number;
  readonly reference: string;
  readonly skillBonuses?: ReadonlyArray<TraitSkillBonus>;
  /** Reaction modifier the trait puts on the sheet (Appearance, Status). */
  readonly reaction?: { readonly source: ReactionSource; readonly modifier: number; readonly description: string };
}

export interface MeleeWeaponDef {
  readonly name: string;
  readonly reference: string;
  readonly techLevel: number;
  readonly skill: SkillDef;
  /** One or two damage lines in Basic Set notation: ["sw+1 cut", "thr+1 cr"]. */
  readonly damage: ReadonlyArray<string>;
  readonly reach: string;
  /** "0", "-1", "+2", "0U" (unbalanced), "0F" (fencing) or "No". */
  readonly parry: string;
  /** Minimum ST ("10", "12†"); absent when the table has none. */
  readonly minST?: string;
  readonly cost: number;
  /** Pounds, as in the Basic Set tables (converted to kg on the sheet). */
  readonly weightLb: number;
}

export interface RangedWeaponDef {
  readonly name: string;
  readonly reference: string;
  readonly techLevel: number;
  readonly skill: SkillDef;
  readonly damage: string;
  readonly accuracy: string;
  /** Yards (= meters on the metric sheet): "150/1850", or ST multiples for muscle-powered weapons: "x15/x20", "x3.5". */
  readonly range: string;
  readonly rateOfFire: string;
  readonly shots: string;
  readonly minST?: string;
  readonly bulk: number | null;
  readonly recoil: number | null;
  readonly legalityClass: number | null;
  readonly cost: number;
  readonly weightLb: number;
}

export type HitLocation = 'head' | 'torso' | 'arms' | 'hands' | 'legs' | 'feet';

export interface ArmorDef {
  readonly name: string;
  readonly reference: string;
  readonly techLevel: number;
  /** DR by sheet location (head = skull; torso includes vitals, and groin where the armor covers it). */
  readonly dr: Readonly<Partial<Record<HitLocation, number>>>;
  /** Flexible armor's weakness, e.g. "(2 vs. crushing)". */
  readonly drNotes?: string;
  /** Where it is worn (equipment list). */
  readonly location: string;
  readonly cost: number;
  readonly weightLb: number;
}

export interface GearDef {
  readonly name: string;
  readonly reference: string;
  readonly techLevel: number;
  readonly cost: number;
  readonly weightLb: number;
  readonly location?: string;
}
