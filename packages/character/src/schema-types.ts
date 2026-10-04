// Types of the schema itself (as opposed to the documents it describes, in character.generated.ts):
// the x-gurps annotation vocabulary (schema/x-gurps-vocabulary.schema.json) and the rule tables.

export type Role = 'input' | 'derived' | 'overridable' | 'state';
export type OverrideKind = 'paid' | 'unpaid';

/** Formulas evaluated with the value's parent object as local scope, e.g. { min: '-10 * value', max: 'value' }. */
export interface Bounds { min?: string; max?: string }

/** The `x-gurps` annotation on a schema node. */
export interface XGurps {
  role?: Role;
  override?: OverrideKind;
  formula?: string;
  bounds?: Bounds;
  unit?: 'points' | 'kg' | 'm' | 'm/s' | 'currency';
  default?: unknown;
  costPerLevel?: number;
  /** Basic Set page, e.g. "B419". */
  reference?: string;
  /** Field id(s) in the sheet editor; {n} marks row numbers. */
  sheetField?: string;
  /** Localized labels keyed by BCP 47 tag, e.g. { 'pt-BR': 'PV atual' }. */
  label?: Record<string, string>;
  description?: string;
}

/** One entry of `x-gurps-tables`. */
export interface RuleTable {
  description?: string;
  /** map: exact key. step: value of the largest key <= lookup key. */
  mode: 'map' | 'step';
  valueType?: 'number' | 'dice';
  /** map mode: key -> value; step mode: ascending [key, value] pairs. */
  entries: Record<string, unknown> | Array<[number, unknown]>;
  /** Above `from`: value(from) + floor((key - from) / every) * add (for dice, add is a dice count). */
  extrapolate?: { from: number; every: number; add: number };
}

export type RuleTables = Record<string, RuleTable>;

/** The subset of a JSON Schema node this library walks. */
export interface SchemaNode {
  $ref?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  'x-gurps'?: XGurps;
  [keyword: string]: unknown;
}

/** A gurps-character schema: the root node plus its rule tables. */
export interface CharacterSchema extends SchemaNode {
  'x-gurps-tables'?: RuleTables;
}
