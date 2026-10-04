// Reference evaluator for the `x-gurps.formula` expressions in gurps-character.schema.json.
// Dependency-free ES module (safe to import in any engine or browser); never uses eval().
// Grammar and semantics: see the package README.

import type { GurpsCharacter } from './character.generated.js';
import type { CharacterSchema, OverrideKind, Role, RuleTables, SchemaNode } from './schema-types.js';

export interface DiceValue { notation: string; dice: number; adds: number }
export type FormulaValue = number | string | boolean | null | DiceValue | FormulaValue[];
/** How a value is reported (dice as their notation). Formula results stored in documents are numbers, strings, dice or null. */
export type Scalar = number | string | null;

const DICE = /^(\d+)d([+-]\d+)?$/;

/** ceil() that ignores float noise below 1e-9 (40 * 0.8 -> 32, not 33). Shared with the app's rules engine. */
export const roundUp = (x: number): number => Math.ceil(x - 1e-9);

/** Parses "2d-1" -> { notation, dice, adds }; null if not dice notation. */
export function parseDice(notation: unknown): DiceValue | null {
  const m = DICE.exec(String(notation ?? '').trim());
  return m ? makeDice(Number(m[1]), Number(m[2] ?? 0)) : null;
}

function makeDice(dice: number, adds: number): DiceValue {
  return { notation: `${dice}d${adds > 0 ? `+${adds}` : adds < 0 ? adds : ''}`, dice, adds };
}

/** Property of an object-ish value, or undefined. */
const get = (o: unknown, key: string): unknown => (o as Record<string, unknown> | null | undefined)?.[key];

// ---------------- Tokenizer ----------------
type Token = { t: 'num'; v: number } | { t: 'str' | 'id' | 'op'; v: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|'([^']*)'|(\$|[A-Za-z_][A-Za-z0-9_]*)|(<=|>=|==|!=|[-+*/(),.<>[\]=|]))/y;
  let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) throw new SyntaxError(`Unexpected character at ${pos} in: ${src}`);
    pos = re.lastIndex;
    if (m[1] !== undefined) tokens.push({ t: 'num', v: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ t: 'str', v: m[2] });
    else if (m[3] !== undefined) tokens.push({ t: 'id', v: m[3] });
    else tokens.push({ t: 'op', v: m[4] as string });
  }
  return tokens;
}

// ---------------- Parser (recursive descent -> AST) ----------------
type PathStep = { field: string } | { filter: { field: string; values: string[]; neg: boolean } };

/** AST produced by parse(). */
export type FormulaNode =
  | { k: 'lit'; v: number | string }
  | { k: 'neg'; arg: FormulaNode }
  | { k: 'bin'; op: string; left: FormulaNode; right: FormulaNode }
  | { k: 'call'; name: string; args: FormulaNode[] }
  | { k: 'path'; root: boolean; head: string | null; steps: PathStep[] };

/** Parses a formula into an AST (throws SyntaxError). Exported from the package root as parseFormula. */
export function parse(src: string): FormulaNode {
  const tk = tokenize(src);
  let i = 0;
  const peek = (v: string) => tk[i]?.t === 'op' && tk[i]?.v === v;
  const expect = (v: string) => {
    if (!peek(v)) throw new SyntaxError(`Expected "${v}" in: ${src}`);
    i++;
  };
  /** Consumes a token; a missing one is a syntax error. */
  const next = (): Token => {
    const t = tk[i++];
    if (!t) throw new SyntaxError(`Unexpected end of: ${src}`);
    return t;
  };

  const expr = (): FormulaNode => compare();
  function compare(): FormulaNode {
    const left = additive();
    for (const op of ['<=', '>=', '==', '!=', '<', '>']) {
      if (peek(op)) {
        i++;
        return { k: 'bin', op, left, right: additive() };
      }
    }
    return left;
  }
  function additive(): FormulaNode {
    let left = multiplicative();
    while (peek('+') || peek('-')) left = { k: 'bin', op: String(next().v), left, right: multiplicative() };
    return left;
  }
  function multiplicative(): FormulaNode {
    let left = unary();
    while (peek('*') || peek('/')) left = { k: 'bin', op: String(next().v), left, right: unary() };
    return left;
  }
  function unary(): FormulaNode {
    if (peek('-')) {
      i++;
      return { k: 'neg', arg: unary() };
    }
    return primary();
  }
  function primary(): FormulaNode {
    const t = tk[i];
    if (!t) throw new SyntaxError(`Unexpected end of: ${src}`);
    if (t.t === 'num' || t.t === 'str') {
      i++;
      return { k: 'lit', v: t.v };
    }
    if (peek('(')) {
      i++;
      const e = expr();
      expect(')');
      return e;
    }
    if (t.t === 'id') {
      i++;
      if (t.v !== '$' && peek('(')) {
        i++;
        const args: FormulaNode[] = [];
        if (!peek(')')) {
          do args.push(expr());
          while (peek(',') && ++i);
        }
        expect(')');
        return { k: 'call', name: t.v, args };
      }
      const steps: PathStep[] = [];
      while (peek('.') || peek('[')) {
        if (next().v === '.') {
          const id = tk[i++];
          if (!id || id.t !== 'id') throw new SyntaxError(`Expected name after "." in: ${src}`);
          steps.push({ field: id.v });
        } else {
          const field = String(next().v);
          const neg = peek('!=');
          if (!peek('=') && !neg) throw new SyntaxError(`Expected "=" or "!=" in filter: ${src}`);
          i++;
          const values = [next().v];
          while (peek('|')) {
            i++;
            values.push(next().v);
          }
          expect(']');
          steps.push({ filter: { field, values: values.map(String), neg } });
        }
      }
      return { k: 'path', root: t.v === '$', head: t.v === '$' ? null : t.v, steps };
    }
    throw new SyntaxError(`Unexpected token "${t.v}" in: ${src}`);
  }

  const ast = expr();
  if (i !== tk.length) throw new SyntaxError(`Trailing input in: ${src}`);
  return ast;
}

// ---------------- Evaluation ----------------
function walk(value: unknown, steps: PathStep[]): unknown {
  let cur: unknown[] = [value];
  let projected = false;
  for (const s of steps) {
    const next: unknown[] = [];
    for (const v of cur) {
      if (v === null || v === undefined) continue;
      if ('field' in s) {
        if (Array.isArray(v)) {
          projected = true;
          for (const item of v) next.push(get(item, s.field));
        } else next.push(get(v, s.field));
      } else {
        projected = true;
        const list = Array.isArray(v) ? v : [v];
        for (const item of list) {
          const hit = s.filter.values.includes(String(get(item, s.filter.field)));
          if (hit !== s.filter.neg) next.push(item);
        }
      }
    }
    cur = next;
  }
  if (projected) return cur.flat().filter((v) => v !== undefined);
  return cur[0] ?? null;
}

function lookup(tables: RuleTables, name: unknown, key: unknown): unknown {
  const table = Object.hasOwn(tables, String(name)) ? tables[String(name)] : undefined;
  if (!table) throw new Error(`Unknown table "${String(name)}"`);
  if (key === null || key === undefined) return null;
  const wrap = (v: unknown) => (table.valueType === 'dice' ? parseDice(v) : v);
  if (table.mode === 'map') {
    const entries = table.entries as Record<string, unknown>;
    return Object.hasOwn(entries, String(key)) ? wrap(entries[String(key)]) : null;
  }
  // mode "step": largest key <= x; optional linear extrapolation above `from`.
  const x = key as number;
  const ext = table.extrapolate;
  if (ext && x > ext.from) {
    const base = lookup(tables, name, ext.from);
    const n = Math.floor((x - ext.from) / ext.every);
    if (table.valueType === 'dice') {
      const dice = base as DiceValue;
      return makeDice(dice.dice + n * ext.add, dice.adds);
    }
    return (base as number) + n * ext.add;
  }
  let found: unknown = null;
  for (const [k, v] of table.entries as Array<[number, unknown]>) if (k <= x) found = v;
  return found === null ? null : wrap(found);
}

const ATTR_PATHS: Record<string, 'attributes' | 'secondary'> = {
  st: 'attributes', dx: 'attributes', iq: 'attributes', ht: 'attributes', will: 'secondary', per: 'secondary',
};

export interface EvaluationContext {
  /** The document (`$`). */
  root: unknown;
  /** The object that owns the value (bare names); defaults to root. */
  local?: unknown;
  /** The schema's x-gurps-tables. */
  tables: RuleTables;
}

/** Evaluates a formula (source or AST from parse()). */
export function evaluate(formula: string | FormulaNode, ctx: EvaluationContext): FormulaValue {
  const ast = typeof formula === 'string' ? parse(formula) : formula;
  const { root, local = root, tables } = ctx;
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const numeric = (f: (x: number) => number) => (x: unknown) => {
    const n = num(x);
    return n === null ? null : f(n);
  };
  const fns: Record<string, (...args: unknown[]) => unknown> = {
    floor: numeric(Math.floor),
    ceil: numeric(roundUp),
    round: (x, d = 0) => numeric((n) => Math.round(n * 10 ** Number(d)) / 10 ** Number(d))(x),
    abs: numeric(Math.abs),
    min: (...xs) => (xs.some((x) => num(x) === null) ? null : Math.min(...(xs as number[]))),
    max: (...xs) => (xs.some((x) => num(x) === null) ? null : Math.max(...(xs as number[]))),
    sum: (xs) => (Array.isArray(xs) ? xs : [xs]).reduce((a: number, x) => a + (num(x) ?? 0), 0),
    coalesce: (...xs) => xs.find((x) => x !== null && x !== undefined) ?? null,
    lookup: (name, key) => lookup(tables, name, key),
    attr: (id) => {
      const group = Object.hasOwn(ATTR_PATHS, String(id)) ? ATTR_PATHS[String(id)] : undefined;
      return group ? num(get(get(get(root, group), String(id)), 'value')) : null;
    },
    skillLevel: (name) => {
      const key = String(name ?? '').trim().toLowerCase();
      if (!key) return null;
      const skills = (get(root, 'skills') ?? []) as Array<{ name?: unknown; level?: unknown }>;
      const skill = skills.find((s) => String(s.name).trim().toLowerCase() === key);
      return num(skill?.level);
    },
  };

  function ev(n: FormulaNode): unknown {
    switch (n.k) {
      case 'lit': return n.v;
      case 'neg': {
        const v = num(ev(n.arg));
        return v === null ? null : -v;
      }
      case 'path': return walk(n.root ? root : get(local, n.head as string), n.steps);
      case 'call': {
        if (n.name === 'if') {
          const c = ev(n.args[0] as FormulaNode);
          return c === null ? null : ev((c ? n.args[1] : n.args[2]) as FormulaNode);
        }
        const fn = Object.hasOwn(fns, n.name) ? fns[n.name] : undefined;
        if (!fn) throw new Error(`Unknown function "${n.name}"`);
        return fn(...n.args.map(ev));
      }
      case 'bin': {
        const a = ev(n.left);
        const b = ev(n.right);
        if (n.op === '==') return a === b;
        if (n.op === '!=') return a !== b;
        const x = num(a);
        const y = num(b);
        if (x === null || y === null) return null;
        switch (n.op) {
          case '+': return x + y;
          case '-': return x - y;
          case '*': return x * y;
          case '/': return y === 0 ? null : x / y;
          case '<': return x < y;
          case '<=': return x <= y;
          case '>': return x > y;
          case '>=': return x >= y;
          default: throw new Error(`Unknown operator ${n.op}`);
        }
      }
      default: throw new Error(`Bad node ${(n as { k: string }).k}`);
    }
  }
  return ev(ast) as FormulaValue;
}

// ---------------- Schema-driven recomputation ----------------
/**
 * Resolves a local $ref. In draft 2020-12 keywords next to $ref still apply, so siblings are merged over
 * the target (their x-gurps keys win) — e.g. `damage.thrust` = dice $def + its own x-gurps.formula.
 */
export function resolveSchemaRef(schema: SchemaNode, node: SchemaNode | null | undefined): SchemaNode | undefined {
  if (!node) return undefined;
  if (!node.$ref) return node;
  const ref = node.$ref.replace(/^#\//, '').split('/').reduce<unknown>((o, k) => get(o, k), schema) as SchemaNode | undefined;
  const target = resolveSchemaRef(schema, ref);
  const { $ref, ...siblings } = node;
  return { ...target, ...siblings, 'x-gurps': { ...target?.['x-gurps'], ...siblings['x-gurps'] } };
}

export interface RecomputeResult {
  pointer: string;
  role: Role | undefined;
  override?: OverrideKind;
  formula: string;
  sheetField?: string;
  stored: unknown;
  computed: FormulaValue;
}

/** Walks `doc` alongside `schema` and returns every value whose schema carries an x-gurps.formula, stored vs. recomputed. */
export function recompute(schema: CharacterSchema, doc: GurpsCharacter): RecomputeResult[] {
  const tables = schema['x-gurps-tables'] ?? {};
  const out: RecomputeResult[] = [];
  function visit(raw: SchemaNode | undefined, value: unknown, owner: unknown, pointer: string) {
    const node = resolveSchemaRef(schema, raw);
    if (!node) return;
    const meta = node['x-gurps'];
    if (meta?.formula && owner !== undefined) {
      out.push({
        pointer, role: meta.role, override: meta.override, formula: meta.formula, sheetField: meta.sheetField, stored: value ?? null,
        computed: evaluate(meta.formula, { root: doc, local: owner, tables }),
      });
    }
    if (value && typeof value === 'object') {
      if (Array.isArray(value) && node.items) value.forEach((v, i) => visit(node.items, v, owner, `${pointer}/${i}`));
      else if (node.properties) {
        for (const [k, sub] of Object.entries(node.properties)) visit(sub, get(value, k), value, `${pointer}/${k}`);
      }
    }
  }
  visit(schema, doc, undefined, '');
  return out;
}

/** Reported form of a value: dice objects as their notation, everything else as-is. */
export const plainValue = (x: unknown): Scalar =>
  (x && typeof x === 'object' && 'notation' in x ? (x as DiceValue).notation : (x ?? null)) as Scalar;
const same = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b);

export interface RuleDeviation {
  pointer: string;
  /** override: an unpaid overridable value differs from its formula. inconsistent: a derived value doesn't add up. */
  reason: 'override' | 'inconsistent';
  expected: Scalar;
  actual: Scalar;
}

/**
 * Independent rule check for engines (does not trust the document's own `integrity` block).
 * - reason "override": an overridable value with `override: "unpaid"` differs from its formula (no cost backs it).
 * - reason "inconsistent": a derived value (totals, bases) differs from its formula — the file was edited by hand.
 * Paid overrides (bought-up HP etc.) are legitimate and not reported.
 * @param results output of recompute(schema, doc), to avoid computing twice
 */
export function deviations(schema: CharacterSchema, doc: GurpsCharacter, results: RecomputeResult[] = recompute(schema, doc)): RuleDeviation[] {
  return results
    .map((r) => ({ ...r, expected: plainValue(r.computed), actual: plainValue(r.stored) }))
    .filter((r) => (r.role === 'derived' || (r.role === 'overridable' && r.override !== 'paid')) && !same(r.expected, r.actual))
    .map((r) => ({ pointer: r.pointer, reason: r.role === 'derived' ? 'inconsistent' : 'override', expected: r.expected, actual: r.actual }));
}
