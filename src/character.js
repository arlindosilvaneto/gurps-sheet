// Maps the sheet's flat field values <-> gurps-character documents (@gurps-sheet/character schema).
// Pure module (no DOM, no Ajv import) so the browser and node tests share it.

import { compute, display, num, ROWS, range, COST_MODS, SKILL_BONUSES, JUSTIFICATIONS, skillBonuses, isOverridden } from './rules.js';
import { parseDice, deviations as engineDeviations } from '@gurps-sheet/character/formula';
import { FORMAT, LATEST_VERSION, SUPPORTED_MINOR, MAX_DOCUMENT_BYTES } from '@gurps-sheet/character/constants';
import { sheetDeviations, sheetIssues, fieldLabel, STRICT_FIELDS } from './integrity.js';

export { FORMAT };
export const MAX_FILE_BYTES = MAX_DOCUMENT_BYTES;

/** A sheet file could not be loaded/saved; `problems` are user-facing pt-BR messages. */
export class SheetFileError extends Error {
  constructor(title, problems = []) {
    super(title);
    this.name = 'SheetFileError';
    this.title = title;
    this.problems = problems;
  }
}

// ---------------- Page-2 tables, grouped by position (field names there are irregular) ----------------
const TABLES = {
  melee: { y: [45, 110], anchor: [150, 160], cols: { damage: [255, 265], reach: [305, 315], parry: [345, 354], notes: [385, 395], cost: [455, 470], weight: [505, 515] } },
  ranged: { y: [138, 275], anchor: [18, 28], cols: { damage: [120, 130], accuracy: [172, 182], range: [210, 220], rateOfFire: [252, 262], shots: [277, 286], minST: [300, 310], bulk: [325, 335], recoil: [368, 377], legalityClass: [393, 402], notes: [418, 427], cost: [455, 470], weight: [505, 515] } },
  equipment: { y: [295, 780], anchor: [260, 270], cols: { location: [385, 395], cost: [455, 470], weight: [505, 515] } },
};

const tableCache = new WeakMap();
/** Rows of the page-2 tables: [{ name: id, <col>: [ids…] }] in top-to-bottom order. */
export function sheetTables(layout) {
  if (tableCache.has(layout)) return tableCache.get(layout);
  const fields = layout.fields.filter((f) => f.page === 1 && !/_Total$/.test(f.id));
  const result = {};
  for (const [name, spec] of Object.entries(TABLES)) {
    const inY = (f) => f.y >= spec.y[0] && f.y < spec.y[1];
    const anchors = fields.filter((f) => inY(f) && f.x >= spec.anchor[0] && f.x <= spec.anchor[1]).sort((a, b) => a.y - b.y);
    result[name] = anchors.map((a) => {
      const row = { name: a.id };
      for (const [col, [x0, x1]] of Object.entries(spec.cols)) {
        row[col] = fields
          // Window is asymmetric: a melee row's 2nd damage line sits ~5pt below its name, ~6pt above the next row.
          .filter((f) => f !== a && f.x >= x0 && f.x <= x1 && f.y >= a.y - 3 && f.y < a.y + 8)
          .sort((p, q) => p.y - q.y || p.id.localeCompare(q.id))
          .map((f) => f.id);
      }
      return row;
    });
  }
  tableCache.set(layout, result);
  return result;
}

// ---------------- Vocabulary mappings (sheet pt-BR text <-> schema enums) ----------------
const strip = (s) => String(s ?? '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ATTR_TO_SCHEMA = { ST: 'st', DX: 'dx', IQ: 'iq', HT: 'ht', VONT: 'will', PER: 'per' };
const ATTR_TO_SHEET = { st: 'ST', dx: 'DX', iq: 'IQ', ht: 'HT', will: 'Vont', per: 'Per' };
const DIFF_TO_SCHEMA = { F: 'E', E: 'E', M: 'A', A: 'A', D: 'H', H: 'H', MD: 'VH', VH: 'VH' };
const DIFF_TO_SHEET = { E: 'F', A: 'M', H: 'D', VH: 'MD' };
const LEVEL_TO_SCHEMA = { '': 'none', nenhum: 'none', none: 'none', rudimentar: 'broken', broken: 'broken', sotaque: 'accented', accented: 'accented', nativo: 'native', native: 'native' };
const LEVEL_TO_SHEET = { none: 'Nenhum', broken: 'Rudimentar', accented: 'Sotaque', native: 'Nativo' };
const LOCATION_IDS = {
  cabeca: 'head', cranio: 'skull', rosto: 'face', olhos: 'eyes', pescoco: 'neck', tronco: 'torso', torso: 'torso', 'orgaos vitais': 'vitals', vitais: 'vitals', virilha: 'groin', bracos: 'arms', maos: 'hands', pernas: 'legs', pes: 'feet',
  // English names (e.g. the @gurps-sheet/npcs library)
  head: 'head', skull: 'skull', face: 'face', eyes: 'eyes', neck: 'neck', vitals: 'vitals', groin: 'groin', arms: 'arms', hands: 'hands', legs: 'legs', feet: 'feet',
};
const DAMAGE_TYPES = { cort: 'cut', cut: 'cut', cont: 'cr', cr: 'cr', perf: 'imp', imp: 'imp', 'pa-': 'pi-', 'pi-': 'pi-', pa: 'pi', pi: 'pi', 'pa+': 'pi+', 'pi+': 'pi+', 'pa++': 'pi++', 'pi++': 'pi++', qmd: 'burn', burn: 'burn', cor: 'cor', fad: 'fat', fat: 'fat', tox: 'tox', tbb: 'tbb', aff: 'aff', spec: 'spec' };
const ENCUMBRANCE = [['none', 'Nenhuma', 'Esquiva'], ['light', 'Leve', 'Esquiva-1'], ['medium', 'Media', 'Esquiva-2'], ['heavy', 'Pesada', 'Esquiva-3'], ['extraHeavy', 'Mto_Pesada', 'Esquiva-4']];
const ENCUMBRANCE_PT = ['Nenhuma', 'Leve', 'Média', 'Pesada', 'Muito Pesada'];

/** "GeB+2 cort" / "sw+2 cut" / "2d+1 pa" -> weaponDamage (structured parts only when recognised). */
export function parseWeaponDamage(text) {
  const notation = String(text).trim();
  const m = /^(gdp|geb|thr|sw|(\d+)d)\s*([+-]\d+)?\s*([a-z+-]+)?$/i.exec(notation.replace(/\s+/g, ' '));
  if (!m) return { notation };
  const head = m[1].toLowerCase();
  const out = { notation, base: head === 'gdp' || head === 'thr' ? 'thrust' : head === 'geb' || head === 'sw' ? 'swing' : 'fixed' };
  if (out.base === 'fixed') out.dice = Number(m[2]);
  out.adds = Number(m[3] ?? 0);
  const type = DAMAGE_TYPES[strip(m[4])];
  if (type) out.type = type;
  return out;
}

function parseParry(text) {
  const notation = String(text).trim();
  if (/^(n|no|nao)$/i.test(strip(notation))) return { notation, modifier: null };
  const m = /^([+-]?\d+)\s*([udf])?$/i.exec(notation); // U/D: unbalanced (Basic Set / pt-BR); F: fencing
  return m ? { notation, modifier: Number(m[1]), unbalanced: /[ud]/i.test(m[2] ?? '') } : { notation };
}

function parseRange(text) {
  const notation = String(text).trim();
  const m = /^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/.exec(notation);
  return m ? { notation, halfDamage: num(m[1]), max: num(m[2]) } : { notation };
}

/** "+1 Guerreiro honrado" -> { modifier: 1, … }. Only an explicit sign makes a modifier ("10 anos de serviço" is text). */
function splitModifier(text) {
  const m = /^\s*([+\-−]\d+)\s+(.*)$/.exec(text);
  return m ? { modifier: Number(m[1].replace('−', '-')), description: m[2].trim() } : { modifier: null, description: text.trim() };
}

/** Lossless number -> sheet text (pt-BR decimal comma, no rounding). */
const sheetNumber = (x) => String(x).replace('.', ',');
const signedLevel = (x) => (x > 0 ? `+${x}` : String(x)); // relative skill level: "+1", "0", "-2"
const signedModifier = (x) => (x < 0 ? String(x) : `+${x}`); // reaction modifier: "+0", "+1", "-2" (sign marks it as a modifier)

// ---------------- Sheet -> document ----------------
/**
 * Builds a gurps-character document from the sheet.
 * @param {object} [opts.context] { locale, currency } carried over from a loaded file (defaults pt-BR / $)
 * @param {object} [opts.flags] { experimental } — the sheet's experimental mode
 * @param {object} opts.schema gurps-character schema: `integrity` is built from its engine-side deviations() check,
 *   so what the file reports always equals what an engine verifies
 * @returns {{ doc: object, problems: string[], labels: Record<string,string> }}
 *   problems = sheet data the document cannot carry (the save must be blocked);
 *   labels = JSON pointer -> sheet location, for turning schema errors into sheet-row messages.
 */
export function toCharacter(values, layout, { now = new Date(), createdAt, generator, context = {}, flags = {}, schema } = {}) {
  if (!schema) throw new TypeError('toCharacter: opts.schema is required');
  const { out, errors } = compute(values);
  const v = (id) => String(display(id, values, out) ?? '').trim();
  const problems = [];
  const labels = {};
  const tables = sheetTables(layout);
  const opt = (obj, key, value) => { if (value !== null && value !== undefined && value !== '') obj[key] = value; };

  /** Reads a numeric field; blank -> null; invalid -> problem + undefined (callers drop the value/row). */
  function numField(id, label, { integer = false, min, max, step } = {}) {
    const t = v(id);
    if (!t) return null;
    const x = num(t);
    const fail = (why) => { problems.push(`${label}: "${t}" ${why}.`); return undefined; };
    if (x === null) return fail('não é um número');
    if (integer && !Number.isInteger(x)) return fail('deve ser um número inteiro');
    if (step && Math.abs(x / step - Math.round(x / step)) > 1e-9) return fail(`deve variar em passos de ${sheetNumber(step)}`);
    if (min !== undefined && x < min) return fail(`deve ser no mínimo ${min}`);
    if (max !== undefined && x > max) return fail(`deve ser no máximo ${max}`);
    return x;
  }
  const ok = (...xs) => xs.every((x) => x !== undefined);

  // ---- profile & points ----
  const profile = { name: v('Nome') };
  opt(profile, 'player', v('Jogador'));
  opt(profile, 'height', v('Altura'));
  opt(profile, 'weight', v('Peso'));
  opt(profile, 'age', v('Idade'));
  profile.sizeModifier = numField('ModificadorTamanho', 'Mod. de Tamanho', { integer: true }) ?? 0;
  opt(profile, 'appearance', v('Aparência'));
  labels['/profile/sizeModifier'] = 'Mod. de Tamanho';

  const budget = numField('Pontos_Gastar', 'Pontos p/ Gastar', { integer: true });
  const other = numField('Resumo_Pontos5', 'Resumo dos pontos › Outros');
  // Totals are summed from exact values: the sheet's display strings round to 2 decimals.
  const breakdown = {
    attributes: num(out.Resumo_Pontos1) ?? 0,
    advantages: num(out.Resumo_Pontos2) ?? 0,
    disadvantages: num(out.Resumo_Pontos3) ?? 0,
    skills: num(out.Resumo_Pontos4) ?? 0,
    other: other ?? 0,
  };
  const spent = breakdown.attributes + breakdown.advantages + breakdown.disadvantages + breakdown.skills + breakdown.other;
  labels['/points/budget'] = 'Pontos p/ Gastar';

  // ---- attributes & secondary characteristics ----
  const characteristic = (pointer, id, costId, label, { base = false, currentId, step } = {}) => {
    labels[pointer] = label;
    const c = { value: numField(id, label, step ? { step } : { integer: true }) };
    if (base) c.base = num(out[id]);
    c.points = numField(costId, `${label} › custo`, step ? {} : { integer: true }) ?? 0;
    if (currentId) opt(c, 'current', numField(currentId, `${label} atual`, { integer: true }));
    const mods = values[COST_MODS]?.[id] ?? []; // the Size discount is derived from sizeModifier, never stored
    if (mods.length) c.costModifiers = mods.map(({ name, percent }) => ({ name, percent }));
    return c;
  };

  // ---- traits ----
  const traits = [];
  const traitRows = (prefix, costPrefix, count, label, positive) => {
    for (const i of range(count)) {
      const name = v(`${prefix}${i}`);
      const where = `${label}, linha ${i}${name ? ` (${name})` : ''}`;
      const points = numField(`${costPrefix}${i}`, `${where} › custo`, { integer: true });
      if (!name && points === null) continue;
      if (!name) {
        problems.push(`${where}: tem custo mas não tem nome.`);
        continue;
      }
      if (!ok(points)) continue;
      const p = points ?? 0;
      labels[`/traits/${traits.length}`] = where;
      traits.push({ name, type: positive ? (p === 1 ? 'perk' : 'advantage') : (p === -1 ? 'quirk' : 'disadvantage'), points: p });
    }
  };
  traitRows('Vantagem', 'Custo_Vantagem_', ROWS.advantages, 'Vantagens', true);
  traitRows('Desvantagem', 'Custo_desvantagem_', ROWS.disadvantages, 'Desvantagens', false);

  // ---- skills ----
  const skills = [];
  const skillIndex = {}; // sheet row -> index in skills[] (rows are packed)
  for (const i of range(ROWS.skills)) {
    const name = v(`Pericia${i}`);
    const attrText = v(`NH_Relativo_${i}A`);
    const diffText = v(`Tipo_${i}`);
    if (!name && !attrText && !diffText && !v(`NH_Relativo_${i}B`)) {
      // An empty row exports nothing, so anything typed over its NH/cost would vanish from the file.
      for (const id of [`NH${i}`, `Custo_Pericia_${i}`]) {
        if (isOverridden(id, values)) problems.push(`Perícias, linha ${i}: há um valor manual de ${id.startsWith('NH') ? 'NH' : 'custo'} ("${values[id]}") numa linha sem perícia — apague-o ou preencha a perícia.`);
      }
      if (skillBonuses(i, values).length) problems.push(`Perícias, linha ${i}: há bônus de NH numa linha sem perícia — remova-os ou preencha a perícia.`);
      continue;
    }
    const where = `Perícias, linha ${i}${name ? ` (${name})` : ''}`;
    const before = problems.length;
    const attribute = ATTR_TO_SCHEMA[attrText.toUpperCase()];
    const difficulty = DIFF_TO_SCHEMA[diffText.toUpperCase()];
    if (!name) problems.push(`${where}: falta o nome.`);
    if (!attribute) problems.push(`${where}: atributo ${attrText ? `"${attrText}" inválido` : 'ausente'} (use ST, DX, IQ, HT, Vont ou Per).`);
    if (!difficulty) problems.push(`${where}: dificuldade ${diffText ? `"${diffText}" inválida` : 'ausente'} (use F, M, D ou MD).`);
    if (errors[`Custo_Pericia_${i}`]) problems.push(`${where}: ${errors[`Custo_Pericia_${i}`]}`);
    const relativeLevel = numField(`NH_Relativo_${i}B`, `${where} › NH relativo`, { integer: true });
    const level = numField(`NH${i}`, `${where} › NH`, { integer: true });
    const points = numField(`Custo_Pericia_${i}`, `${where} › custo`, { integer: true, min: 1 });
    if (problems.length > before) continue;
    labels[`/skills/${skills.length}`] = where;
    skillIndex[i] = skills.length;
    const skill = { name, attribute, difficulty, relativeLevel: relativeLevel ?? 0, level, points };
    const bonuses = skillBonuses(i, values);
    if (bonuses.length) skill.bonuses = bonuses.map(({ name: n, amount }) => ({ name: n, amount }));
    skills.push(skill);
  }

  // ---- languages, cultures ----
  const languages = [];
  for (const i of range(ROWS.languages)) {
    const name = v(`Lingua${i}`);
    const spokenText = v(`Falada${i}`);
    const writtenText = v(`Escrita${i}`);
    const where = `Línguas, linha ${i}${name ? ` (${name})` : ''}`;
    const points = numField(`Custo_lingua_${i}`, `${where} › custo`, { integer: true });
    if (!name && !spokenText && !writtenText && points === null) continue;
    const before = problems.length;
    const spoken = LEVEL_TO_SCHEMA[strip(spokenText)];
    const written = LEVEL_TO_SCHEMA[strip(writtenText)];
    if (!name) problems.push(`${where}: falta o nome.`);
    if (!spoken) problems.push(`${where}: nível falado "${spokenText}" não reconhecido (use Nenhum, Rudimentar, Sotaque ou Nativo).`);
    if (!written) problems.push(`${where}: nível escrito "${writtenText}" não reconhecido (use Nenhum, Rudimentar, Sotaque ou Nativo).`);
    if (problems.length > before || !ok(points)) continue;
    labels[`/languages/${languages.length}`] = where;
    languages.push({ name, spoken, written, points: points ?? 0 });
  }

  const culturalFamiliarities = [];
  for (const i of range(ROWS.familiarities)) {
    const name = v(`FC${i}`);
    const where = `Familiaridades culturais, linha ${i}${name ? ` (${name})` : ''}`;
    const points = numField(`Custo_FC${i}`, `${where} › custo`, { integer: true });
    if (!name && points === null) continue;
    if (!name) problems.push(`${where}: tem custo mas não tem nome.`);
    else if (ok(points)) {
      labels[`/culturalFamiliarities/${culturalFamiliarities.length}`] = where;
      culturalFamiliarities.push({ name, points: points ?? 0 });
    }
  }

  // ---- DR: "4" or "4 (2 contra contusão)" -> { dr: 4, notes: "(2 contra contusão)" } ----
  const damageResistance = [];
  for (const i of range(ROWS.dr)) {
    const location = v(`RD${i}a`);
    const drText = v(`RD${i}b`);
    if (!location && !drText) continue;
    const where = `RD, linha ${i}${location ? ` (${location})` : ''}`;
    const m = /^(\d+)(?:\s+(.*))?$/.exec(drText);
    if (!location) problems.push(`${where}: falta o local.`);
    else if (!drText) problems.push(`${where}: falta o valor de RD.`);
    else if (!m) problems.push(`${where}: "${drText}" deve começar com um número inteiro (ex.: 4 ou "4 (2 contra contusão)").`);
    else {
      const entry = { location, dr: Number(m[1]) };
      opt(entry, 'locationId', LOCATION_IDS[strip(location)]);
      opt(entry, 'notes', m[2]?.trim());
      labels[`/damageResistance/${damageResistance.length}`] = where;
      damageResistance.push(entry);
    }
  }

  // ---- reaction modifiers ----
  const reactionModifiers = [];
  const reaction = (source, id, where) => {
    const text = v(id);
    if (!text) return;
    labels[`/reactionModifiers/${reactionModifiers.length}`] = where;
    reactionModifiers.push({ source, ...splitModifier(text) });
  };
  reaction('appearance', 'Reação_Aparencia', 'Modificadores de reação › Aparência');
  reaction('status', 'Status', 'Modificadores de reação › Status');
  reaction('reputation', 'Reputação1', 'Modificadores de reação › Reputação');
  for (const i of range(ROWS.otherReactions)) reaction('other', `Reputação${i + 1}`, `Modificadores de reação, linha ${i + 1}`);

  // ---- page-2 tables ----
  const rowName = (where, row, cols) => {
    const name = v(row.name);
    if (!name && cols.some((ids) => ids.some((id) => v(id)))) problems.push(`${where}: tem dados mas não tem nome.`);
    return name;
  };
  const money = (obj, row, where) => {
    const cost = numField(row.cost[0], `${where} › custo`, { min: 0 });
    const weight = numField(row.weight[0], `${where} › peso`, { min: 0 });
    opt(obj, 'cost', cost);
    opt(obj, 'weight', weight);
    return ok(cost, weight);
  };

  const melee = [];
  tables.melee.forEach((row, i) => {
    const where = `Armas corpo a corpo, linha ${i + 1}`;
    const name = rowName(where, row, [row.damage, row.reach, row.parry, row.notes, row.cost, row.weight]);
    if (!name) return;
    const w = { name };
    const damage = row.damage.map(v).filter(Boolean).map(parseWeaponDamage);
    if (damage.length) w.damage = damage;
    opt(w, 'reach', v(row.reach[0]));
    if (v(row.parry[0])) w.parry = parseParry(v(row.parry[0]));
    opt(w, 'notes', v(row.notes[0]));
    if (!money(w, row, `${where} (${name})`)) return;
    labels[`/weapons/melee/${melee.length}`] = `${where} (${name})`;
    melee.push(w);
  });

  const ranged = [];
  tables.ranged.forEach((row, i) => {
    const where = `Armas à distância, linha ${i + 1}`;
    const name = rowName(where, row, Object.keys(TABLES.ranged.cols).map((c) => row[c]));
    if (!name) return;
    const at = `${where} (${name})`;
    const w = { name };
    if (v(row.damage[0])) w.damage = parseWeaponDamage(v(row.damage[0]));
    opt(w, 'accuracy', v(row.accuracy[0]));
    if (v(row.range[0])) w.range = parseRange(v(row.range[0]));
    opt(w, 'rateOfFire', v(row.rateOfFire[0]));
    opt(w, 'shots', v(row.shots[0]));
    opt(w, 'minST', v(row.minST[0]));
    const dashOrNum = (id, label, rules) => (/^[-–—]$/.test(v(id)) ? null : numField(id, `${at} › ${label}`, { integer: true, ...rules }));
    w.bulk = dashOrNum(row.bulk[0], 'Magnitude', { max: 0 });
    w.recoil = dashOrNum(row.recoil[0], 'RCO', { min: 1 });
    w.legalityClass = dashOrNum(row.legalityClass[0], 'CL', { min: 0, max: 4 });
    opt(w, 'notes', v(row.notes[0]));
    const moneyOk = money(w, row, at);
    if (!moneyOk || !ok(w.bulk, w.recoil, w.legalityClass)) return;
    labels[`/weapons/ranged/${ranged.length}`] = at;
    ranged.push(w);
  });

  const equipment = [];
  tables.equipment.forEach((row, i) => {
    const where = `Armadura & posses, linha ${i + 1}`;
    const name = rowName(where, row, [row.location, row.cost, row.weight]);
    if (!name) return;
    const item = { name };
    opt(item, 'location', v(row.location[0]));
    if (!money(item, row, `${where} (${name})`)) return;
    labels[`/equipment/${equipment.length}`] = `${where} (${name})`;
    equipment.push(item);
  });

  // ---- derived blocks ----
  const tlLevel = numField('NT', 'NT', { integer: true });
  const tlPoints = numField('Custo_NT', 'NT › custo', { integer: true });
  labels['/techLevel'] = 'NT';

  const st = num(v('ST'));
  const dice = (id, label, pointer) => {
    labels[pointer] = label;
    const parsed = parseDice(v(id));
    if (parsed) return parsed;
    problems.push(st !== null && st < 1
      ? `${label}: com ST ${v('ST')} não há dano na tabela; a ST precisa ser pelo menos 1.`
      : `${label}: "${v(id)}" não é uma notação de dados válida (ex.: 1d+2).`);
    return { notation: '1d', dice: 1, adds: 0 }; // placeholder; the save is blocked by the problem above
  };

  labels['/encumbrance/basicLift'] = 'Base de Carga';
  const levels = ENCUMBRANCE.map(([id, name, dodgeId], level) => {
    const where = `Carga ${ENCUMBRANCE_PT[level]}`;
    labels[`/encumbrance/levels/${level}`] = where;
    return {
      level, id,
      maxLoad: numField(`Base_Carga_${name}`, `${where} › peso máximo`, { min: 0 }),
      move: numField(`DB_${name}`, `${where} › deslocamento`, { integer: true }),
      dodge: numField(dodgeId, `${where} › esquiva`, { integer: true }),
    };
  });

  labels['/defenses/dodge'] = 'Esquiva';
  labels['/defenses/parry'] = 'Aparar';
  labels['/defenses/block'] = 'Bloqueio';
  labels['/possessionsTotal'] = 'Totais da página 2';

  const doc = {
    format: FORMAT,
    formatVersion: LATEST_VERSION, // replaced below by lowestVersion()
    ruleset: { system: 'GURPS', edition: 4, units: 'metric', currency: context.currency ?? '$' },
    meta: { locale: context.locale ?? 'pt-BR', createdAt: createdAt ?? now.toISOString(), updatedAt: now.toISOString(), ...(generator ? { generator } : {}) },
    profile,
    points: {
      budget: budget ?? null,
      spent,
      unspent: budget === null || budget === undefined ? null : budget - spent,
      breakdown,
    },
    attributes: {
      st: characteristic('/attributes/st', 'ST', 'Custo_ST', 'ST'),
      dx: characteristic('/attributes/dx', 'DX', 'Custo_DX', 'DX'),
      iq: characteristic('/attributes/iq', 'IQ', 'Custo_IQ', 'IQ'),
      ht: characteristic('/attributes/ht', 'HT', 'Custo_HT', 'HT'),
    },
    secondary: {
      hp: characteristic('/secondary/hp', 'PV', 'Custo_PV', 'PV', { base: true, currentId: 'PV_Atual' }),
      will: characteristic('/secondary/will', 'Vont', 'Custo_Vont', 'Vontade', { base: true }),
      per: characteristic('/secondary/per', 'Per', 'Custo_Per', 'Percepção', { base: true }),
      fp: characteristic('/secondary/fp', 'PF', 'Custo_PF', 'PF', { base: true, currentId: 'PF_Atual' }),
      basicSpeed: characteristic('/secondary/basicSpeed', 'Vel_Basica', 'Custo_Vel_Basica', 'Velocidade Básica', { base: true, step: 0.25 }),
      basicMove: characteristic('/secondary/basicMove', 'Desl_Basico', 'Custo_Desl_Basico', 'Deslocamento Básico', { base: true }),
    },
    encumbrance: { basicLift: numField('Base_Carga', 'Base de Carga', { min: 0 }), levels },
    damage: {
      thrust: dice('Dano_GdP', 'Dano GdP', '/damage/thrust'),
      swing: dice('Dano_GeB', 'Dano GeB', '/damage/swing'),
    },
    defenses: {
      dodge: { value: numField('Esquiva', 'Esquiva', { integer: true }) },
      parry: { skill: v('Aparar2') || null, value: numField('Aparar', 'Aparar', { integer: true }) ?? null },
      block: { skill: v('Bloqueio2') || null, value: numField('Bloqueio', 'Bloqueio', { integer: true }) ?? null },
    },
    damageResistance,
    reactionModifiers,
    techLevel: { level: tlLevel ?? null, points: tlPoints ?? 0 },
    languages,
    culturalFamiliarities,
    traits,
    skills,
    weapons: { melee, ranged },
    equipment,
    possessionsTotal: {
      cost: [melee, ranged, equipment].reduce((a, list) => a + list.reduce((b, x) => b + (x.cost ?? 0), 0), 0),
      weight: [melee, ranged, equipment].reduce((a, list) => a + list.reduce((b, x) => b + (x.weight ?? 0), 0), 0),
    },
    notes: range(ROWS.notes).map((i) => v(`Anotações${i}`)).filter(Boolean),
  };
  doc.integrity = integrityBlock(doc, values, errors, skillIndex, flags, schema, problems);
  doc.formatVersion = lowestVersion(doc);
  return { doc, problems, labels };
}

/** Lowest format version whose features the document uses, so older readers can still open it. */
function lowestVersion(doc) {
  const characteristics = [...Object.values(doc.attributes), ...Object.values(doc.secondary)];
  if (doc.skills.some((s) => s.bonuses) || doc.integrity.deviations.some((d) => d.justification)) return '1.3.0';
  // 1.2 added cost modifiers and the Size discount inside the ST/HP cost formulas.
  if (characteristics.some((c) => c.costModifiers) || doc.profile.sizeModifier >= 1) return '1.2.0';
  return '1.1.0'; // integrity is always written
}

// Sheet field -> JSON pointer of the value it becomes in the document.
const POINTERS = {
  Custo_ST: '/attributes/st/points', Custo_DX: '/attributes/dx/points', Custo_IQ: '/attributes/iq/points', Custo_HT: '/attributes/ht/points',
  Custo_PV: '/secondary/hp/points', Custo_Vont: '/secondary/will/points', Custo_Per: '/secondary/per/points', Custo_PF: '/secondary/fp/points',
  Custo_Vel_Basica: '/secondary/basicSpeed/points', Custo_Desl_Basico: '/secondary/basicMove/points',
  Base_Carga: '/encumbrance/basicLift', Esquiva: '/defenses/dodge/value', Aparar: '/defenses/parry/value', Bloqueio: '/defenses/block/value',
  Dano_GdP: '/damage/thrust', Dano_GeB: '/damage/swing',
};
function pointerFor(id, skillIndex) {
  if (POINTERS[id]) return POINTERS[id];
  let m = /^(NH|Custo_Pericia_)(\d+)$/.exec(id);
  if (m) return skillIndex[m[2]] === undefined ? null : `/skills/${skillIndex[m[2]]}/${m[1] === 'NH' ? 'level' : 'points'}`;
  m = /^(Base_Carga|DB)_(\w+)$/.exec(id);
  if (m) return `/encumbrance/levels/${ENCUMBRANCE.findIndex((e) => e[1] === m[2])}/${m[1] === 'DB' ? 'move' : 'maxLoad'}`;
  m = /^Esquiva-(\d)$/.exec(id);
  return m ? `/encumbrance/levels/${m[1]}/dodge` : null;
}

/**
 * The document's self-reported rule status (schema `integrity`, since 1.1), built from the engine-side
 * deviations() check on the document itself — never from a parallel list that could drift from it.
 * A derived value that disagrees with its formula means the mapping lost something: that blocks the save.
 */
function integrityBlock(doc, values, errors, skillIndex, flags, schema, problems) {
  const idByPointer = new Map([...STRICT_FIELDS].map((id) => [pointerFor(id, skillIndex), id]).filter(([ptr]) => ptr));
  const reasons = values[JUSTIFICATIONS] ?? {};
  const found = engineDeviations(schema, doc);
  if (!problems.length) { // rows already reported as problems are left out, which would also skew totals
    for (const d of found.filter((x) => x.reason === 'inconsistent')) {
      problems.push(`Inconsistência interna em ${d.pointer}: as regras dão ${d.expected}, o arquivo teria ${d.actual}. Isto é um erro da planilha — use "Salvar" de novo após recarregar e, se persistir, reporte.`);
    }
  }
  const deviations = found.filter((d) => d.reason === 'override').map(({ pointer, expected, actual }) => {
    const id = idByPointer.get(pointer);
    const why = id ? String(reasons[id] ?? '').trim() : '';
    return { pointer, expected, actual, ...(id ? { sheetField: id, label: fieldLabel(id, values) } : {}), ...(why ? { justification: why } : {}) };
  });
  const issues = errors.Total_Pontos ? [{ code: 'overBudget', pointer: '/points/spent', message: errors.Total_Pontos }] : [];
  return { experimental: Boolean(flags.experimental), rulesCompliant: deviations.length === 0 && issues.length === 0, deviations, issues };
}

// ---------------- Document -> sheet ----------------
/** True when every structured key of `obj` (besides notation) equals what re-parsing its notation yields. */
function reparses(obj, parse, notation = obj.notation) {
  const again = parse(notation);
  return Object.entries(obj).every(([k, val]) => k === 'notation' || again[k] === val);
}

/**
 * Fills sheet values from a schema-valid document.
 * Throws SheetFileError when lists exceed the sheet's rows; returns warnings for anything that will not
 * survive a re-save unchanged, and the file context (locale, currency) to carry into the next save.
 */
export function fromCharacter(doc, layout) {
  const values = {};
  const warnings = [];
  const overflow = [];
  const tables = sheetTables(layout);
  const str = (x) => (typeof x === 'number' ? sheetNumber(x) : String(x));
  const put = (id, x) => { if (x !== null && x !== undefined && x !== '') values[id] = str(x); };
  const fits = (list, max, label) => {
    if (list.length > max) overflow.push(`${label}: a ficha tem ${list.length}, a planilha comporta ${max}.`);
    return list.slice(0, max);
  };

  const p = doc.profile;
  put('Nome', p.name);
  put('Jogador', p.player);
  put('Altura', p.height);
  put('Peso', p.weight);
  put('Idade', p.age);
  if (p.sizeModifier) put('ModificadorTamanho', p.sizeModifier);
  put('Aparência', p.appearance);

  put('Pontos_Gastar', doc.points.budget);
  if (doc.points.breakdown.other) put('Resumo_Pontos5', doc.points.breakdown.other);

  for (const [key, id] of [['st', 'ST'], ['dx', 'DX'], ['iq', 'IQ'], ['ht', 'HT']]) {
    if (doc.attributes[key].value !== 10) put(id, doc.attributes[key].value);
  }
  put('PV_Atual', doc.secondary.hp.current);
  put('PF_Atual', doc.secondary.fp.current);

  const costMods = {};
  const sources = [['ST', doc.attributes.st], ['DX', doc.attributes.dx], ['IQ', doc.attributes.iq], ['HT', doc.attributes.ht],
    ['PV', doc.secondary.hp], ['Vont', doc.secondary.will], ['Per', doc.secondary.per], ['PF', doc.secondary.fp],
    ['Vel_Basica', doc.secondary.basicSpeed], ['Desl_Basico', doc.secondary.basicMove]];
  for (const [id, c] of sources) {
    if (c.costModifiers?.length) costMods[id] = c.costModifiers.map(({ name, percent }) => ({ name, percent }));
  }
  if (Object.keys(costMods).length) values[COST_MODS] = costMods;

  if (doc.techLevel) {
    put('NT', doc.techLevel.level);
    if (doc.techLevel.points) put('Custo_NT', doc.techLevel.points);
  }

  fits(doc.languages ?? [], ROWS.languages, 'Línguas').forEach((l, i) => {
    put(`Lingua${i + 1}`, l.name);
    put(`Falada${i + 1}`, LEVEL_TO_SHEET[l.spoken]);
    put(`Escrita${i + 1}`, LEVEL_TO_SHEET[l.written]);
    put(`Custo_lingua_${i + 1}`, l.points);
  });
  fits(doc.culturalFamiliarities ?? [], ROWS.familiarities, 'Familiaridades culturais').forEach((c, i) => {
    put(`FC${i + 1}`, c.name);
    put(`Custo_FC${i + 1}`, c.points);
  });

  const positive = doc.traits.filter((t) => t.type === 'advantage' || t.type === 'perk');
  const negative = doc.traits.filter((t) => t.type === 'disadvantage' || t.type === 'quirk');
  for (const t of doc.traits) {
    if (t.level !== undefined || t.notes) warnings.push(`"${t.name}": nível/notas não têm lugar na planilha.`);
    const savedAs = t.points === 1 && t.type === 'advantage' ? 'qualidade' : t.points === -1 && t.type === 'disadvantage' ? 'peculiaridade'
      : t.type === 'perk' && t.points !== 1 ? 'vantagem' : t.type === 'quirk' && t.points !== -1 ? 'desvantagem' : null;
    if (savedAs) warnings.push(`"${t.name}" (${t.points} pts) será salvo como ${savedAs}: a planilha decide pelo custo.`);
  }
  fits(positive, ROWS.advantages, 'Vantagens e qualidades').forEach((t, i) => {
    put(`Vantagem${i + 1}`, t.name);
    put(`Custo_Vantagem_${i + 1}`, t.points);
  });
  fits(negative, ROWS.disadvantages, 'Desvantagens e peculiaridades').forEach((t, i) => {
    put(`Desvantagem${i + 1}`, t.name);
    put(`Custo_desvantagem_${i + 1}`, t.points);
  });

  const skills = fits(doc.skills, ROWS.skills, 'Perícias');
  const bonuses = {};
  skills.forEach((s, i) => {
    if (s.bonuses?.length) bonuses[String(i + 1)] = s.bonuses.map(({ name, amount }) => ({ name, amount }));
    put(`Pericia${i + 1}`, s.name);
    put(`NH_Relativo_${i + 1}A`, ATTR_TO_SHEET[s.attribute]);
    put(`NH_Relativo_${i + 1}B`, signedLevel(s.relativeLevel));
    put(`Tipo_${i + 1}`, DIFF_TO_SHEET[s.difficulty]);
    if (s.notes) warnings.push(`Perícia "${s.name}": notas não têm lugar na planilha.`);
  });
  if (Object.keys(bonuses).length) values[SKILL_BONUSES] = bonuses;
  put('Aparar2', doc.defenses.parry.skill);
  put('Bloqueio2', doc.defenses.block.skill);

  fits(doc.damageResistance ?? [], ROWS.dr, 'RD').forEach((d, i) => {
    put(`RD${i + 1}a`, d.location);
    put(`RD${i + 1}b`, d.notes ? `${d.dr} ${d.notes}` : d.dr);
    if (d.locationId && d.locationId !== LOCATION_IDS[strip(d.location)]) {
      warnings.push(`RD "${d.location}": o local normalizado "${d.locationId}" não é deduzível do nome e não será mantido.`);
    }
  });

  const reactions = [...(doc.reactionModifiers ?? [])]; // copy: consumed below, the input must stay intact
  const text = (r) => (r.modifier === null || r.modifier === undefined ? r.description : `${signedModifier(r.modifier)} ${r.description}`);
  const takeFirst = (source, id) => {
    const i = reactions.findIndex((r) => r.source === source);
    if (i >= 0) put(id, text(reactions.splice(i, 1)[0]));
  };
  takeFirst('appearance', 'Reação_Aparencia');
  takeFirst('status', 'Status');
  takeFirst('reputation', 'Reputação1');
  fits(reactions, ROWS.otherReactions, 'Outros modificadores de reação').forEach((r, i) => {
    put(`Reputação${i + 2}`, text(r));
    if (r.source !== 'other') warnings.push(`Modificador de reação "${r.description}": as linhas extras não guardam a origem (${r.source}); será salvo como "other".`);
  });

  /** Writes a notation; when structured parts would be lost, appends the type or warns. */
  const notationFor = (obj, parse, label) => {
    if (reparses(obj, parse)) return obj.notation;
    if (obj.type) {
      const withType = `${obj.notation} ${obj.type}`; // the parser reads English type codes too
      if (reparses({ ...obj, notation: withType }, parse, withType)) return withType;
    }
    warnings.push(`${label} "${obj.notation}": os campos estruturados não correspondem ao texto e serão recalculados a partir dele ao salvar.`);
    return obj.notation;
  };

  const money = (row, item) => {
    put(row.cost[0], item.cost);
    put(row.weight[0], item.weight);
  };
  fits(doc.weapons?.melee ?? [], tables.melee.length, 'Armas corpo a corpo').forEach((w, i) => {
    const row = tables.melee[i];
    put(row.name, w.name);
    (w.damage ?? []).forEach((d, k) => put(row.damage[k], notationFor(d, parseWeaponDamage, `Dano de "${w.name}"`)));
    put(row.reach[0], w.reach);
    if (w.parry) put(row.parry[0], notationFor(w.parry, parseParry, `Aparar de "${w.name}"`));
    put(row.notes[0], w.notes);
    money(row, w);
  });
  fits(doc.weapons?.ranged ?? [], tables.ranged.length, 'Armas à distância').forEach((w, i) => {
    const row = tables.ranged[i];
    put(row.name, w.name);
    if (w.damage) put(row.damage[0], notationFor(w.damage, parseWeaponDamage, `Dano de "${w.name}"`));
    put(row.accuracy[0], w.accuracy);
    if (w.range) put(row.range[0], notationFor(w.range, parseRange, `Distância de "${w.name}"`));
    put(row.rateOfFire[0], w.rateOfFire);
    put(row.shots[0], w.shots);
    put(row.minST[0], w.minST);
    put(row.bulk[0], w.bulk);
    put(row.recoil[0], w.recoil);
    put(row.legalityClass[0], w.legalityClass);
    put(row.notes[0], w.notes);
    money(row, w);
  });
  fits(doc.equipment ?? [], tables.equipment.length, 'Armadura & posses').forEach((item, i) => {
    const row = tables.equipment[i];
    put(row.name, item.name);
    put(row.location[0], item.location);
    money(row, item);
    if (item.notes) warnings.push(`"${item.name}": notas não têm lugar na planilha.`);
  });
  fits(doc.notes ?? [], ROWS.notes, 'Anotações').forEach((t, i) => put(`Anotações${i + 1}`, t));
  if (doc.extensions && Object.keys(doc.extensions).length) {
    warnings.push(`Dados de extensões (${Object.keys(doc.extensions).join(', ')}) não são exibidos na planilha e não serão mantidos.`);
  }

  if (overflow.length) throw new SheetFileError('A ficha não cabe na planilha.', overflow);

  // Overrides: write a computed field only where the document differs from what the sheet computes,
  // group by group in dependency order so each override feeds the next.
  const s = doc.secondary;
  const enc = doc.encumbrance;
  const cost = (id, points) => [id, points, true]; // costs show blank at their default; blank == 0
  // Before 1.2 the ST/HP costs ignored Size: an old file's unmodified cost is recalculated (with a warning), not kept as a deviation.
  const minor = Number(/^1\.(\d+)/.exec(doc.formatVersion ?? '')?.[1] ?? SUPPORTED_MINOR);
  const legacySize = minor < 2 && doc.profile.sizeModifier >= 1;
  let recalculated = false;
  const groups = [
    [['PV', s.hp.value], ['Vont', s.will.value], ['Per', s.per.value], ['PF', s.fp.value], ['Vel_Basica', s.basicSpeed.value]],
    [['Desl_Basico', s.basicMove.value],
      cost('Custo_ST', doc.attributes.st.points), cost('Custo_DX', doc.attributes.dx.points),
      cost('Custo_IQ', doc.attributes.iq.points), cost('Custo_HT', doc.attributes.ht.points),
      cost('Custo_PV', s.hp.points), cost('Custo_Vont', s.will.points), cost('Custo_Per', s.per.points),
      cost('Custo_PF', s.fp.points), cost('Custo_Vel_Basica', s.basicSpeed.points)],
    [['Base_Carga', enc.basicLift], ['Esquiva', doc.defenses.dodge.value], ['Dano_GdP', doc.damage.thrust.notation],
      ['Dano_GeB', doc.damage.swing.notation], cost('Custo_Desl_Basico', s.basicMove.points)],
    [...skills.map((sk, i) => [`NH${i + 1}`, sk.level]),
      ...enc.levels.flatMap((l, i) => [[`Base_Carga_${ENCUMBRANCE[i][1]}`, l.maxLoad], [`DB_${ENCUMBRANCE[i][1]}`, l.move], [ENCUMBRANCE[i][2], l.dodge]])],
    [['Aparar', doc.defenses.parry.value], ['Bloqueio', doc.defenses.block.value],
      ...skills.map((sk, i) => cost(`Custo_Pericia_${i + 1}`, sk.points))],
  ];
  for (const group of groups) {
    const { out, costs } = compute(values);
    for (const [id, want, blankIsZero] of group) {
      if (want === null || want === undefined) continue;
      const have = typeof want === 'number' ? (num(out[id]) ?? (blankIsZero ? 0 : null)) : out[id];
      if (legacySize && (id === 'Custo_ST' || id === 'Custo_PV') && want === costs[id.slice(6)]?.rawCost) {
        if (have !== want) {
          recalculated = true;
          warnings.push(`${fieldLabel(id)} recalculado com o desconto de Tamanho (MT +${doc.profile.sizeModifier}), regra adotada na versão 1.2 do formato: ${want} → ${have} pts.`);
        }
        continue;
      }
      if (have !== want) values[id] = str(want);
    }
  }
  // Justifications: matched by sheetField, else by pointer (files from other writers); kept only for real deviations.
  const skillIndex = Object.fromEntries(skills.map((_, i) => [String(i + 1), i]));
  const byPointer = Object.fromEntries([...STRICT_FIELDS].map((id) => [pointerFor(id, skillIndex), id]).filter(([ptr]) => ptr));
  const final = compute(values); // justifications don't affect the rules: one computation serves every check below
  const found = sheetDeviations(values, final.out);
  const deviating = new Set(found.map((d) => d.id));
  const reasons = {};
  for (const d of doc.integrity?.deviations ?? []) {
    if (!d.justification) continue;
    const id = STRICT_FIELDS.has(d.sheetField) && pointerFor(d.sheetField, skillIndex) === d.pointer ? d.sheetField : byPointer[d.pointer];
    if (id && deviating.has(id)) reasons[id] = d.justification;
    else warnings.push(`Justificativa "${d.justification}" ignorada: ${d.label ?? d.pointer} não está fora das regras nesta ficha.`);
  }
  if (Object.keys(reasons).length) values[JUSTIFICATIONS] = reasons;

  // A file is never trusted about its own compliance or totals: recompute and compare with what it claims.
  if (doc.integrity?.rulesCompliant) {
    if (found.length) warnings.push(`O arquivo se declarava dentro das regras, mas tem ${found.length} desvio(s): ${found.map((d) => fieldLabel(d.id, values)).join(', ')}.`);
    const issues = sheetIssues(values, final.out, final.errors);
    if (issues.length) warnings.push(`O arquivo se declarava dentro das regras, mas: ${issues.map((i) => i.message).join(' ')}`);
  }
  const totals = [
    ['Total de Pontos', doc.points.spent, 'Total_Pontos'], ['Atributos', doc.points.breakdown.attributes, 'Resumo_Pontos1'],
    ['Vantagens', doc.points.breakdown.advantages, 'Resumo_Pontos2'], ['Desvantagens', doc.points.breakdown.disadvantages, 'Resumo_Pontos3'],
    ['Perícias', doc.points.breakdown.skills, 'Resumo_Pontos4'],
    ['Custo total', doc.possessionsTotal?.cost, 'Preço_Total'], ['Peso total', doc.possessionsTotal?.weight, 'Peso_Total'],
  ].filter(([, inFile, id]) => typeof inFile === 'number' && Math.abs(inFile - (num(final.out[id]) ?? 0)) > 0.005 + 1e-9); // sheet totals display 2 decimals
  if (totals.length && !recalculated) {
    warnings.push(`Totais do arquivo diferentes dos calculados pelas regras (${totals.map(([label, inFile, id]) => `${label}: arquivo ${inFile}, regras ${num(final.out[id]) ?? 0}`).join('; ')}); a ficha usa os valores calculados.`);
  }
  return {
    values,
    warnings,
    createdAt: doc.meta?.createdAt,
    context: { locale: doc.meta?.locale, currency: doc.ruleset?.currency },
    flags: { experimental: doc.integrity?.experimental === true },
  };
}

// ---------------- Validation & file parsing ----------------
const TYPE_NAMES = { integer: 'um número inteiro', number: 'um número', string: 'um texto', object: 'um objeto', array: 'uma lista', boolean: 'verdadeiro/falso', null: 'vazio' };
const FIELD_PT = {
  name: 'nome', points: 'custo', type: 'tipo', value: 'valor', base: 'base', current: 'atual', level: 'NH', relativeLevel: 'NH relativo',
  attribute: 'atributo', difficulty: 'dificuldade', spoken: 'falada', written: 'escrita', dr: 'RD', location: 'local', notes: 'notas',
  damage: 'dano', notation: 'notação', reach: 'alcance', parry: 'aparar', cost: 'custo', weight: 'peso', accuracy: 'precisão',
  range: 'distância', rateOfFire: 'CdT', shots: 'tiros', minST: 'ST', bulk: 'magnitude', recoil: 'RCO', legalityClass: 'CL',
  maxLoad: 'peso máximo', move: 'deslocamento', dodge: 'esquiva', skill: 'perícia', modifier: 'modificador', description: 'descrição',
};

/**
 * Ajv errors -> pt-BR messages. With `labels` (from toCharacter) locations are sheet rows
 * ("Desvantagens, linha 1 › custo"); without, they are document paths ("skills › #2 › difficulty").
 */
export function formatAjvErrors(errors = [], labels = null) {
  const seen = new Set();
  const messages = [];
  const decode = (s) => s.replace(/~1/g, '/').replace(/~0/g, '~');
  const docPath = (pointer) => pointer.slice(1).split('/').map((s) => (/^\d+$/.test(s) ? `#${Number(s) + 1}` : decode(s))).join(' › ');
  const sheetPath = (pointer) => {
    const prefix = Object.keys(labels).filter((k) => pointer === k || pointer.startsWith(`${k}/`)).sort((a, b) => b.length - a.length)[0];
    if (!prefix) return docPath(pointer);
    const rest = pointer.slice(prefix.length).split('/').filter(Boolean).map((s) => FIELD_PT[decode(s)] ?? (/^\d+$/.test(s) ? `#${Number(s) + 1}` : decode(s)));
    return [labels[prefix], ...rest].join(' › ');
  };
  for (const e of errors) {
    if (e.keyword === 'propertyNames' || e.keyword === 'if') continue; // the specific child error is reported too
    const pointer = e.pointer ?? '';
    const where = !pointer ? (labels ? 'ficha' : 'raiz do arquivo') : labels ? sheetPath(pointer) : docPath(pointer);
    const p = e.params ?? {};
    const types = [].concat(p.type ?? []).map((t) => TYPE_NAMES[t] ?? t).join(' ou ');
    let msg = {
      required: `falta o campo obrigatório "${p.missingProperty}"`,
      additionalProperties: `campo desconhecido "${p.additionalProperty}"`,
      type: `deveria ser ${types}`,
      enum: `valor inválido; use um de: ${(p.allowedValues ?? []).join(', ')}`,
      const: `deveria ser ${JSON.stringify(p.allowedValue)}`,
      pattern: 'formato inválido',
      format: `formato de ${p.format} inválido`,
      minimum: `deve ser ${p.comparison} ${p.limit}`,
      maximum: `deve ser ${p.comparison} ${p.limit}`,
      exclusiveMinimum: `deve ser ${p.comparison} ${p.limit}`,
      exclusiveMaximum: `deve ser ${p.comparison} ${p.limit}`,
      minLength: 'não pode ficar vazio',
      maxLength: `no máximo ${p.limit} caracteres`,
      minItems: `no mínimo ${p.limit} itens`,
      maxItems: `no máximo ${p.limit} itens`,
      multipleOf: `deve ser múltiplo de ${p.multipleOf}`,
      uniqueItems: 'itens repetidos',
      oneOf: 'não corresponde a nenhuma forma aceita',
      anyOf: 'não corresponde a nenhuma forma aceita',
    }[e.keyword] ?? 'valor inválido';
    if (e.propertyName !== undefined) msg = `nome de chave "${e.propertyName}" inválido`;
    const text = `${where}: ${msg}.`;
    if (!seen.has(text)) {
      seen.add(text);
      messages.push(text);
    }
  }
  return messages;
}

/**
 * Validates a document with the library and reports problems in pt-BR, by sheet row when `labels` is given.
 * @param {typeof import('@gurps-sheet/character')} lib the (lazily imported) library
 * @returns {{ valid: boolean, problems: string[] }}
 */
export function checkSchema(lib, doc, labels = null) {
  const { valid, errors } = lib.validateCharacter(doc);
  return { valid, problems: formatAjvErrors(errors, labels) };
}

/** Library error (coded, English) -> sheet error (pt-BR, for the problems dialog). */
function sheetError(err) {
  const d = err.details ?? {};
  switch (err.code) {
    case 'tooLarge':
      return new SheetFileError('Arquivo grande demais.', [`O arquivo tem ${Math.round(d.size / 1024)} KB; uma ficha tem poucos KB (limite ${d.limit / 1_000_000} MB).`]);
    case 'invalidJson':
      return new SheetFileError('O arquivo não é um JSON válido.', [d.line ? `Erro de sintaxe JSON na linha ${d.line}, coluna ${d.column}.`
        : d.truncated ? 'O arquivo termina antes do fim do JSON (está incompleto).' : 'Erro de sintaxe JSON.']);
    case 'notAnObject':
      return new SheetFileError('Este arquivo não é uma ficha GURPS.', ['O conteúdo deveria ser um objeto JSON com "format": "gurps-character".']);
    case 'legacyFormat':
      return new SheetFileError('Formato antigo não suportado.', ['Este arquivo usa o formato antigo "gurps-sheet", que não é mais aceito. Só fichas no formato "gurps-character" podem ser abertas.']);
    case 'wrongFormat':
      return new SheetFileError('Este arquivo não é uma ficha GURPS.', [`O campo "format" deveria ser "${FORMAT}" (encontrado: ${JSON.stringify(d.format ?? null)}).`]);
    case 'unsupportedVersion':
      return new SheetFileError('Versão da ficha não suportada.', [`Esta planilha lê a versão ${d.supported} do formato; o arquivo é da versão ${JSON.stringify(d.formatVersion ?? null)}.`]);
    case 'newerVersion':
      return new SheetFileError('Ficha criada por uma versão mais nova.', [`O arquivo usa a versão ${d.formatVersion} do formato, mais nova que a ${d.supported} que esta planilha entende. Atualize a planilha para abri-lo.`]);
    case 'schema':
      return new SheetFileError('A ficha não segue o esquema gurps-character.', formatAjvErrors(d.errors));
    default:
      return new SheetFileError('Não foi possível abrir a ficha.', [err.message]);
  }
}

/**
 * Parses, validates and maps a sheet file. Loading itself (size, JSON, format, version, schema) is the library's
 * parseCharacter(); this adds the pt-BR messages and the sheet mapping.
 * @param {typeof import('@gurps-sheet/character')} lib the (lazily imported) library
 * @throws {SheetFileError} with user-facing problems
 */
export function parseCharacterFile(text, lib, layout) {
  let loaded;
  try {
    loaded = lib.parseCharacter(text, { maxBytes: MAX_FILE_BYTES });
  } catch (err) {
    throw err instanceof lib.CharacterError ? sheetError(err) : err;
  }
  return fromCharacter(loaded.character, layout);
}
