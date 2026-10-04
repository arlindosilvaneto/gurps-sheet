import './style.css';
import layout from './layout.json';
import labels from './labels.json';
import { compute, display, fmt, COMPUTED, READ_ONLY, ATTRS, COSTED, COST_MODS, SKILL_BONUSES, JUSTIFICATIONS, MIN_COST_MULTIPLIER } from './rules.js';
import { resolveHelp } from './help.js';
import { toCharacter, parseCharacterFile, SheetFileError, MAX_FILE_BYTES } from './character.js';
import { STRICT_FIELDS, sheetDeviations, sheetIssues, sameValue, isOverridden, fieldLabel, CHARACTERISTIC_LABELS } from './integrity.js';
import { version } from '../package.json';

const STORAGE_KEY = 'gurps-sheet:v1';
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const HELP_KEY = 'gurps-sheet:help';
const PANEL_KEY = 'gurps-sheet:integrity-open';
const [PAGE_W, PAGE_H] = layout.pageSize;
const BASE = import.meta.env.BASE_URL;

// Suggestion lists for the small coded columns of the skills table.
const DATALISTS = {
  attrs: ATTRS,
  tipos: ['F', 'M', 'D', 'MD'],
  niveis: ['Nativo', 'Sotaque', 'Rudimentar', 'Nenhum'],
};
const listFor = (id) => (/^NH_Relativo_\d+A$/.test(id) ? 'attrs'
  : /^Tipo_\d+$/.test(id) ? 'tipos'
    : /^(Falada|Escrita)\d+$/.test(id) ? 'niveis' : null);

// Browser autosave is the app's internal draft (tolerant of half-typed values); files use the gurps-character schema.
// `context` keeps a loaded file's locale/currency so re-saving doesn't overwrite them;
// `flags.experimental` relaxes the rule guards (no confirmations) and is exported for engines.
let { values, createdAt, context, flags } = load();
let computed = { out: {}, errors: {} };
const inputs = new Map();
const unlocked = new Set(); // strict fields the user confirmed editing in this session

function load() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { values: draft?.values ?? {}, createdAt: draft?.createdAt, context: draft?.context ?? {}, flags: draft?.flags ?? {} };
  } catch {
    return { values: {}, createdAt: undefined, context: {}, flags: {} };
  }
}

let saveTimer;
/** Debounced autosave; `quiet` keeps the current status message (e.g. "Ficha salva") instead of overwriting it. */
function save({ quiet = false } = {}) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ values, createdAt, context, flags }));
      if (!quiet) setStatus('Salvo neste navegador');
    } catch {
      setStatus('Não foi possível salvar no navegador — use "Salvar ficha"');
    }
  }, 300);
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

/** Strict (cost-less) calculated fields stay read-only until confirmed, overridden, or experimental mode is on. */
const isLocked = (id) => STRICT_FIELDS.has(id) && !flags.experimental && !isOverridden(id, values) && !unlocked.has(id);

/** Recomputes everything and repaints every field except the one being typed in. */
function refresh(skip) {
  computed = compute(values);
  const deviations = new Map(sheetDeviations(values, computed.out).map((d) => [d.id, d]));
  for (const [id, el] of inputs) {
    const overridden = isOverridden(id, values);
    if (el !== skip) el.value = display(id, values, computed.out);
    el.classList.toggle('override', overridden);
    el.classList.toggle('deviation', deviations.has(id));
    const err = computed.errors[id];
    el.classList.toggle('error', Boolean(err));
    el.dataset.error = err ?? '';
    el.dataset.override = overridden ? '1' : '';
    el.dataset.deviation = deviations.has(id) ? (deviations.get(id).expected || '—') : '';
    if (STRICT_FIELDS.has(id) && el !== skip) { // never relock the field being typed in
      el.readOnly = isLocked(id);
      el.classList.toggle('locked', el.readOnly);
    }
    if (isAdjustable(id)) {
      const nh = NH_FIELD.exec(id);
      el.classList.toggle('adjusted', nh ? (computed.skills[nh[1]]?.bonuses.length ?? 0) > 0 : (computed.costs[costedId(id)]?.modifiers.length ?? 0) > 0);
    }
  }
  renderIntegrity(deviations);
}

// ---- Integrity panel: every deviation from the rules, plus rule issues ----
let integritySignature = '';
function renderIntegrity(deviations) {
  const panel = document.getElementById('integrity');
  const issues = sheetIssues(values, computed.out, computed.errors);
  const labels = [...deviations.keys()].map((id) => fieldLabel(id, values)); // labels carry skill names
  const signature = JSON.stringify([[...deviations.values()], issues, labels, Boolean(flags.experimental)]);
  if (signature === integritySignature) return; // nothing changed: skip the DOM rebuild on this keystroke
  integritySignature = signature;
  const devs = [...deviations.values()];
  const justified = devs.filter((d) => d.justification).length;
  const pending = devs.length - justified + issues.length;
  const badge = panel.querySelector('.badge');
  const parts = [pending && `${pending} pendência${pending > 1 ? 's' : ''}`, justified && `${justified} justificada${justified > 1 ? 's' : ''}`].filter(Boolean);
  badge.textContent = flags.experimental ? 'Modo experimental' : parts.length ? parts.join(' · ') : 'Dentro das regras';
  badge.className = `badge ${flags.experimental ? 'exp' : pending ? 'warn' : justified ? 'justified' : 'ok'}`;
  panel.querySelector('.mode').hidden = !flags.experimental;

  const li = (cls, html) => Object.assign(document.createElement('li'), { className: cls, innerHTML: html });
  const goto = (id) => `<button type="button" data-action="goto" data-id="${esc(id)}">Ir até o campo</button>`;
  const items = [
    ...[...devs.filter((d) => !d.justification), ...devs.filter((d) => d.justification)].map((d) => li(d.justification ? 'deviation justified' : 'deviation',
      `<span><strong>${esc(fieldLabel(d.id, values))}</strong>: as regras dão <b>${esc(d.expected || '—')}</b>, a ficha mostra <b>${esc(d.actual)}</b>.`
      + (d.justification ? `<span class="why">Justificativa: ${esc(d.justification)}</span>` : '') + `</span>
      <span class="actions">${isAdjustable(d.id) ? `<button type="button" data-action="adjust" data-id="${esc(d.id)}">${COST_FIELD.test(d.id) ? 'Ajustar custo' : 'Ajustar NH'}</button>` : ''}`
      + `<button type="button" data-action="justify" data-id="${esc(d.id)}">${d.justification ? 'Editar justificativa' : 'Justificar'}</button>`
      + `${goto(d.id)}<button type="button" data-action="restore" data-id="${esc(d.id)}">Restaurar cálculo</button></span>`)),
    ...issues.map((i) => li('issue', `<span>${esc(i.message)}</span><span class="actions">${goto(i.id)}</span>`)),
  ];
  if (!items.length) items.push(li('empty', 'Nenhum desvio: todos os campos calculados seguem as regras.'));
  panel.querySelector('.items').replaceChildren(...items);
}

function wireIntegrity() {
  const panel = document.getElementById('integrity');
  try {
    panel.open = localStorage.getItem(PANEL_KEY) !== '0';
  } catch { /* default open */ }
  panel.addEventListener('toggle', () => {
    try {
      localStorage.setItem(PANEL_KEY, panel.open ? '1' : '0');
    } catch { /* preference only */ }
  });
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const el = inputs.get(btn.dataset.id);
    if (btn.dataset.action === 'adjust') {
      openAdjustDialog(btn.dataset.id);
      return;
    }
    if (btn.dataset.action === 'justify') {
      const id = btn.dataset.id;
      askJustification(id).then((text) => {
        if (text === null) return;
        setJustification(id, text);
        refresh();
        save();
      });
      return;
    }
    if (btn.dataset.action === 'restore') restoreField(btn.dataset.id);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
      el.classList.remove('flash');
      void el.offsetWidth; // restart the animation
      el.classList.add('flash');
    }
  });
  const toggle = document.getElementById('experimental-toggle');
  toggle.checked = Boolean(flags.experimental);
  document.body.classList.toggle('experimental', Boolean(flags.experimental));
  toggle.addEventListener('change', () => {
    flags = { ...flags, experimental: toggle.checked };
    document.body.classList.toggle('experimental', toggle.checked);
    refresh();
    save();
  });
}

// ---- "Ajustar": cost modifiers (characteristic purchases) and NH bonuses (skills) — rule-backed adjustments ----
const COST_FIELD = new RegExp(`^Custo_(${COSTED.join('|')})$`);
const NH_FIELD = /^NH(\d+)$/;
const isAdjustable = (id) => COST_FIELD.test(id) || NH_FIELD.test(id);
const costedId = (costId) => costId.replace(/^Custo_/, '');
const signedPercent = (p) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`;
const signedNumber = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;
const costFormula = (c) => (c.applies ? `⌈${fmt(c.rawCost)} × ${fmt(c.multiplier * 100)}%⌉ = ${fmt(c.cost)} pts` : `${fmt(c.rawCost)} pts`);
const parseInteger = (text) => Number(String(text).trim().replace('−', '-').replace('%', '').replace(/^\+/, ''));
let adjustField = null;

/** Updates one list inside a values map key (costModifiers / skillBonuses), dropping empty containers. */
function updateList(key, group, fn) {
  const map = { ...(values[key] ?? {}) };
  const list = fn([...(map[group] ?? [])]);
  if (list.length) map[group] = list;
  else delete map[group];
  if (Object.keys(map).length) values[key] = map;
  else delete values[key];
}

/** Field-specific behaviour of the adjust dialog. */
function adjusterFor(fieldId) {
  if (COST_FIELD.test(fieldId)) {
    const id = costedId(fieldId);
    const c = computed.costs[id];
    const label = CHARACTERISTIC_LABELS[id];
    const sizeCount = c ? c.modifiers.filter((m) => m.source === 'size').length : 0;
    let result = '';
    if (c) {
      if (c.rawCost <= 0 && c.modifiers.length) result = `Modificadores só se aplicam a compras: abaixo da base o custo é ${fmt(c.rawCost)} pts.`;
      else if (c.applies) result = `Total ${signedPercent(c.netPercent)}${c.capped ? ` (limitado a −${Math.round((1 - MIN_COST_MULTIPLIER) * 100)}%)` : ''} → custo ${costFormula(c)}. Dentro das regras.`;
      else result = `Custo: ${fmt(c.rawCost)} pts.`;
    }
    return {
      title: `Ajustar custo — ${label}${c ? ` ${fmt(c.value)}` : ''}`,
      notReady: c ? '' : `Preencha um valor válido para ${label} antes de ajustar o custo.`,
      lead: !c ? '' : c.value === c.base ? `${label} está no valor base (${fmt(c.base)}): não há custo a ajustar.`
        : `${signedNumber(c.value - c.base)} × ${fmt(c.perLevel)} pts = ${fmt(c.rawCost)} pts (base ${fmt(c.base)}).`,
      items: (c?.modifiers ?? []).map((m, i) => ({ name: m.name, value: signedPercent(m.percent), auto: m.source === 'size' ? 'automático (Mod. de Tamanho)' : null, remove: m.source === 'size' ? null : i - sizeCount })),
      empty: 'Nenhum modificador.',
      placeholders: ['Modificador (ex.: Sem Manipuladores Finos)', '−40'],
      kind: 'modificador',
      parse: (t) => { const n = parseInteger(t); return Number.isInteger(n) && n !== 0 && n >= -99 && n <= 1000 ? n : null; },
      invalid: 'Use um percentual inteiro entre −99 e +1000, diferente de zero.',
      add: (name, n) => updateList(COST_MODS, id, (l) => [...l, { name, percent: n }]),
      remove: (i) => updateList(COST_MODS, id, (l) => l.filter((_, k) => k !== i)),
      result,
    };
  }
  const row = Number(NH_FIELD.exec(fieldId)[1]);
  const sk = computed.skills[row];
  const skillName = String(values[`Pericia${row}`] ?? '').trim();
  const ready = sk && sk.base !== null;
  return {
    title: `Ajustar NH — ${skillName || `perícia, linha ${row}`}`,
    notReady: ready ? '' : 'Escolha o atributo da perícia (coluna NH Relativo) antes de ajustar o NH.',
    lead: ready ? `${sk.attr} ${fmt(sk.base)} ${signedNumber(sk.rel)} (NH relativo) = ${fmt(sk.base + sk.rel)}.` : '',
    items: (sk?.bonuses ?? []).map((b, i) => ({ name: b.name, value: signedNumber(b.amount), auto: null, remove: i })),
    empty: 'Nenhum bônus.',
    placeholders: ['Bônus (ex.: Talento Artista)', '+2'],
    kind: 'bônus',
    parse: (t) => { const n = parseInteger(t); return Number.isInteger(n) && n !== 0 && n >= -20 && n <= 20 ? n : null; },
    invalid: 'Use um número inteiro entre −20 e +20, diferente de zero.',
    add: (name, n) => updateList(SKILL_BONUSES, String(row), (l) => [...l, { name, amount: n }]),
    remove: (i) => updateList(SKILL_BONUSES, String(row), (l) => l.filter((_, k) => k !== i)),
    result: ready ? `NH ${fmt(sk.level)}${sk.bonus ? ` (${signedNumber(sk.bonus)} de bônus)` : ''}. Dentro das regras — liste a vantagem que dá o bônus (ex.: Talento) em Vantagens.` : '',
  };
}

function openAdjustDialog(fieldId) {
  adjustField = fieldId;
  renderAdjustDialog();
  hideTip();
  const dialog = document.getElementById('adjust');
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('input[name=adj-name]').focus();
}

function renderAdjustDialog() {
  const dialog = document.getElementById('adjust');
  const a = adjusterFor(adjustField);
  dialog.querySelector('h2').textContent = a.title;
  dialog.querySelector('.lead').textContent = a.notReady || a.lead;
  const form = dialog.querySelector('.add-mod');
  form.hidden = Boolean(a.notReady);
  form.querySelector('input[name=adj-name]').placeholder = a.placeholders[0];
  form.querySelector('input[name=adj-value]').placeholder = a.placeholders[1];
  const items = a.items.map((m) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="name">${esc(m.name)}</span><span class="pct">${esc(m.value)}</span>`
      + (m.auto ? `<span class="auto">${esc(m.auto)}</span>` : `<button type="button" data-remove="${m.remove}">remover</button>`);
    return li;
  });
  if (!items.length && !a.notReady) items.push(Object.assign(document.createElement('li'), { className: 'empty', textContent: a.empty }));
  dialog.querySelector('.mods').replaceChildren(...items);
  const overridden = isOverridden(adjustField, values);
  dialog.querySelector('.result').textContent = a.result + (overridden ? ` Atenção: o valor manual ${values[adjustField]} está sobrepondo este cálculo.` : '');
  dialog.querySelector('.result').hidden = !a.result && !overridden;
  dialog.querySelector('[data-action=restore]').hidden = !overridden;
  dialog.querySelector('[data-action=manual]').hidden = overridden || flags.experimental || unlocked.has(adjustField);
}

function wireAdjustDialog() {
  const dialog = document.getElementById('adjust');
  const form = dialog.querySelector('.add-mod');
  const nameInput = form.querySelector('input[name=adj-name]');
  const valueInput = form.querySelector('input[name=adj-value]');
  const error = form.querySelector('.error-text');
  const changed = () => { refresh(); save(); renderAdjustDialog(); };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const a = adjusterFor(adjustField);
    if (a.notReady) return; // nothing to attach the adjustment to (the form is hidden too)
    const name = nameInput.value.trim();
    const n = a.parse(valueInput.value);
    error.textContent = !name ? `Dê um nome ao ${a.kind}.` : n === null ? a.invalid : '';
    if (error.textContent) return;
    a.add(name, n);
    nameInput.value = '';
    valueInput.value = '';
    changed();
    nameInput.focus();
  });
  dialog.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.remove !== undefined) {
      adjusterFor(adjustField).remove(Number(btn.dataset.remove));
      changed();
    } else if (btn.dataset.action === 'restore') {
      restoreField(adjustField);
      renderAdjustDialog();
    } else if (btn.dataset.action === 'manual') {
      dialog.close();
      await unlockManually(inputs.get(adjustField), adjustField);
    } else if (btn.dataset.action === 'close') {
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => { error.textContent = ''; });
}

/** Sets (or with '' removes) the justification of a manual value. */
function setJustification(id, text) {
  const reasons = { ...(values[JUSTIFICATIONS] ?? {}) };
  if (text) reasons[id] = text;
  else delete reasons[id];
  if (Object.keys(reasons).length) values[JUSTIFICATIONS] = reasons;
  else delete values[JUSTIFICATIONS];
}

/** Drops a manual value (and its justification): the field follows the rules again. */
function restoreField(id) {
  delete values[id];
  unlocked.delete(id);
  setJustification(id, '');
  refresh();
  save();
}

/** Text dialog for a deviation's justification; resolves the text, '' to remove, or null when cancelled. */
function askJustification(id) {
  const dialog = document.getElementById('justify');
  const area = dialog.querySelector('textarea');
  const current = values[JUSTIFICATIONS]?.[id] ?? '';
  dialog.querySelector('h2').textContent = current ? 'Editar justificativa' : 'Justificar desvio';
  dialog.querySelector('.lead').textContent = `Por que "${fieldLabel(id, values)}" foi alterado à mão? A justificativa vai para o arquivo salvo, `
    + 'para o mestre ou o motor de jogo avaliar. Ela não coloca a ficha de volta dentro das regras.';
  area.value = current;
  const choice = chooseInModal(dialog);
  area.focus();
  return choice.then((value) => (value === 'ok' ? area.value.trim() : null));
}

/**
 * Shows a modal with value buttons and resolves with the chosen value ('' on Esc). Resolves from the
 * click itself rather than the `close` event, which browsers may defer (e.g. in a background tab).
 */
function chooseInModal(dialog) {
  hideTip();
  dialog.showModal();
  return new Promise((resolve) => {
    const finish = (value) => {
      dialog.removeEventListener('click', onClick);
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close(value);
      resolve(value);
    };
    const onClick = (e) => {
      const btn = e.target.closest('button[value]');
      if (!btn) return;
      e.preventDefault();
      finish(btn.value);
    };
    const onCancel = (e) => { e.preventDefault(); finish(''); };
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('cancel', onCancel);
  });
}

/** Confirmation dialog; resolves true only on the confirm button (Esc/Cancel -> false). */
async function askConfirm({ title, message, ok = 'Confirmar' }) {
  const dialog = document.getElementById('confirm');
  dialog.querySelector('h2').textContent = title;
  dialog.querySelector('.lead').textContent = message;
  dialog.querySelector('button[value="ok"]').textContent = ok;
  return (await chooseInModal(dialog)) === 'ok';
}

/** Asks before turning a strict field into a manual (rule-breaking) value; unlocks it for this session. */
async function unlockManually(el, id) {
  const confirmed = await askConfirm({
      title: 'Alterar um campo calculado?',
      message: `"${fieldLabel(id, values)}" é calculado pelas regras e não tem custo associado. Alterá-lo à mão deixa a ficha fora das regras: `
        + 'o desvio aparece em "Integridade da ficha" (onde você pode justificá-lo) e fica registrado no arquivo salvo. Para editar sem confirmações, ative o Modo experimental.',
      ok: 'Alterar mesmo assim',
  });
  if (!confirmed) return;
  unlocked.add(id);
  el.readOnly = false;
  el.classList.remove('locked');
  el.focus();
  el.select();
}

/**
 * Guards a strict field: the first edit attempt asks for confirmation (costs and NH open the adjust dialog,
 * where a modifier or bonus keeps the sheet within the rules), then unlocks it for this session.
 */
function guardStrictField(el, id) {
  const adjustable = isAdjustable(id);
  const request = async (e) => {
    if (!el.readOnly) return;
    e.preventDefault();
    if (document.querySelector('dialog[open]')) return; // e.g. the 2nd click of a double-click: one dialog at a time
    if (adjustable) openAdjustDialog(id);
    else unlockManually(el, id);
  };
  const editKey = (e) => (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) || e.key === 'Backspace' || e.key === 'Delete';
  el.addEventListener('keydown', (e) => { if (editKey(e)) request(e); });
  el.addEventListener('paste', request);
  el.addEventListener('dblclick', (e) => {
    if (!adjustable) return request(e);
    e.preventDefault();
    if (!document.getElementById('adjust').open) openAdjustDialog(id);
  });
  // Touch: read-only inputs raise no keyboard, so a second tap on the focused field is the edit intent.
  el.addEventListener('pointerdown', () => { el.dataset.wasFocused = document.activeElement === el ? '1' : ''; });
  el.addEventListener('click', (e) => { if (el.dataset.wasFocused) request(e); });
}

// ---- Instant help tooltips (custom, so they appear without the native title delay) ----
let helpOn = false;

function tipText(el) {
  if (el.classList.contains('label-help')) return helpOn ? el.dataset.help : '';
  // Validation messages always show; explanations only with "Ajuda imediata" on.
  const parts = [el.dataset.error];
  if (el.dataset.deviation) parts.push(`Fora das regras: o cálculo dá ${el.dataset.deviation}.`);
  const cost = COST_FIELD.test(el.name) ? computed.costs[costedId(el.name)] : null;
  if (cost?.modifiers.length) parts.push(`Modificadores: ${cost.modifiers.map((m) => `${m.name} ${signedPercent(m.percent)}`).join(', ')} → ${costFormula(cost)}.`);
  const nh = NH_FIELD.exec(el.name);
  const bonuses = nh ? computed.skills[nh[1]]?.bonuses ?? [] : [];
  if (bonuses.length) parts.push(`Bônus de NH: ${bonuses.map((b) => `${b.name} ${signedNumber(b.amount)}`).join(', ')}.`);
  const why = values[JUSTIFICATIONS]?.[el.name];
  if (why && el.dataset.deviation) parts.push(`Justificativa: ${why}`);
  if (helpOn) {
    parts.push(el.dataset.tip || (el.classList.contains('calc') ? 'Calculado automaticamente.' : ''));
    if (COST_FIELD.test(el.name)) parts.push('Clique duas vezes para ajustar o custo com modificadores (ampliações e limitações).');
    else if (nh) parts.push('Clique duas vezes para adicionar bônus de NH (ex.: Talento).');
    else if (el.classList.contains('locked')) parts.push('Campo calculado sem custo associado: alterar pede confirmação e deixa a ficha fora das regras.');
    if (el.dataset.override) parts.push('Valor manual — apague para voltar ao cálculo automático.');
  }
  return parts.filter(Boolean).join('\n');
}

function showTip(el) {
  const tip = document.getElementById('tip');
  const text = tipText(el);
  if (!text) return hideTip();
  tip.textContent = text;
  tip.hidden = false;
  const r = el.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), vw - t.width - 8);
  const below = r.bottom + 6;
  const top = below + t.height > window.innerHeight - 8 ? r.top - t.height - 6 : below;
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

function hideTip() {
  document.getElementById('tip').hidden = true;
}

function setHelp(on) {
  helpOn = on;
  document.body.classList.toggle('help-on', on);
  document.getElementById('help-toggle').checked = on;
  try {
    localStorage.setItem(HELP_KEY, on ? '1' : '0');
  } catch { /* preference only */ }
  hideTip();
}

function wireTooltips() {
  const sheet = document.getElementById('sheet');
  const target = (e) => e.target.closest?.('.label-help, .field');
  sheet.addEventListener('pointerover', (e) => { const el = target(e); if (el) showTip(el); });
  sheet.addEventListener('pointerout', (e) => { if (target(e) && !target(e).contains(e.relatedTarget)) hideTip(); });
  // Touch: tapping a title toggles its tooltip.
  sheet.addEventListener('click', (e) => {
    const el = e.target.closest?.('.label-help');
    if (el) document.getElementById('tip').hidden ? showTip(el) : hideTip();
  });
  window.addEventListener('scroll', hideTip, { passive: true });
  let saved = false;
  try {
    saved = localStorage.getItem(HELP_KEY) === '1';
  } catch { /* default off */ }
  setHelp(saved);
  document.getElementById('help-toggle').addEventListener('change', (e) => setHelp(e.target.checked));
}

function buildPages() {
  const root = document.getElementById('sheet');
  for (const [name, items] of Object.entries(DATALISTS)) {
    const dl = document.createElement('datalist');
    dl.id = name;
    dl.innerHTML = items.map((v) => `<option value="${v}"></option>`).join('');
    document.body.append(dl);
  }
  [1, 2].forEach((n, pageIndex) => {
    const page = document.createElement('section');
    page.className = 'page';
    page.setAttribute('aria-label', `Página ${n}`);
    page.innerHTML = `<img class="bg" src="${BASE}bg/page-${n}.svg" alt="" draggable="false">`;
    for (const f of layout.fields.filter((x) => x.page === pageIndex)) {
      const el = document.createElement('input');
      el.type = 'text';
      el.name = f.id;
      el.autocomplete = 'off';
      el.spellcheck = false;
      el.dataset.tip = f.tip;
      el.setAttribute('aria-label', f.tip || f.id);
      const list = listFor(f.id);
      if (list) el.setAttribute('list', list);
      el.className = ['field', `align-${f.align}`, COMPUTED.has(f.id) && 'calc', !f.print && 'noprint']
        .filter(Boolean).join(' ');
      if (READ_ONLY.has(f.id)) el.readOnly = true;
      const fs = Math.min(f.size, f.h * 0.8);
      el.style.cssText = `--x:${f.x};--y:${f.y};--w:${f.w};--h:${f.h};--fs:${fs}`;
      el.addEventListener('input', () => {
        values[f.id] = el.value;
        refresh(el);
        save();
      });
      el.addEventListener('change', () => {
        // Typing the computed value back into a computed field means "track the formula again".
        if (COMPUTED.has(f.id) && sameValue(f.id, el.value, computed.out[f.id])) delete values[f.id];
        if (el.value === '') delete values[f.id];
        if (!isOverridden(f.id, values)) {
          unlocked.delete(f.id); // back on the formula: lock again
          setJustification(f.id, ''); // nothing left to justify
        }
        const row = /^(?:Pericia|NH_Relativo_|Tipo_)(\d+)/.exec(f.id)?.[1];
        const rowEmpty = (r) => [`Pericia${r}`, `NH_Relativo_${r}A`, `NH_Relativo_${r}B`, `Tipo_${r}`].every((id) => !String(values[id] ?? '').trim());
        if (row && values[SKILL_BONUSES]?.[row] && rowEmpty(row)) updateList(SKILL_BONUSES, row, () => []); // they belonged to the old skill
        refresh();
        save();
      });
      if (STRICT_FIELDS.has(f.id)) guardStrictField(el, f.id);
      inputs.set(f.id, el);
      page.append(el);
    }
    for (const spot of resolveHelp(labels).filter((h) => h.page === pageIndex && h.help)) {
      const hot = document.createElement('div');
      hot.className = 'label-help';
      hot.dataset.help = spot.help;
      hot.setAttribute('aria-label', spot.help);
      const pad = 1.5;
      hot.style.cssText = `--x:${spot.x - pad};--y:${spot.y - pad};--w:${spot.w + pad * 2};--h:${spot.h + pad * 2}`;
      page.append(hot);
    }
    root.append(page);
  });
}

function fitToWidth() {
  const available = document.documentElement.clientWidth - 32;
  const pt = Math.min(1.6, Math.max(0.5, available / PAGE_W));
  document.documentElement.style.setProperty('--pt', pt);
  document.documentElement.style.setProperty('--page-w', PAGE_W);
  document.documentElement.style.setProperty('--page-h', PAGE_H);
}

function fileBase() {
  const name = String(values.Nome ?? '').trim().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/\s+/g, '-');
  return name ? `GURPS-${name}` : 'GURPS-ficha';
}

function download(bytes, type, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wireToolbar() {
  document.getElementById('btn-pdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    setStatus('Gerando PDF…');
    try {
      const { buildPdf } = await import('./pdf.js'); // pdf-lib is ~90% of the bundle; load on demand
      const template = await fetch(`${BASE}template.pdf`).then((r) => r.arrayBuffer());
      const bytes = await buildPdf(template, layout, (id) => display(id, values, computed.out));
      download(bytes, 'application/pdf', `${fileBase()}.pdf`);
      setStatus('PDF exportado');
    } catch (err) {
      console.error(err);
      setStatus(`Falha ao gerar PDF: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-save').addEventListener('click', async () => {
    try {
      const { validateCharacter, schema } = await import('./validate.js'); // Ajv is large; load on demand
      const { doc, problems, labels } = toCharacter(values, layout, { schema, createdAt, context, flags, generator: { name: 'gurps-sheet', version } });
      // Sheet-level problems first (they name rows); schema errors only once those are fixed, mapped to sheet rows.
      const all = problems.length ? problems : validateCharacter(doc, labels).problems;
      if (all.length) {
        showProblems('Não foi possível salvar a ficha', all, 'Corrija os itens abaixo e salve de novo. Nada foi baixado.');
        return;
      }
      createdAt = doc.meta.createdAt;
      save({ quiet: true });
      download(JSON.stringify(doc, null, 2), 'application/json', `${fileBase()}.json`);
      const { integrity } = doc;
      setStatus(integrity.experimental ? 'Ficha salva (marcada como experimental)'
        : integrity.rulesCompliant ? 'Ficha salva (dentro das regras)'
          : `Ficha salva — fora das regras (${integrity.deviations.length + integrity.issues.length} pendência(s), registradas no arquivo)`);
    } catch (err) {
      console.error(err);
      showProblems('Erro inesperado ao salvar a ficha', [String(err?.message ?? err)], 'Nada foi baixado.');
    }
  });

  const fileInput = document.getElementById('file-open');
  document.getElementById('btn-open').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const untouched = `Arquivo: ${file.name}. A ficha atual não foi alterada.`;
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw new SheetFileError('Arquivo grande demais.', [`O arquivo tem ${Math.round(file.size / 1024)} KB; uma ficha tem poucos KB.`]);
      }
      let text;
      try {
        text = await file.text();
      } catch (err) {
        throw new SheetFileError('Não foi possível ler o arquivo.', [String(err?.message ?? err)]);
      }
      const { validateCharacter } = await import('./validate.js');
      const loaded = parseCharacterFile(text, validateCharacter, layout);
      values = loaded.values;
      createdAt = loaded.createdAt;
      context = loaded.context;
      flags = loaded.flags;
      unlocked.clear();
      document.getElementById('experimental-toggle').checked = Boolean(flags.experimental);
      document.body.classList.toggle('experimental', Boolean(flags.experimental));
      refresh();
      save({ quiet: true });
      setStatus(`Ficha "${file.name}" carregada`);
      if (loaded.warnings.length) {
        showProblems('Ficha carregada com avisos', loaded.warnings, 'Revise os avisos abaixo:', 'warning');
      }
    } catch (err) {
      if (err instanceof SheetFileError) {
        showProblems(err.title, err.problems, untouched);
      } else {
        console.error(err);
        showProblems('Erro inesperado ao abrir a ficha', [String(err?.message ?? err)], untouched);
      }
      setStatus(`Não foi possível abrir "${file.name}"`);
    }
  });

  document.getElementById('btn-clear').addEventListener('click', async () => {
    const confirmed = await askConfirm({ title: 'Limpar a ficha?', message: 'Todos os campos serão apagados. Salve a ficha antes se quiser guardá-la.', ok: 'Limpar tudo' });
    if (!confirmed) return;
    values = {};
    createdAt = undefined;
    context = {};
    flags = {};
    unlocked.clear();
    document.getElementById('experimental-toggle').checked = false;
    document.body.classList.remove('experimental');
    refresh();
    save();
  });
}

/** Modal list of problems (load/save errors or warnings). */
function showProblems(title, problems, lead = '', kind = 'error') {
  const dialog = document.getElementById('problems');
  const MAX = 30;
  dialog.className = `problems ${kind}`;
  dialog.querySelector('h2').textContent = title;
  dialog.querySelector('.lead').textContent = lead;
  const list = dialog.querySelector('ul');
  list.replaceChildren(...problems.slice(0, MAX).map((p) => Object.assign(document.createElement('li'), { textContent: p })));
  if (problems.length > MAX) list.append(Object.assign(document.createElement('li'), { textContent: `… e mais ${problems.length - MAX}.` }));
  hideTip();
  if (!dialog.open) dialog.showModal();
}

buildPages();
wireToolbar();
wireTooltips();
wireIntegrity();
wireAdjustDialog();
fitToWidth();
refresh();
window.addEventListener('resize', fitToWidth);
