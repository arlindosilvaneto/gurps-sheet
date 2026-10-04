// Sheet health: which calculated fields may be overridden freely, and which overrides drift from the rules.
// Pure module (no DOM) shared by the editor (main.js), the file mapping (character.js) and tests.

import { COMPUTED, READ_ONLY, num, ROWS, range, JUSTIFICATIONS, isOverridden } from './rules.js';

export { isOverridden };

/**
 * Calculated fields whose override is priced by a cost formula — buying them up/down is legitimate.
 * Must match the schema's `x-gurps.override: "paid"` nodes (primary attributes are plain inputs there).
 */
export const PAID_OVERRIDES = new Set(['ST', 'DX', 'IQ', 'HT', 'PV', 'Vont', 'Per', 'PF', 'Vel_Basica', 'Desl_Basico']);

/** Calculated fields with no cost behind an override: editing needs confirmation and makes the sheet deviate. */
export const STRICT_FIELDS = new Set([...COMPUTED].filter((id) => !READ_ONLY.has(id) && !PAID_OVERRIDES.has(id)));

const isCost = (id) => id.startsWith('Custo_');

/** Equal for rule purposes: numerically when both are numbers; a blank cost counts as 0 (costs show blank at default). */
export function sameValue(id, a, b) {
  const blank = isCost(id) ? 0 : null;
  const x = String(a ?? '').trim() === '' ? blank : num(a);
  const y = String(b ?? '').trim() === '' ? blank : num(b);
  if (x !== null && y !== null) return Math.abs(x - y) < 1e-9;
  return String(a ?? '').trim() === String(b ?? '').trim();
}


/**
 * Strict fields whose typed value differs from what the rules compute.
 * @returns {Array<{ id: string, expected: string, actual: string, justification?: string }>} expected/actual as shown on the sheet
 */
export function sheetDeviations(values, out) {
  return [...STRICT_FIELDS]
    .filter((id) => isOverridden(id, values) && !sameValue(id, values[id], out[id]))
    .map((id) => {
      const d = { id, expected: out[id] ?? '', actual: String(values[id]).trim() };
      const why = String(values[JUSTIFICATIONS]?.[id] ?? '').trim();
      if (why) d.justification = why;
      return d;
    });
}

/** Rule violations that are not single-field drift. */
export function sheetIssues(values, out, errors) {
  const issues = [];
  if (errors.Total_Pontos) issues.push({ code: 'overBudget', id: 'Total_Pontos', message: errors.Total_Pontos });
  for (const i of range(ROWS.skills)) {
    const err = errors[`Custo_Pericia_${i}`];
    if (err) issues.push({ code: 'skillBelowMinimum', id: `Custo_Pericia_${i}`, message: `${fieldLabel(`Custo_Pericia_${i}`, values)}: ${err}` });
  }
  return issues;
}

const LEVEL_NAMES = { Nenhuma: 'Nenhuma', Leve: 'Leve', Media: 'Média', Pesada: 'Pesada', Mto_Pesada: 'Muito Pesada' };
const DODGE_LEVELS = ['Leve', 'Média', 'Pesada', 'Muito Pesada'];
/** pt-BR names of the costed characteristics (shared by the panel labels and the adjust dialog). */
export const CHARACTERISTIC_LABELS = { ST: 'ST', DX: 'DX', IQ: 'IQ', HT: 'HT', PV: 'PV', Vont: 'Vontade', Per: 'Percepção', PF: 'PF', Vel_Basica: 'Velocidade Básica', Desl_Basico: 'Deslocamento Básico' };
const FIXED_LABELS = {
  ...Object.fromEntries(Object.entries(CHARACTERISTIC_LABELS).map(([id, label]) => [`Custo_${id}`, `Custo de ${label}`])),
  Base_Carga: 'Base de Carga', Esquiva: 'Esquiva', Aparar: 'Aparar', Bloqueio: 'Bloqueio',
  Dano_GdP: 'Dano GdP', Dano_GeB: 'Dano GeB', Total_Pontos: 'Total de Pontos',
};

/** pt-BR label for a field id, naming the skill row where relevant. */
export function fieldLabel(id, values = {}) {
  if (FIXED_LABELS[id]) return FIXED_LABELS[id];
  let m = /^(NH|Custo_Pericia_)(\d+)$/.exec(id);
  if (m) {
    const name = String(values[`Pericia${m[2]}`] ?? '').trim();
    return `${m[1] === 'NH' ? 'NH' : 'Custo'} da perícia, linha ${m[2]}${name ? ` (${name})` : ''}`;
  }
  m = /^(Base_Carga|DB)_(\w+)$/.exec(id);
  if (m) return `${m[1] === 'DB' ? 'Deslocamento' : 'Peso máximo'} com carga ${LEVEL_NAMES[m[2]]}`;
  m = /^Esquiva-(\d)$/.exec(id);
  if (m) return `Esquiva com carga ${DODGE_LEVELS[Number(m[1]) - 1]}`;
  return id;
}
