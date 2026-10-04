// '@gurps-sheet/character/formula': the dependency-free rule evaluator (no Ajv).
import type { GurpsCharacter } from './character.js';

export interface DiceValue { notation: string; dice: number; adds: number }
export type FormulaValue = number | string | boolean | null | DiceValue | FormulaValue[];

/** ceil() that ignores float noise below 1e-9 (40 * 0.8 -> 32). */
export declare function roundUp(x: number): number;
/** "2d-1" -> { notation, dice, adds }, or null. */
export declare function parseDice(notation: string): DiceValue | null;
/** Parses a formula into an AST (throws SyntaxError). Exported from the package root as parseFormula. */
export declare function parse(source: string): unknown;
export { parse as parseFormula };
/** Evaluates a formula: `root` is the document (`$`), `local` the owning object, `tables` the schema's x-gurps-tables. */
export declare function evaluate(formula: string | unknown, ctx: { root: unknown; local?: unknown; tables: Record<string, unknown> }): FormulaValue;

export interface RecomputeResult {
  pointer: string;
  role: 'input' | 'derived' | 'overridable' | 'state';
  override?: 'paid' | 'unpaid';
  formula: string;
  sheetField?: string;
  stored: unknown;
  computed: FormulaValue;
}
/** Every value with a formula, stored vs. recomputed. */
export declare function recompute(schema: Record<string, unknown>, doc: GurpsCharacter): RecomputeResult[];
/** Unpaid overrides ("override") and derived values that don't add up ("inconsistent"). */
export declare function deviations(schema: Record<string, unknown>, doc: GurpsCharacter, results?: RecomputeResult[]):
  Array<{ pointer: string; reason: 'override' | 'inconsistent'; expected: unknown; actual: unknown }>;
/** Resolves a local $ref, merging sibling keywords (draft 2020-12 semantics). */
export declare function resolveSchemaRef(schema: Record<string, unknown>, node: unknown): any;
