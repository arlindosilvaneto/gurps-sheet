import './style.css';
import layout from './layout.json';
import labels from './labels.json';
import { compute, display, COMPUTED, READ_ONLY, ATTRS } from './rules.js';
import { resolveHelp } from './help.js';
import { toCharacter, parseCharacterFile, SheetFileError, MAX_FILE_BYTES } from './character.js';
import { version } from '../package.json';

const STORAGE_KEY = 'gurps-sheet:v1';
const HELP_KEY = 'gurps-sheet:help';
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
// `context` keeps a loaded file's locale/currency so re-saving doesn't overwrite them.
let { values, createdAt, context } = load();
let computed = { out: {}, errors: {} };
const inputs = new Map();

function load() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { values: draft?.values ?? {}, createdAt: draft?.createdAt, context: draft?.context ?? {} };
  } catch {
    return { values: {}, createdAt: undefined, context: {} };
  }
}

let saveTimer;
/** Debounced autosave; `quiet` keeps the current status message (e.g. "Ficha salva") instead of overwriting it. */
function save({ quiet = false } = {}) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ values, createdAt, context }));
      if (!quiet) setStatus('Salvo neste navegador');
    } catch {
      setStatus('Não foi possível salvar no navegador — use "Salvar ficha"');
    }
  }, 300);
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

/** Recomputes everything and repaints every field except the one being typed in. */
function refresh(skip) {
  computed = compute(values);
  for (const [id, el] of inputs) {
    const isCalc = COMPUTED.has(id);
    const overridden = isCalc && !READ_ONLY.has(id) && String(values[id] ?? '').trim() !== '';
    if (el !== skip) el.value = display(id, values, computed.out);
    el.classList.toggle('override', overridden);
    const err = computed.errors[id];
    el.classList.toggle('error', Boolean(err));
    el.dataset.error = err ?? '';
    el.dataset.override = overridden ? '1' : '';
  }
}

// ---- Instant help tooltips (custom, so they appear without the native title delay) ----
let helpOn = false;

function tipText(el) {
  if (el.classList.contains('label-help')) return helpOn ? el.dataset.help : '';
  // Validation messages always show; explanations only with "Ajuda imediata" on.
  const parts = [el.dataset.error];
  if (helpOn) {
    parts.push(el.dataset.tip || (el.classList.contains('calc') ? 'Calculado automaticamente.' : ''));
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
      if (f.kind === 'number') el.inputMode = 'decimal';
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
        if (COMPUTED.has(f.id) && el.value.trim() === (computed.out[f.id] ?? '')) delete values[f.id];
        if (el.value === '') delete values[f.id];
        refresh();
        save();
      });
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
      const { validateCharacter } = await import('./validate.js'); // Ajv is large; load on demand
      const { doc, problems, labels } = toCharacter(values, layout, { createdAt, context, generator: { name: 'gurps-sheet', version } });
      // Sheet-level problems first (they name rows); schema errors only once those are fixed, mapped to sheet rows.
      const all = problems.length ? problems : validateCharacter(doc, labels).problems;
      if (all.length) {
        showProblems('Não foi possível salvar a ficha', all, 'Corrija os itens abaixo e salve de novo. Nada foi baixado.');
        return;
      }
      createdAt = doc.meta.createdAt;
      save({ quiet: true });
      download(JSON.stringify(doc, null, 2), 'application/json', `${fileBase()}.json`);
      setStatus('Ficha salva (formato gurps-character)');
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
      refresh();
      save({ quiet: true });
      setStatus(`Ficha "${file.name}" carregada`);
      if (loaded.warnings.length) {
        showProblems('Ficha carregada com avisos', loaded.warnings, 'Estes dados do arquivo não têm lugar na planilha e não serão mantidos ao salvar:', 'warning');
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

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Limpar todos os campos da ficha?')) return;
    values = {};
    createdAt = undefined;
    context = {};
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
fitToWidth();
refresh();
window.addEventListener('resize', fitToWidth);
