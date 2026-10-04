// In-play updates for engines. What may change is decided by the schema, not by this code: every value
// annotated `x-gurps.role: "state"` is updatable (today: current HP and FP), within its `x-gurps.bounds`.
// Everything else — attributes, costs, skills, totals — is character creation, owned by the sheet editor.

import type { GurpsCharacter } from './character.generated.js';
import type { Bounds, SchemaNode } from './schema-types.js';
import { evaluate, resolveSchemaRef } from './formula.js';
import { CharacterError } from './errors.js';
import { schema } from './schemas.js';

const tables = schema['x-gurps-tables'] ?? {};

export interface UpdatableField {
  /** JSON Pointer; may contain `*` for array items. */
  readonly pointer: string;
  readonly type: string;
  readonly title: string;
  readonly description: string;
  /** Localized labels, e.g. { 'pt-BR': 'PV atual' }. */
  readonly labels: Readonly<Record<string, string>>;
  /** Formulas evaluated against the field's parent object, e.g. { min: '-10 * value', max: 'value' }. */
  readonly bounds: Readonly<Bounds>;
  readonly reference?: string | undefined;
}

function collectStateFields(): ReadonlyArray<UpdatableField> {
  const fields: UpdatableField[] = [];
  const visit = (raw: SchemaNode | undefined, pointer: string, parentTitle: string, key: string | null) => {
    const node = resolveSchemaRef(schema, raw);
    if (!node) return;
    const title = node.title ?? (parentTitle && key ? `${parentTitle} (${key})` : parentTitle);
    const meta = node['x-gurps'] ?? {};
    if (meta.role === 'state') {
      fields.push(Object.freeze({
        pointer,
        type: String(node.type),
        title,
        description: node.description ?? meta.description ?? '',
        labels: Object.freeze({ ...meta.label }),
        bounds: Object.freeze({ ...meta.bounds }),
        reference: meta.reference,
      }));
    }
    for (const [k, sub] of Object.entries(node.properties ?? {})) visit(sub, `${pointer}/${k}`, title, k);
    if (node.items) visit(node.items, `${pointer}/*`, title, null);
  };
  visit(schema, '', '', null);
  return Object.freeze(fields);
}

const UPDATABLE = collectStateFields();

/**
 * Fields an engine may update, discovered from the schema (`role: "state"`): today current HP and FP.
 * `pointer` may contain `*` for array items. `bounds` are formulas evaluated against the field's parent object.
 */
export const getUpdatableFields = (): ReadonlyArray<UpdatableField> => UPDATABLE;

const decode = (seg: string) => seg.replace(/~1/g, '/').replace(/~0/g, '~');
const segments = (pointer: string) => (pointer === '' ? [] : pointer.slice(1).split('/').map(decode));
const matches = (template: string, pointer: string) => {
  const t = segments(template);
  const p = segments(pointer);
  return t.length === p.length && t.every((seg, i) => (seg === '*' ? /^\d+$/.test(p[i] ?? '') : seg === p[i]));
};

/** Current allowed range of an updatable value in this document. */
function boundsFor(field: UpdatableField, root: unknown, owner: unknown): { min: number | null; max: number | null } {
  const ctx = { root, local: owner, tables };
  const at = (formula: string | undefined) => {
    const v = formula ? evaluate(formula, ctx) : null;
    return typeof v === 'number' ? v : null;
  };
  return { min: at(field.bounds.min), max: at(field.bounds.max) };
}

export type Changes = Record<string, number> | Array<{ pointer: string; value: number }>;

/**
 * Applies in-play changes and returns a NEW document (the input is never modified); sets meta.updatedAt.
 * Strict: any non-updatable pointer, wrong type or out-of-bounds value throws and nothing is applied.
 * @param changes e.g. { '/secondary/hp/current': 7 }
 * @throws {CharacterError} notUpdatable | invalidValue | outOfBounds
 */
export function updateCharacter(doc: GurpsCharacter, changes: Changes, { now = new Date() }: { now?: Date } = {}): GurpsCharacter {
  const entries: Array<[string, unknown]> = Array.isArray(changes) ? changes.map((c) => [c.pointer, c.value]) : Object.entries(changes ?? {});
  const next = structuredClone(doc);
  for (const [pointer, value] of entries) {
    const field = UPDATABLE.find((f) => matches(f.pointer, pointer));
    if (!field) {
      throw new CharacterError('notUpdatable', `${pointer} cannot be changed by an engine; updatable: ${UPDATABLE.map((f) => f.pointer).join(', ')}.`,
        { pointer, updatable: UPDATABLE.map((f) => f.pointer) });
    }
    const valid = field.type === 'integer' ? Number.isInteger(value) : field.type === 'number' ? Number.isFinite(value) : value !== undefined;
    if (!valid) throw new CharacterError('invalidValue', `${pointer} must be ${field.type === 'integer' ? 'an integer' : `a ${field.type}`}.`, { pointer, value, type: field.type });
    const path = segments(pointer);
    const owner = path.slice(0, -1).reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), next);
    if (!owner || typeof owner !== 'object') throw new CharacterError('invalidValue', `${pointer}: the containing object does not exist in this document.`, { pointer, value });
    const { min, max } = boundsFor(field, next, owner);
    const n = value as number;
    if ((min !== null && n < min) || (max !== null && n > max)) {
      throw new CharacterError('outOfBounds', `${pointer} must be between ${min ?? '-∞'} and ${max ?? '+∞'} (got ${n}).`, { pointer, value, min, max });
    }
    (owner as Record<string, unknown>)[path.at(-1) as string] = value;
  }
  if (entries.length) next.meta = { ...next.meta, updatedAt: now.toISOString() };
  return next;
}

// ---- Combat helpers: relative changes to the HP/FP pools, clamped to the schema bounds ----

export interface Pool { current: number; max: number }
export type PoolName = 'hp' | 'fp';

/** Current value of a pool; an absent `current` means full (unhurt / rested). */
export function getPool(doc: GurpsCharacter, pool: PoolName): Pool {
  const c = doc.secondary[pool];
  return { current: c.current ?? c.value, max: c.value };
}

function adjustPool(doc: GurpsCharacter, pool: PoolName, delta: number, opts?: { now?: Date }): GurpsCharacter {
  const pointer = `/secondary/${pool}/current`;
  const field = UPDATABLE.find((f) => f.pointer === pointer);
  if (!field) throw new Error(`The schema does not mark ${pointer} as updatable.`); // schema invariant
  const { min, max } = boundsFor(field, doc, doc.secondary[pool]);
  const target = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, getPool(doc, pool).current + delta));
  return updateCharacter(doc, { [pointer]: target }, opts);
}

const amountOf = (amount: number) => {
  if (!Number.isInteger(amount) || amount < 0) throw new CharacterError('invalidAmount', `Amount must be a non-negative integer (got ${amount}).`, { amount });
  return amount;
};

type PoolChange = (doc: GurpsCharacter, amount: number, opts?: { now?: Date }) => GurpsCharacter;

/** Removes HP (clamped at the lower bound, -10×HP). Returns a new document. */
export const applyDamage: PoolChange = (doc, amount, opts) => adjustPool(doc, 'hp', -amountOf(amount), opts);
/** Restores HP (clamped at max HP). Returns a new document. */
export const heal: PoolChange = (doc, amount, opts) => adjustPool(doc, 'hp', amountOf(amount), opts);
/** Removes FP (clamped at -1×FP; any rule consequence of going below 0 FP is the engine's call). Returns a new document. */
export const spendFatigue: PoolChange = (doc, amount, opts) => adjustPool(doc, 'fp', -amountOf(amount), opts);
/** Restores FP (clamped at max FP). Returns a new document. */
export const recoverFatigue: PoolChange = (doc, amount, opts) => adjustPool(doc, 'fp', amountOf(amount), opts);
