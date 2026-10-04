// Public API of @gurps-sheet/character. Document types are generated from the schema (./character.d.ts).
import type { GurpsCharacter, Dice, EncumbranceLevel, DrEntry, MeleeWeapon, RangedWeapon } from './character.js';

export type * from './character.js';

// ---------------- constants ----------------
export declare const FORMAT: 'gurps-character';
/** Latest format version this library reads (it reads every 1.x up to this minor). */
export declare const LATEST_VERSION: string;
export declare const SUPPORTED_MINOR: number;
export declare const MAX_DOCUMENT_BYTES: number;
/** The JSON Schema (draft 2020-12) with x-gurps annotations and rule tables. */
export declare const schema: Record<string, unknown>;
/** Meta-schema of the x-gurps annotation vocabulary. */
export declare const vocabulary: Record<string, unknown>;

// ---------------- errors ----------------
export type CharacterErrorCode =
  | 'tooLarge' | 'invalidJson' | 'notAnObject' | 'legacyFormat' | 'wrongFormat'
  | 'unsupportedVersion' | 'newerVersion' | 'schema'
  | 'notUpdatable' | 'invalidValue' | 'outOfBounds' | 'invalidAmount';

export declare class CharacterError extends Error {
  readonly name: 'CharacterError';
  /** Stable code: switch on it, translate it. */
  readonly code: CharacterErrorCode;
  /** Data for building a localized message (e.g. { line, column } for invalidJson, { errors } for schema). */
  readonly details: Record<string, unknown>;
}

// ---------------- validation, loading, verification ----------------
export interface ValidationError {
  /** JSON Pointer of the offending value ('' = document root). */
  pointer: string;
  /** JSON Schema keyword that failed (required, type, enum, ...). */
  keyword: string;
  params: Record<string, unknown>;
  propertyName?: string;
  /** English description. */
  message: string;
}

export declare function validateCharacter(doc: unknown): { valid: boolean; errors: ValidationError[] };

export interface Deviation { pointer: string; expected: number | string | null; actual: number | string | null; justification?: string }
export interface Inconsistency { pointer: string; expected: number | string | null; actual: number | string | null }
export interface RuleIssue { code: 'overBudget'; pointer: string; message: string }

export interface VerificationReport {
  /** Recomputed from the rule formulas: no deviations, no inconsistencies, no issues. */
  rulesCompliant: boolean;
  /** Declared by the player: validations were relaxed on purpose. */
  experimental: boolean;
  /** What the file claims (null when it has no integrity block, e.g. format 1.0). */
  declaredCompliant: boolean | null;
  /** The claim matches the recomputation (true when nothing is claimed). */
  claimConsistent: boolean;
  /** Unpaid overrides: values that differ from their formula with no cost paying for it. */
  deviations: Deviation[];
  /** Derived values that don't add up: the file was edited by hand. */
  inconsistencies: Inconsistency[];
  issues: RuleIssue[];
}

/** Independent rule check; never trusts the document's own `integrity` block. */
export declare function verifyCharacter(doc: GurpsCharacter): VerificationReport;

/** Loads JSON text (or a parsed object): format, version and schema checks, plus a rule report. */
export declare function parseCharacter(input: string | unknown, opts?: { maxBytes?: number }): { character: GurpsCharacter; report: VerificationReport };
/** JSON text of a valid document (throws CharacterError 'schema' otherwise). */
export declare function serializeCharacter(doc: GurpsCharacter, opts?: { space?: number }): string;
/** Format/version check only (no schema validation). */
export declare function checkEnvelope(doc: unknown): { major: 1; minor: number };

// ---------------- in-play updates ----------------
export interface UpdatableField {
  /** JSON Pointer; may contain `*` for array items. */
  readonly pointer: string;
  readonly type: string;
  readonly title: string;
  readonly description: string;
  /** Localized labels, e.g. { 'pt-BR': 'PV atual' }. */
  readonly labels: Readonly<Record<string, string>>;
  /** Formulas evaluated against the field's parent object, e.g. { min: '-10 * value', max: 'value' }. */
  readonly bounds: Readonly<{ min?: string; max?: string }>;
  readonly reference?: string;
}

/** Fields an engine may change (schema role "state"): today current HP and FP. */
export declare function getUpdatableFields(): ReadonlyArray<UpdatableField>;

export type Changes = Record<string, number> | Array<{ pointer: string; value: number }>;

/** Applies in-play changes to a copy (all-or-nothing) and sets meta.updatedAt. */
export declare function updateCharacter(doc: GurpsCharacter, changes: Changes, opts?: { now?: Date }): GurpsCharacter;

export interface Pool { current: number; max: number }
export declare function getPool(doc: GurpsCharacter, pool: 'hp' | 'fp'): Pool;
/** Relative pool changes, clamped to the schema bounds. Each returns a new document. */
export declare function applyDamage(doc: GurpsCharacter, amount: number, opts?: { now?: Date }): GurpsCharacter;
export declare function heal(doc: GurpsCharacter, amount: number, opts?: { now?: Date }): GurpsCharacter;
export declare function spendFatigue(doc: GurpsCharacter, amount: number, opts?: { now?: Date }): GurpsCharacter;
export declare function recoverFatigue(doc: GurpsCharacter, amount: number, opts?: { now?: Date }): GurpsCharacter;

// ---------------- read-only combat view ----------------
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
  skills: Array<{ name: string; level: number; attribute: string; difficulty: string }>;
  weapons: { melee: MeleeWeapon[]; ranged: RangedWeapon[] };
  experimental: boolean;
}

/** A copy of what combat needs; mutating it never reaches the document. */
export declare function combatStats(doc: GurpsCharacter): CombatStats;

// ---------------- rule formulas (also at '@gurps-sheet/character/formula', without Ajv) ----------------
export * from './formula.js';
