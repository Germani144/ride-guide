import { calculate, emptyCar, DEFAULT_BUFFER } from './engine.js';
import { createLocalStorageAdapter, STATE_VERSION } from './storage.js';
import { STRINGS, LANGS } from './i18n.js';
import { SEED_CARS } from './seed.js';

// Field layout, in the same order of thought as the sheet: how you pay, then what it costs to run.
const GROUPS = [
  ['year', 'yearsOfUse', 'price', 'downPayment', 'apr', 'financeMonths'],
  ['leaseMo', 'oneTimePayment', 'returnFee'],
  ['depreciationFactor', 'kmPerYear', 'kmPerUnit', 'pricePerUnit',
    'insuranceMo', 'greenTaxMo', 'maintenanceMo', 'parkingMo'],
];
const FIELDS = GROUPS.flat();
const PERCENT = new Set(['downPayment', 'apr', 'depreciationFactor']);
const RESULTS = ['fuelMo', 'deprMo', 'financeMo', 'fixed', 'variable', 'total', 'cashflow',
  'projection', 'kmCost', 'residual', 'spent'];
const STRONG = new Set(['total', 'kmCost']);
const SHARE_KEYS = ['energy', 'finance', 'depreciation', 'greenTax', 'insurance', 'maintenance', 'parking'];

const storage = createLocalStorageAdapter();
const nf0 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let state;
const $ = (sel) => document.querySelector(sel);
const t = () => STRINGS[state.lang] ?? STRINGS.en;
const uid = () => Math.random().toString(36).slice(2, 10);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

// ---------- state ----------

function sanitizeCar(raw) {
  const base = emptyCar();
  const car = { id: typeof raw?.id === 'string' ? raw.id : uid() };
  car.name = String(raw?.name ?? base.name).trim().slice(0, 60) || base.name;
  for (const f of FIELDS) {
    const v = Number(raw?.[f]);
    car[f] = Number.isFinite(v) ? v : base[f];
  }
  return car;
}

function seedState(lang = 'en') {
  return {
    version: STATE_VERSION, lang,
    settings: { buffer: DEFAULT_BUFFER },
    cars: SEED_CARS.map(sanitizeCar),
  };
}

function normalize(raw) {
  if (!raw || !Array.isArray(raw.cars)) return null;
  const buffer = Number(raw.settings?.buffer);
  return {
    version: STATE_VERSION,
    lang: LANGS.includes(raw.lang) ? raw.lang : 'en',
    settings: { buffer: Number.isFinite(buffer) ? buffer : DEFAULT_BUFFER },
    cars: raw.cars.slice(0, 50).map(sanitizeCar),
  };
}

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => storage.save(state), 250);
}

// ---------- rendering ----------

// Inputs show at most 2 decimals; the stored value stays exact until the user edits it.
const toDisplay = (field, v) => (PERCENT.has(field) ? +(v * 100).toFixed(2) : +v.toFixed(2));
const fromDisplay = (field, v) => (PERCENT.has(field) ? v / 100 : v);

function renderStatic() {
  const s = t();
  document.documentElement.lang = state.lang;
  $('#tagline').textContent = s.tagline;
  $('#add').textContent = s.addCar;
  $('#export').textContent = s.export;
  $('#import-label').textContent = s.import;
  $('#reset').textContent = s.reset;
  $('#buffer-label').textContent = s.bufferLabel;
  $('#buffer-hint').textContent = s.bufferHint;
  $('#buffer').value = +(state.settings.buffer * 100).toFixed(2);
  for (const b of document.querySelectorAll('[data-lang]')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang));
  }
}

function renderGrid() {
  const s = t();
  const wrap = $('#grid');
  wrap.replaceChildren();
  if (!state.cars.length) {
    wrap.append(el('p', { class: 'empty' }, s.empty));
    return;
  }

  const table = el('table', { class: 'grid' });
  const head = el('tr', {}, el('th', { class: 'label', scope: 'col' }, s.name));
  state.cars.forEach((car, i) => {
    const name = el('input', {
      class: 'name', type: 'text', value: car.name, 'aria-label': s.name, maxlength: '60',
      oninput: (e) => { car.name = e.target.value.slice(0, 60); persist(); },
    });
    const actions = el('div', { class: 'col-actions' },
      el('button', { type: 'button', title: s.duplicate, 'aria-label': s.duplicate,
        onclick: () => { state.cars.splice(i + 1, 0, { ...car, id: uid(), name: `${car.name} (2)` }); commit(); } }, '⧉'),
      el('button', { type: 'button', title: s.remove, 'aria-label': s.remove,
        onclick: () => { if (confirm(s.confirmRemove)) { state.cars.splice(i, 1); commit(); } } }, '✕'));
    head.append(el('th', { scope: 'col', 'data-col': car.id }, name, actions));
  });
  const thead = el('thead', {}, head);

  const body = el('tbody');
  body.append(sectionRow(s.inputs));
  GROUPS.forEach((group, gi) => {
    group.forEach((field, fi) => {
      const tr = el('tr', { class: gi > 0 && fi === 0 ? 'group-start' : '' },
        el('th', { class: 'label', scope: 'row' }, s.fields[field]));
      for (const car of state.cars) {
        const input = el('input', {
          type: 'number', inputmode: 'decimal', step: 'any', value: String(toDisplay(field, car[field])),
          'aria-label': `${car.name}: ${s.fields[field]}`,
          oninput: (e) => {
            const v = e.target.valueAsNumber;
            car[field] = Number.isFinite(v) ? fromDisplay(field, v) : 0;
            refreshResults(); persist();
          },
        });
        tr.append(el('td', {}, input));
      }
      body.append(tr);
    });
  });

  body.append(sectionRow(s.results));
  for (const key of RESULTS) {
    const tr = el('tr', { class: STRONG.has(key) ? 'strong' : '' },
      el('th', { class: 'label', scope: 'row' }, s.out[key]));
    for (const car of state.cars) tr.append(el('td', { class: 'num', 'data-out': key, 'data-car': car.id }));
    body.append(tr);
  }
  const shareRow = el('tr', {}, el('th', { class: 'label', scope: 'row' }, s.breakdown));
  for (const car of state.cars) shareRow.append(el('td', { 'data-shares': car.id }));
  body.append(shareRow);

  table.append(thead, body);
  wrap.append(table);
  renderLegend();
  refreshResults();
}

function sectionRow(text) {
  return el('tr', { class: 'section' },
    el('th', { class: 'label', scope: 'rowgroup' }, text),
    el('td', { colspan: String(state.cars.length) }));
}

function renderLegend() {
  const s = t();
  $('#legend').replaceChildren(...SHARE_KEYS.map((k) =>
    el('span', { class: 'key' }, el('i', { class: `sw-${k}` }), s.shares[k])));
}

function refreshResults() {
  const s = t();
  const results = new Map(state.cars.map((c) => [c.id, calculate(c, { buffer: state.settings.buffer })]));
  const withKm = state.cars.filter((c) => results.get(c.id).kmCost > 0);
  const cheapest = withKm.length
    ? withKm.reduce((a, b) => (results.get(a.id).kmCost <= results.get(b.id).kmCost ? a : b)).id
    : null;

  for (const cell of document.querySelectorAll('[data-out]')) {
    const r = results.get(cell.dataset.car);
    let v = r[cell.dataset.out];
    if (cell.dataset.out === 'cashflow') v = -v; // show cash out as a positive amount
    cell.textContent = cell.dataset.out === 'kmCost' ? nf2.format(v) : nf0.format(v);
  }
  for (const th of document.querySelectorAll('th[data-col]')) {
    th.classList.toggle('best', th.dataset.col === cheapest);
    th.title = th.dataset.col === cheapest ? s.cheapest : '';
  }
  for (const cell of document.querySelectorAll('[data-shares]')) {
    const shares = results.get(cell.dataset.shares).shares;
    const parts = SHARE_KEYS.map((k) => [k, Math.max(0, shares[k] || 0)]).filter(([, v]) => v > 0);
    const sum = parts.reduce((a, [, v]) => a + v, 0) || 1;
    const bar = el('div', { class: 'bar', role: 'img' });
    bar.setAttribute('aria-label', parts.map(([k, v]) => `${s.shares[k]} ${Math.round((v / sum) * 100)}%`).join(', '));
    for (const [k, v] of parts) {
      const seg = el('span', { class: `sw-${k}` });
      seg.style.width = `${(v / sum) * 100}%`;
      seg.title = `${s.shares[k]}: ${Math.round((v / sum) * 100)}%`;
      bar.append(seg);
    }
    cell.replaceChildren(bar);
  }
}

function commit() {
  persist();
  renderGrid();
}

// ---------- actions ----------

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `rideguide-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importState(file) {
  try {
    const next = normalize(JSON.parse(await file.text()));
    if (!next) throw new Error('shape');
    if (!confirm(t().confirmImport)) return;
    next.lang = state.lang;
    state = next;
    persist(); renderStatic(); renderGrid();
  } catch {
    alert(t().importError);
  }
}

function wire() {
  $('#add').addEventListener('click', () => {
    state.cars.push(sanitizeCar({ ...emptyCar(`${t().name} ${state.cars.length + 1}`), id: uid() }));
    commit();
    const inputs = document.querySelectorAll('thead input.name');
    inputs[inputs.length - 1]?.focus();
  });
  $('#export').addEventListener('click', exportState);
  $('#import').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) importState(f);
    e.target.value = '';
  });
  $('#reset').addEventListener('click', () => {
    if (!confirm(t().confirmReset)) return;
    state = seedState(state.lang);
    persist(); renderStatic(); renderGrid();
  });
  $('#buffer').addEventListener('input', (e) => {
    const v = e.target.valueAsNumber;
    state.settings.buffer = Number.isFinite(v) ? v / 100 : DEFAULT_BUFFER;
    refreshResults(); persist();
  });
  for (const b of document.querySelectorAll('[data-lang]')) {
    b.addEventListener('click', () => { state.lang = b.dataset.lang; persist(); renderStatic(); renderGrid(); });
  }
}

async function start() {
  const browserLang = (navigator.language || '').toLowerCase().startsWith('da') ? 'da' : 'en';
  state = normalize(await storage.load()) ?? seedState(browserLang);
  wire();
  renderStatic();
  renderGrid();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

start();
