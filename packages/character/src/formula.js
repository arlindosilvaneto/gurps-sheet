// Reference evaluator for the `x-gurps.formula` expressions in gurps-character.schema.json.
// Dependency-free ES module (safe to import in any engine or browser); never uses eval().
// Grammar and semantics: see the package README.

const DICE = /^(\d+)d([+-]\d+)?$/;

/** ceil() that ignores float noise below 1e-9 (40 * 0.8 -> 32, not 33). Shared with the app's rules engine. */
export const roundUp = (x) => Math.ceil(x - 1e-9);

/** Parses "2d-1" -> { notation, dice, adds }; null if not dice notation. */
export function parseDice(notation) {
  const m = DICE.exec(String(notation ?? '').trim());
  return m ? makeDice(Number(m[1]), Number(m[2] ?? 0)) : null;
}

function makeDice(dice, adds) {
  return { notation: `${dice}d${adds > 0 ? `+${adds}` : adds < 0 ? adds : ''}`, dice, adds };
}

// ---------------- Tokenizer ----------------
function tokenize(src) {
  const tokens = [];
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
    else tokens.push({ t: 'op', v: m[4] });
  }
  return tokens;
}

// ---------------- Parser (recursive descent -> AST) ----------------
export function parse(src) {
  const tk = tokenize(src);
  let i = 0;
  const peek = (v) => tk[i] && tk[i].t === 'op' && tk[i].v === v;
  const expect = (v) => {
    if (!peek(v)) throw new SyntaxError(`Expected "${v}" in: ${src}`);
    i++;
  };

  const expr = () => compare();
  function compare() {
    let left = additive();
    for (const op of ['<=', '>=', '==', '!=', '<', '>']) {
      if (peek(op)) {
        i++;
        return { k: 'bin', op, left, right: additive() };
      }
    }
    return left;
  }
  function additive() {
    let left = multiplicative();
    while (peek('+') || peek('-')) left = { k: 'bin', op: tk[i++].v, left, right: multiplicative() };
    return left;
  }
  function multiplicative() {
    let left = unary();
    while (peek('*') || peek('/')) left = { k: 'bin', op: tk[i++].v, left, right: unary() };
    return left;
  }
  function unary() {
    if (peek('-')) {
      i++;
      return { k: 'neg', arg: unary() };
    }
    return primary();
  }
  function primary() {
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
        const args = [];
        if (!peek(')')) {
          do args.push(expr());
          while (peek(',') && ++i);
        }
        expect(')');
        return { k: 'call', name: t.v, args };
      }
      const steps = [];
      while (peek('.') || peek('[')) {
        if (tk[i++].v === '.') {
          const id = tk[i++];
          if (!id || id.t !== 'id') throw new SyntaxError(`Expected name after "." in: ${src}`);
          steps.push({ field: id.v });
        } else {
          const field = tk[i++].v;
          const neg = peek('!=');
          if (!peek('=') && !neg) throw new SyntaxError(`Expected "=" or "!=" in filter: ${src}`);
          i++;
          const values = [tk[i++].v];
          while (peek('|')) {
            i++;
            values.push(tk[i++].v);
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
function walk(value, steps) {
  let cur = [value];
  let projected = false;
  for (const s of steps) {
    const next = [];
    for (const v of cur) {
      if (v === null || v === undefined) continue;
      if (s.field !== undefined) {
        if (Array.isArray(v)) {
          projected = true;
          for (const item of v) next.push(item?.[s.field]);
        } else next.push(v[s.field]);
      } else {
        projected = true;
        const list = Array.isArray(v) ? v : [v];
        for (const item of list) {
          const hit = s.filter.values.includes(String(item?.[s.filter.field]));
          if (hit !== s.filter.neg) next.push(item);
        }
      }
    }
    cur = next;
  }
  if (projected) return cur.flat().filter((v) => v !== undefined);
  return cur[0] ?? null;
}

function lookup(tables, name, key) {
  const table = tables[name];
  if (!table) throw new Error(`Unknown table "${name}"`);
  if (key === null || key === undefined) return null;
  const wrap = (v) => (table.valueType === 'dice' ? parseDice(v) : v);
  if (table.mode === 'map') return Object.hasOwn(table.entries, key) ? wrap(table.entries[key]) : null;
  // mode "step": largest key <= x; optional linear extrapolation above `from`.
  const ext = table.extrapolate;
  if (ext && key > ext.from) {
    const base = lookup(tables, name, ext.from);
    const n = Math.floor((key - ext.from) / ext.every);
    if (table.valueType === 'dice') return makeDice(base.dice + n * ext.add, base.adds);
    return base + n * ext.add;
  }
  let found = null;
  for (const [k, v] of table.entries) if (k <= key) found = v;
  return found === null ? null : wrap(found);
}

const ATTR_PATHS = { st: 'attributes', dx: 'attributes', iq: 'attributes', ht: 'attributes', will: 'secondary', per: 'secondary' };

/**
 * Evaluates a formula.
 * @param {string|object} formula expression source or AST from parse()
 * @param {{ root: object, local?: object, tables: object }} ctx document, owning object, schema rule tables
 */
export function evaluate(formula, ctx) {
  const ast = typeof formula === 'string' ? parse(formula) : formula;
  const { root, local = root, tables } = ctx;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const fns = {
    floor: (x) => (num(x) === null ? null : Math.floor(x)),
    ceil: (x) => (num(x) === null ? null : roundUp(x)),
    round: (x, d = 0) => (num(x) === null ? null : Math.round(x * 10 ** d) / 10 ** d),
    abs: (x) => (num(x) === null ? null : Math.abs(x)),
    min: (...xs) => (xs.some((x) => num(x) === null) ? null : Math.min(...xs)),
    max: (...xs) => (xs.some((x) => num(x) === null) ? null : Math.max(...xs)),
    sum: (xs) => (Array.isArray(xs) ? xs : [xs]).reduce((a, x) => a + (num(x) ?? 0), 0),
    coalesce: (...xs) => xs.find((x) => x !== null && x !== undefined) ?? null,
    lookup: (name, key) => lookup(tables, name, key),
    attr: (id) => {
      const group = ATTR_PATHS[id];
      return group ? num(root?.[group]?.[id]?.value) : null;
    },
    skillLevel: (name) => {
      const key = String(name ?? '').trim().toLowerCase();
      if (!key) return null;
      const skill = (root?.skills ?? []).find((s) => String(s.name).trim().toLowerCase() === key);
      return num(skill?.level);
    },
  };

  function ev(n) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'neg': {
        const v = ev(n.arg);
        return num(v) === null ? null : -v;
      }
      case 'path': return walk(n.root ? root : local?.[n.head], n.steps);
      case 'call': {
        if (n.name === 'if') {
          const c = ev(n.args[0]);
          return c === null ? null : ev(c ? n.args[1] : n.args[2]);
        }
        const fn = fns[n.name];
        if (!fn) throw new Error(`Unknown function "${n.name}"`);
        return fn(...n.args.map(ev));
      }
      case 'bin': {
        const a = ev(n.left);
        const b = ev(n.right);
        if (n.op === '==') return a === b;
        if (n.op === '!=') return a !== b;
        if (num(a) === null || num(b) === null) return null;
        switch (n.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b === 0 ? null : a / b;
          case '<': return a < b;
          case '<=': return a <= b;
          case '>': return a > b;
          case '>=': return a >= b;
          default: throw new Error(`Unknown operator ${n.op}`);
        }
      }
      default: throw new Error(`Bad node ${n.k}`);
    }
  }
  return ev(ast);
}

// ---------------- Schema-driven recomputation ----------------
/**
 * Resolves a local $ref. In draft 2020-12 keywords next to $ref still apply, so siblings are merged over
 * the target (their x-gurps keys win) — e.g. `damage.thrust` = dice $def + its own x-gurps.formula.
 */
export function resolveSchemaRef(schema, node) {
  if (!node || !node.$ref) return node;
  const target = resolveSchemaRef(schema, node.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o?.[k], schema));
  const { $ref, ...siblings } = node;
  return { ...target, ...siblings, 'x-gurps': { ...target?.['x-gurps'], ...siblings['x-gurps'] } };
}

/**
 * Walks `doc` alongside `schema` and yields every value whose schema carries an x-gurps.formula.
 * @returns {Array<{ pointer: string, role: string, override?: 'paid'|'unpaid', formula: string, sheetField?: string, stored: any, computed: any }>}
 */
export function recompute(schema, doc) {
  const tables = schema['x-gurps-tables'] ?? {};
  const out = [];
  function visit(node, value, owner, pointer) {
    node = resolveSchemaRef(schema, node);
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
        for (const [k, sub] of Object.entries(node.properties)) visit(sub, value[k], value, `${pointer}/${k}`);
      }
    }
  }
  visit(schema, doc, undefined, '');
  return out;
}

/** Reported form of a value: dice objects as their notation, everything else as-is. */
const plain = (x) => (x && typeof x === 'object' && 'notation' in x ? x.notation : x ?? null);
const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b);

/**
 * Independent rule check for engines (does not trust the document's own `integrity` block).
 * - reason "override": an overridable value with `override: "unpaid"` differs from its formula (no cost backs it).
 * - reason "inconsistent": a derived value (totals, bases) differs from its formula — the file was edited by hand.
 * Paid overrides (bought-up HP etc.) are legitimate and not reported.
 * @param {Array} [results] output of recompute(schema, doc), to avoid computing twice
 * @returns {Array<{ pointer: string, reason: 'override'|'inconsistent', expected: any, actual: any }>}
 */
export function deviations(schema, doc, results = recompute(schema, doc)) {
  return results
    .map((r) => ({ ...r, expected: plain(r.computed), actual: plain(r.stored) }))
    .filter((r) => (r.role === 'derived' || (r.role === 'overridable' && r.override !== 'paid')) && !same(r.expected, r.actual))
    .map((r) => ({ pointer: r.pointer, reason: r.role === 'derived' ? 'inconsistent' : 'override', expected: r.expected, actual: r.actual }));
}
