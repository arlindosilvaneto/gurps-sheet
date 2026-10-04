// GURPS 4e cost/derived-stat rules, ported from the XFA calculate scripts of
// "Planilha Personagem Editavel v2.12 GURPS 4ed.pdf". Pure functions only — no DOM.
//
// Model: `values` is a flat map { fieldId: string } of what the user typed. Every id in
// COMPUTED is auto-calculated, but (like the XFA override="warning" fields) a non-empty
// user value overrides it, and downstream rules use that override.

export const ATTRS = ['ST', 'DX', 'IQ', 'HT', 'Vont', 'Per'];
export const SKILL_ROWS = 25;
export const ITEM_ROWS = 49; // Preço/Peso rows on page 2 (5 melee + 10 ranged + 34 armour/possessions)

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

// Shown but never user-editable.
export const READ_ONLY = new Set([
  'Total_Pontos', 'Resumo_Pontos1', 'Resumo_Pontos2', 'Resumo_Pontos3', 'Resumo_Pontos4',
  'Nome_p2', 'Preço_Total', 'Peso_Total',
]);

export const ATTR_DEFAULT = 10; // a blank primary attribute is the free human average

export const COMPUTED = new Set([
  'ST', 'DX', 'IQ', 'HT',
  'PV', 'Vont', 'Per', 'PF', 'Vel_Basica', 'Desl_Basico',
  'Custo_ST', 'Custo_DX', 'Custo_IQ', 'Custo_HT', 'Custo_PV', 'Custo_Vont', 'Custo_Per', 'Custo_PF',
  'Custo_Vel_Basica', 'Custo_Desl_Basico',
  'Base_Carga', 'Base_Carga_Nenhuma', 'Base_Carga_Leve', 'Base_Carga_Media', 'Base_Carga_Pesada', 'Base_Carga_Mto_Pesada',
  'DB_Nenhuma', 'DB_Leve', 'DB_Media', 'DB_Pesada', 'DB_Mto_Pesada',
  'Esquiva', 'Esquiva-1', 'Esquiva-2', 'Esquiva-3', 'Esquiva-4',
  'Dano_GdP', 'Dano_GeB', 'Aparar', 'Bloqueio',
  ...range(SKILL_ROWS).flatMap((i) => [`NH${i}`, `Custo_Pericia_${i}`]),
  ...READ_ONLY,
]);

/** Parses user text as a number; accepts pt-BR decimal comma and a leading '+'. Blank/invalid -> null. */
export function num(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim().replace(',', '.').replace(/^\+/, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Formats a number for the sheet: integers plain, fractions with pt-BR comma (max 2 places). */
export function fmt(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

// Damage table (Módulo Básico p.16). Index = ST for 1..40; above 40 the sheet steps every 5 ST.
const THRUST = ['', '1d-6', '1d-6', '1d-5', '1d-5', '1d-4', '1d-4', '1d-3', '1d-3', '1d-2', '1d-2',
  '1d-1', '1d-1', '1d', '1d', '1d+1', '1d+1', '1d+2', '1d+2', '2d-1', '2d-1',
  '2d', '2d', '2d+1', '2d+1', '2d+2', '2d+2', '3d-1', '3d-1', '3d', '3d',
  '3d+1', '3d+1', '3d+2', '3d+2', '4d-1', '4d-1', '4d', '4d', '4d+1', '4d+1'];
const SWING = ['', '1d-5', '1d-5', '1d-4', '1d-4', '1d-3', '1d-3', '1d-2', '1d-2', '1d-1', '1d',
  '1d+1', '1d+2', '2d-1', '2d', '2d+1', '2d+2', '3d-1', '3d', '3d+1', '3d+2',
  '4d-1', '4d', '4d+1', '4d+2', '5d-1', '5d', '5d+1', '5d+1', '5d+2', '5d+2',
  '6d-1', '6d-1', '6d', '6d', '6d+1', '6d+1', '6d+2', '6d+2', '7d-1', '7d-1'];
const THRUST_HI = { 45: '5d', 50: '5d+2', 55: '6d', 60: '7d-1', 65: '7d+1', 70: '8d', 75: '8d+1', 80: '9d', 85: '9d+2', 90: '10d', 95: '10d+2', 100: '11d' };
const SWING_HI = { 45: '7d+1', 50: '8d-1', 55: '8d+1', 60: '9d', 65: '9d+2', 70: '10d', 75: '10d+2', 80: '11d', 85: '11d+2', 90: '12d', 95: '12d+1', 100: '13d' };

/** Returns [thrust (GdP), swing (GeB)] for a ST score, or ['', ''] when ST is blank/invalid. */
export function damage(st) {
  if (st === null || st < 1) return ['', ''];
  const s = Math.floor(st);
  if (s <= 40) return [THRUST[s], SWING[s]];
  if (s <= 100) {
    const step = Math.floor(s / 5) * 5;
    return [THRUST_HI[step] ?? THRUST[40], SWING_HI[step] ?? SWING[40]];
  }
  const extra = Math.floor((s - 100) / 10); // +1d per full 10 ST above 100 (Módulo Básico p.16)
  return [`${11 + extra}d`, `${13 + extra}d`];
}

// Difficulty -> offset that normalises a skill's relative level to the Average (M) cost curve.
const DIFFICULTY = { F: -1, E: -1, M: 0, A: 0, D: 1, H: 1, MD: 2, VH: 2 };

/**
 * Skill point cost from relative level + difficulty (F/M/D/MD, also E/A/H/VH).
 * Returns { cost, error } — cost null when difficulty blank; error when level is below the minimum.
 */
export function skillCost(rel, tipo) {
  const off = DIFFICULTY[String(tipo ?? '').trim().toUpperCase()];
  if (off === undefined) return { cost: null, error: null };
  const nn = (rel ?? 0) + off;
  if (nn < -1) return { cost: null, error: 'O Valor do NH Relativo é menor que o permitido.' };
  if (nn === -1) return { cost: 1, error: null };
  if (nn === 0) return { cost: 2, error: null };
  return { cost: Math.floor(nn * 4), error: null };
}

/** Basic Lift ("Base de Carga", kg) = ST×ST/10; rounded to whole kg once it reaches 10. */
export function basicLift(st) {
  if (st === null) return null;
  const bl = (st * st) / 10;
  return bl >= 10 ? Math.round(bl) : Math.round(bl * 10) / 10;
}

const sum = (xs) => xs.reduce((a, x) => a + (x ?? 0), 0);

/**
 * Computes every COMPUTED field.
 * @param {Record<string,string>} values user input (including overrides of computed fields)
 * @returns {{ out: Record<string,string>, errors: Record<string,string> }} display strings for computed ids
 */
export function compute(values) {
  const out = {};
  const errors = {};
  const raw = (id) => values[id] ?? '';
  const overridden = (id) => COMPUTED.has(id) && !READ_ONLY.has(id) && String(raw(id)).trim() !== '';
  // Effective numeric value: override if present, else computed, else plain input.
  const eff = (id) => num(overridden(id) || !COMPUTED.has(id) ? raw(id) : out[id]);
  const set = (id, v) => { out[id] = typeof v === 'number' ? fmt(v) : (v ?? ''); };

  // Every attribute defaults to a base value that costs nothing; buying it up/down costs per level.
  // Cost is blank at the default (free), like the XFA secondary-characteristic costs.
  const characteristic = (id, base, perLevel) => {
    set(id, base);
    const v = eff(id);
    set(`Custo_${id}`, base === null || v === null || v === base ? null : (v - base) * perLevel);
    return v;
  };
  // Primary attributes: default 10; ST/HT 10 pts/level, DX/IQ 20 pts/level.
  const ST = characteristic('ST', ATTR_DEFAULT, 10);
  const DX = characteristic('DX', ATTR_DEFAULT, 20);
  const IQ = characteristic('IQ', ATTR_DEFAULT, 20);
  const HT = characteristic('HT', ATTR_DEFAULT, 10);

  // Secondary characteristics default from the (effective) attributes.
  characteristic('PV', ST, 2);
  characteristic('Vont', IQ, 5);
  characteristic('Per', IQ, 5);
  characteristic('PF', HT, 3);
  // Basic Speed: (DX+HT)/4, 20 pts per +1.0 (5 per +0.25).
  characteristic('Vel_Basica', DX === null || HT === null ? null : (DX + HT) / 4, 20);
  const speed = eff('Vel_Basica');
  // Basic Move: floor(Basic Speed), 5 pts per +1.
  characteristic('Desl_Basico', speed === null ? null : Math.floor(speed), 5);
  const move = eff('Desl_Basico');

  // Encumbrance table.
  set('Base_Carga', basicLift(ST));
  const bl = eff('Base_Carga'); // a typed BC (e.g. from Lifting ST) drives the "= BC, 2xBC…" rows
  const levels = [['Nenhuma', 1, 1], ['Leve', 2, 0.8], ['Media', 3, 0.6], ['Pesada', 6, 0.4], ['Mto_Pesada', 10, 0.2]];
  for (const [name, blMult, moveMult] of levels) {
    set(`Base_Carga_${name}`, bl === null ? null : Math.round(bl * blMult * 10) / 10);
    set(`DB_${name}`, move === null ? null : Math.floor(move * moveMult));
  }
  // Dodge = floor(Basic Speed) + 3, minus encumbrance level.
  set('Esquiva', speed === null ? null : Math.floor(speed) + 3);
  const dodge = eff('Esquiva');
  for (let i = 1; i <= 4; i++) set(`Esquiva-${i}`, dodge === null ? null : dodge - i);

  const [gdp, geb] = damage(ST);
  set('Dano_GdP', gdp);
  set('Dano_GeB', geb);

  // Skills: NH = attribute (effective, so bought-up Per/Vont count) + relative level.
  const attrByName = Object.fromEntries(ATTRS.map((a) => [a.toUpperCase(), a]));
  for (let i = 1; i <= SKILL_ROWS; i++) {
    const attr = attrByName[String(raw(`NH_Relativo_${i}A`)).trim().toUpperCase()];
    const rel = num(raw(`NH_Relativo_${i}B`));
    const base = attr ? eff(attr) : null;
    set(`NH${i}`, base === null ? null : base + (rel ?? 0));
    const { cost, error } = skillCost(rel, raw(`Tipo_${i}`));
    set(`Custo_Pericia_${i}`, cost);
    if (error) errors[`Custo_Pericia_${i}`] = error;
  }

  // Parry/Block: 3 + NH/2 (round down) of the skill named in the field under each box.
  const skillNh = (name) => {
    const key = String(name ?? '').trim().toLowerCase();
    if (!key) return null;
    for (let i = 1; i <= SKILL_ROWS; i++) {
      if (String(raw(`Pericia${i}`)).trim().toLowerCase() === key) return eff(`NH${i}`);
    }
    return null;
  };
  const defense = (nh) => (nh === null ? null : Math.floor(nh / 2) + 3);
  set('Aparar', defense(skillNh(raw('Aparar2'))));
  set('Bloqueio', defense(skillNh(raw('Bloqueio2'))));

  // Point summary (page 2 "Resumo dos Pontos"); blank when zero, like the original.
  const blankZero = (n) => (n === 0 ? null : n);
  const r1 = sum(['ST', 'DX', 'IQ', 'HT', 'PV', 'Vont', 'Per', 'PF', 'Vel_Basica', 'Desl_Basico'].map((a) => eff(`Custo_${a}`)));
  const r2 = sum([
    'Custo_NT', 'Custo_FC1', 'Custo_FC2', 'Custo_FC3',
    ...range(12).map((i) => `Custo_Vantagem_${i}`),
    ...range(5).map((i) => `Custo_lingua_${i}`),
  ].map(eff));
  const r3 = sum(range(13).map((i) => eff(`Custo_desvantagem_${i}`)));
  const r4 = sum(range(SKILL_ROWS).map((i) => eff(`Custo_Pericia_${i}`)));
  const r5 = num(raw('Resumo_Pontos5'));
  set('Resumo_Pontos1', blankZero(r1));
  set('Resumo_Pontos2', blankZero(r2));
  set('Resumo_Pontos3', blankZero(r3));
  set('Resumo_Pontos4', blankZero(r4));
  // Total = points spent. "Pontos p/ Gastar" is the campaign budget (plain input), not added in.
  const spent = r1 + r2 + r3 + r4 + (r5 ?? 0);
  set('Total_Pontos', blankZero(spent));
  const budget = num(raw('Pontos_Gastar'));
  if (budget !== null && spent > budget) {
    errors.Total_Pontos = `Pontos gastos (${fmt(spent)}) excedem o orçamento (${fmt(budget)}) em ${fmt(spent - budget)}.`;
  }

  set('Nome_p2', raw('Nome'));
  set('Preço_Total', blankZero(sum(range(ITEM_ROWS).map((i) => num(raw(`Preço${i}`))))));
  set('Peso_Total', blankZero(sum(range(ITEM_ROWS).map((i) => num(raw(`Peso${i}`))))));

  return { out, errors };
}

/** What a field shows: user value for inputs/overrides, otherwise the computed value. */
export function display(id, values, out) {
  const v = values[id] ?? '';
  if (!COMPUTED.has(id)) return v;
  if (!READ_ONLY.has(id) && String(v).trim() !== '') return v;
  return out[id] ?? '';
}
