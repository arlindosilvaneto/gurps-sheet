// In-play updates for engines. What may change is decided by the schema, not by this code: every value
// annotated `x-gurps.role: "state"` is updatable (today: current HP and FP), within its `x-gurps.bounds`.
// Everything else — attributes, costs, skills, totals — is character creation, owned by the sheet editor.

import schema from '../schema/gurps-character.schema.json' with { type: 'json' };
import { evaluate, resolveSchemaRef } from './formula.js';
import { CharacterError } from './errors.js';

const tables = schema['x-gurps-tables'] ?? {};

function collectStateFields() {
  const fields = [];
  const visit = (node, pointer, parentTitle, key) => {
    node = resolveSchemaRef(schema, node);
    if (!node) return;
    const title = node.title ?? (parentTitle && key ? `${parentTitle} (${key})` : parentTitle);
    const meta = node['x-gurps'] ?? {};
    if (meta.role === 'state') {
      fields.push(Object.freeze({
        pointer,
        type: node.type,
        title,
        description: node.description ?? meta.description ?? '',
        labels: Object.freeze({ ...(meta.label ?? {}) }),
        bounds: Object.freeze({ ...(meta.bounds ?? {}) }),
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
 * Fields an engine may update, discovered from the schema (`role: "state"`).
 * `pointer` may contain `*` for array items. `bounds` are formulas evaluated against the field's parent object.
 * @returns {ReadonlyArray<{ pointer: string, type: string, title: string, description: string, labels: object, bounds: { min?: string, max?: string }, reference?: string }>}
 */
export const getUpdatableFields = () => UPDATABLE;

const decode = (seg) => seg.replace(/~1/g, '/').replace(/~0/g, '~');
const segments = (pointer) => (pointer === '' ? [] : pointer.slice(1).split('/').map(decode));
const matches = (template, pointer) => {
  const t = segments(template);
  const p = segments(pointer);
  return t.length === p.length && t.every((seg, i) => seg === '*' ? /^\d+$/.test(p[i]) : seg === p[i]);
};

/** Current allowed range of an updatable value in this document. */
function boundsFor(field, root, owner) {
  const ctx = { root, local: owner, tables };
  return {
    min: field.bounds.min ? evaluate(field.bounds.min, ctx) : null,
    max: field.bounds.max ? evaluate(field.bounds.max, ctx) : null,
  };
}

/**
 * Applies in-play changes and returns a NEW document (the input is never modified); sets meta.updatedAt.
 * Strict: any non-updatable pointer, wrong type or out-of-bounds value throws and nothing is applied.
 * @param {object} doc a valid gurps-character document
 * @param {Record<string, number> | Array<{ pointer: string, value: number }>} changes e.g. { '/secondary/hp/current': 7 }
 * @param {{ now?: Date }} [opts]
 * @throws {CharacterError} notUpdatable | invalidValue | outOfBounds
 */
export function updateCharacter(doc, changes, { now = new Date() } = {}) {
  const entries = Array.isArray(changes) ? changes.map((c) => [c.pointer, c.value]) : Object.entries(changes ?? {});
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
    const owner = path.slice(0, -1).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), next);
    if (!owner || typeof owner !== 'object') throw new CharacterError('invalidValue', `${pointer}: the containing object does not exist in this document.`, { pointer, value });
    const { min, max } = boundsFor(field, next, owner);
    if ((min !== null && value < min) || (max !== null && value > max)) {
      throw new CharacterError('outOfBounds', `${pointer} must be between ${min ?? '-∞'} and ${max ?? '+∞'} (got ${value}).`, { pointer, value, min, max });
    }
    owner[path.at(-1)] = value;
  }
  if (entries.length) next.meta = { ...next.meta, updatedAt: now.toISOString() };
  return next;
}

// ---- Combat helpers: relative changes to the HP/FP pools, clamped to the schema bounds ----

/** Current value of a pool ('hp' or 'fp'); an absent `current` means full (unhurt / rested). */
export function getPool(doc, pool) {
  const c = doc.secondary[pool];
  return { current: c.current ?? c.value, max: c.value };
}

function adjustPool(doc, pool, delta, opts) {
  const pointer = `/secondary/${pool}/current`;
  const field = UPDATABLE.find((f) => f.pointer === pointer);
  const { min, max } = boundsFor(field, doc, doc.secondary[pool]);
  const target = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, getPool(doc, pool).current + delta));
  return updateCharacter(doc, { [pointer]: target }, opts);
}

const amountOf = (amount) => {
  if (!Number.isInteger(amount) || amount < 0) throw new CharacterError('invalidAmount', `Amount must be a non-negative integer (got ${amount}).`, { amount });
  return amount;
};

/** Removes HP (clamped at the lower bound, -10×HP). Returns a new document. */
export const applyDamage = (doc, amount, opts) => adjustPool(doc, 'hp', -amountOf(amount), opts);
/** Restores HP (clamped at max HP). Returns a new document. */
export const heal = (doc, amount, opts) => adjustPool(doc, 'hp', amountOf(amount), opts);
/** Removes FP (clamped at -1×FP; any rule consequence of going below 0 FP is the engine's call). Returns a new document. */
export const spendFatigue = (doc, amount, opts) => adjustPool(doc, 'fp', -amountOf(amount), opts);
/** Restores FP (clamped at max FP). Returns a new document. */
export const recoverFatigue = (doc, amount, opts) => adjustPool(doc, 'fp', amountOf(amount), opts);
