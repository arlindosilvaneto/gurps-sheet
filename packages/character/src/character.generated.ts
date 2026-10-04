// Generated from schema/gurps-character.schema.json by scripts/generate-types.mjs — do not edit by hand.
export type Comprehension = "none" | "broken" | "accented" | "native";

/**
 * Engine-neutral GURPS 4e character document. Keys are English; free-text content is in the language declared by meta.locale. Every parameter carries an `x-gurps` annotation (role, formula, unit, cost, Basic Set reference, original sheet field, localized label). Derived values are stored for convenience and can be recomputed from their formulas with the rule tables in `x-gurps-tables` (see the @gurps-sheet/character README for the expression language).
 */
export interface GurpsCharacter {
  /**
   * Optional schema URI for editor tooling.
   */
  $schema?: string;
  format: "gurps-character";
  /**
   * Semantic version of this schema the document conforms to. Minor versions only add optional properties (1.1 added `integrity`; 1.2 added `costModifiers`; 1.3 added skill `bonuses` and deviation `justification`).
   */
  formatVersion: string;
  ruleset: {
    system: "GURPS";
    edition: 4;
    /**
     * Measurement system used by every unit-bearing value (kg, m, m/s). Metric per the pt-BR Módulo Básico: Basic Lift = ST×ST/10 kg.
     */
    units: "metric";
    /**
     * Currency symbol for cost values.
     */
    currency?: string;
  };
  meta: {
    /**
     * BCP 47 language of free-text content (names, notes).
     */
    locale: string;
    createdAt?: string;
    updatedAt?: string;
    generator?: {
      name: string;
      version?: string;
    };
  };
  profile: {
    name: string;
    player?: string;
    height?: string;
    /**
     * Body weight (not carried load).
     */
    weight?: string;
    age?: string;
    sizeModifier?: number;
    /**
     * Physical description.
     */
    appearance?: string;
  };
  points: {
    /**
     * Campaign point budget set by the GM.
     */
    budget?: number | null;
    spent: number;
    unspent?: number | null;
    breakdown: {
      /**
       * Primary attributes plus secondary characteristics.
       */
      attributes: number;
      /**
       * Advantages and perks, plus languages, cultural familiarities and tech level.
       */
      advantages: number;
      disadvantages: number;
      skills: number;
      other: number;
    };
  };
  attributes: {
    st: Strength;
    dx: Dexterity;
    iq: Intelligence;
    ht: Health;
  };
  secondary: {
    hp: HitPoints;
    will: Will;
    per: Perception;
    fp: FatiguePoints;
    basicSpeed: BasicSpeed;
    basicMove: BasicMove;
  };
  encumbrance: {
    /**
     * ST×ST/10 kg, rounded to whole kg when 10 or more.
     */
    basicLift: number;
    /**
     * Encumbrance levels 0 (none) to 4 (extra-heavy), in order.
     *
     * @minItems 5
     * @maxItems 5
     */
    levels: [EncumbranceLevel, EncumbranceLevel, EncumbranceLevel, EncumbranceLevel, EncumbranceLevel];
  };
  damage: {
    thrust: Dice;
    swing: Dice1;
  };
  defenses: {
    dodge: {
      value: number;
    };
    parry: SkillDefense;
    block: SkillDefense1;
  };
  damageResistance?: DrEntry[];
  reactionModifiers?: ReactionModifier[];
  techLevel?: {
    level: number | null;
    points: number;
  };
  languages?: Language[];
  culturalFamiliarities?: NamedCost[];
  traits: Trait[];
  skills: Skill[];
  weapons?: {
    melee?: MeleeWeapon[];
    ranged?: RangedWeapon[];
  };
  equipment?: EquipmentItem[];
  possessionsTotal?: {
    cost: number;
    weight: number;
  };
  notes?: string[];
  /**
   * Self-reported rule status (since 1.1). Written by the editor, so it can be edited too: engines that need trust should verify with schema/formula.js deviations(), which recomputes every value from the rule formulas.
   */
  integrity?: {
    /**
     * Declared by the player: rule validations were intentionally relaxed (experimentation, quick game setup). Engines may sandbox or refuse such characters.
     */
    experimental: boolean;
    /**
     * True when there are no deviations and no issues.
     */
    rulesCompliant: boolean;
    /**
     * Values that differ from their rule formula without a cost paying for it (role overridable + override unpaid), e.g. a hand-edited Dodge or a discounted cost.
     */
    deviations: Deviation[];
    /**
     * Rule violations that are not single-value drift, e.g. spending more points than the budget.
     */
    issues: Issue[];
  };
  /**
   * Engine-specific data. Keys must be reverse-DNS style namespaces (e.g. "com.example.combat") so tools never collide.
   */
  extensions?: {};
}
export interface Strength {
  value: number;
  points: number;
  costModifiers?: CostModifier[];
}
/**
 * An enhancement (+) or limitation (-) on a characteristic purchase. Net modifiers never reduce a cost by more than 80%; costs round up; selling a characteristic below its base is not modified.
 */
export interface CostModifier {
  name: string;
  percent: number;
}
export interface Dexterity {
  value: number;
  points: number;
  costModifiers?: CostModifier[];
}
export interface Intelligence {
  value: number;
  points: number;
  costModifiers?: CostModifier[];
}
export interface Health {
  value: number;
  points: number;
  costModifiers?: CostModifier[];
}
export interface HitPoints {
  value: number;
  base: number;
  points: number;
  costModifiers?: CostModifier[];
  /**
   * Current HP during play; absent means unhurt (= value).
   */
  current?: number;
}
export interface Will {
  value: number;
  base: number;
  points: number;
  costModifiers?: CostModifier[];
}
export interface Perception {
  value: number;
  base: number;
  points: number;
  costModifiers?: CostModifier[];
}
export interface FatiguePoints {
  value: number;
  base: number;
  points: number;
  costModifiers?: CostModifier[];
  /**
   * Current FP during play; absent means rested (= value).
   */
  current?: number;
}
export interface BasicSpeed {
  value: number;
  base: number;
  points: number;
  costModifiers?: CostModifier[];
}
export interface BasicMove {
  value: number;
  base: number;
  points: number;
  costModifiers?: CostModifier[];
}
export interface EncumbranceLevel {
  level: number;
  id: "none" | "light" | "medium" | "heavy" | "extraHeavy";
  maxLoad: number;
  move: number;
  dodge: number;
}
/**
 * Dice expression NdM-style: `dice` six-sided dice plus `adds`.
 */
export interface Dice {
  notation: string;
  dice: number;
  adds: number;
}
/**
 * Dice expression NdM-style: `dice` six-sided dice plus `adds`.
 */
export interface Dice1 {
  notation: string;
  dice: number;
  adds: number;
}
export interface SkillDefense {
  /**
   * Name of the skill (in skills[]) this defense is based on.
   */
  skill: string | null;
  value: number | null;
}
export interface SkillDefense1 {
  /**
   * Name of the skill (in skills[]) this defense is based on.
   */
  skill: string | null;
  value: number | null;
}
export interface DrEntry {
  /**
   * Location label as written on the sheet.
   */
  location: string;
  /**
   * Normalized hit location for engines, when the label maps to one.
   */
  locationId?:
    "head" | "skull" | "face" | "eyes" | "neck" | "torso" | "vitals" | "groin" | "arms" | "hands" | "legs" | "feet";
  dr: number;
  notes?: string;
}
export interface ReactionModifier {
  source: "appearance" | "status" | "reputation" | "other";
  description: string;
  /**
   * Reaction roll modifier, when known.
   */
  modifier?: number | null;
}
export interface Language {
  name: string;
  spoken: Comprehension;
  written: Comprehension;
  points: number;
}
export interface NamedCost {
  name: string;
  points: number;
}
export interface Trait {
  name: string;
  /**
   * advantage/perk come from the sheet's Vantagens list; disadvantage/quirk from Desvantagens.
   */
  type: "advantage" | "perk" | "disadvantage" | "quirk";
  points: number;
  /**
   * Level for leveled traits, when known.
   */
  level?: number;
  notes?: string;
}
export interface Skill {
  name: string;
  attribute: "st" | "dx" | "iq" | "ht" | "will" | "per";
  /**
   * Easy, Average, Hard, Very Hard (sheet: F, M, D, MD).
   */
  difficulty: "E" | "A" | "H" | "VH";
  relativeLevel: number;
  level: number;
  bonuses?: SkillBonus[];
  points: number;
  notes?: string;
}
/**
 * A named bonus (or penalty) added to a skill's NH, e.g. Talent (B89).
 */
export interface SkillBonus {
  name: string;
  amount: number;
}
export interface MeleeWeapon {
  name: string;
  /**
   * Damage per attack mode (e.g. swing and thrust); the sheet has two damage lines per melee weapon.
   *
   * @maxItems 2
   */
  damage?: [] | [WeaponDamage] | [WeaponDamage, WeaponDamage];
  reach?: string;
  parry?: {
    notation: string;
    /**
     * Null when the weapon cannot parry.
     */
    modifier?: number | null;
    unbalanced?: boolean;
  };
  notes?: string;
  cost?: number;
  weight?: number;
}
/**
 * Damage as written, plus optional structured parts for engines.
 */
export interface WeaponDamage {
  notation: string;
  base?: "thrust" | "swing" | "fixed";
  /**
   * Dice count when base is fixed.
   */
  dice?: number;
  adds?: number;
  type?: "cr" | "cut" | "imp" | "pi-" | "pi" | "pi+" | "pi++" | "burn" | "cor" | "fat" | "tox" | "tbb" | "aff" | "spec";
}
export interface RangedWeapon {
  name: string;
  damage?: WeaponDamage;
  accuracy?: string;
  range?: {
    notation: string;
    halfDamage?: number;
    max?: number;
  };
  rateOfFire?: string;
  shots?: string;
  minST?: string;
  bulk?: number | null;
  /**
   * Null for weapons without recoil (bows, thrown).
   */
  recoil?: number | null;
  legalityClass?: number | null;
  notes?: string;
  cost?: number;
  weight?: number;
}
export interface EquipmentItem {
  name: string;
  /**
   * Where it is worn or carried (sheet: Posição).
   */
  location?: string;
  cost?: number;
  weight?: number;
  notes?: string;
}
export interface Deviation {
  /**
   * JSON Pointer to the deviating value.
   */
  pointer: string;
  /**
   * Value the rule formula gives (dice as notation).
   */
  expected: number | string | null;
  /**
   * Value stored in the document (dice as notation).
   */
  actual: number | string | null;
  /**
   * Field id in the sheet editor.
   */
  sheetField?: string;
  /**
   * Human label in meta.locale.
   */
  label?: string;
  /**
   * The player's reason for the manual value (since 1.3). Documents intent only: the sheet is still not rulesCompliant; accepting it is up to the GM or engine.
   */
  justification?: string;
}
export interface Issue {
  /**
   * overBudget: points.spent > points.budget.
   */
  code: "overBudget";
  pointer?: string;
  /**
   * Human message in meta.locale.
   */
  message: string;
}
