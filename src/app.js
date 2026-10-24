// App shell: state, routing and actions. Views live in src/views/.
import { migrate, emptyState, sanitizeCar, makeId } from './model.js';
import { createLocalStorageAdapter } from './storage.js';
import { STRINGS } from './i18n.js';
import { SEED_CARS } from './seed.js';
import { el, svg, ICONS, toast } from './ui.js';
import { renderWizard, startDraft } from './views/wizard.js';
import { renderGarage, renderHistory, renderCar, renderCompare } from './views/cars.js';
import { renderSettings } from './views/settings.js';

const storage = createLocalStorageAdapter();
const view = document.getElementById('view');
const tabs = document.getElementById('tabs');
const settingsLink = document.getElementById('settings-link');

export const VERSION = `v${globalThis.RIDEGUIDE_VERSION ?? '?'}`;
const SPLASH_MIN_MS = 700; // long enough to read the version on the loading screen

let state;
const ui = { selecting: false, selected: new Set() }; // per-visit UI state, not saved

const t = () => STRINGS[state.lang] ?? STRINGS.en;

function seedState(lang) {
  const s = emptyState(lang);
  const base = Date.now();
  // Newest first, keeping the spreadsheet's left-to-right order.
  s.cars = SEED_CARS.map((c, i) =>
    sanitizeCar({
      ...c,
      id: makeId(),
      createdAt: new Date(base - i * 1000).toISOString(),
    }),
  );
  return s;
}

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 200);
}
// Writes right away if a save is waiting. Called when the app is hidden or closed, so a change
// made just before swiping the app away is not lost.
function flush() {
  if (saveTimer == null) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  storage.save(state);
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ---------- actions used by the views ----------

function saveDraft({ mine } = {}) {
  const d = state.draft;
  if (!d) return;
  const now = new Date().toISOString();
  const s = t();
  if (d.editingId) {
    const i = state.cars.findIndex(c => c.id === d.editingId);
    if (i >= 0) {
      const old = state.cars[i];
      state.cars[i] = sanitizeCar({
        ...d.car,
        id: old.id,
        mine: old.mine,
        createdAt: old.createdAt,
        updatedAt: now,
      });
      state.draft = null;
      save();
      toast(s.toast.updated);
      go(`#/car/${encodeURIComponent(old.id)}`);
      return;
    }
  }
  const car = sanitizeCar({ ...d.car, id: makeId(), mine: Boolean(mine), createdAt: now, updatedAt: now });
  state.cars.unshift(car);
  state.draft = null;
  save();
  toast(mine ? s.toast.savedGarage : s.toast.savedHistory);
  go(`#/car/${encodeURIComponent(car.id)}`);
}

function updateCar(id, changes, message) {
  const car = state.cars.find(c => c.id === id);
  if (!car) return;
  Object.assign(car, changes, { updatedAt: new Date().toISOString() });
  save();
  if (message) toast(message);
  render();
}

function deleteCar(id) {
  state.cars = state.cars.filter(c => c.id !== id);
  ui.selected.delete(id);
  save();
  toast(t().toast.deleted);
  go('#/history');
}

function editCar(id) {
  const car = state.cars.find(c => c.id === id);
  if (!car) return;
  state.draft = startDraft(state, {
    car: { ...car },
    hasPlate: car.plate ? 'yes' : 'no',
    step: 'result',
    editingId: id,
  });
  save();
  go('#/new');
}

// Same car, new payment method: starts at the method question, then straight to the result.
function tryOtherMethod(id) {
  const car = state.cars.find(c => c.id === id);
  if (!car) return;
  state.draft = startDraft(state, {
    car: { ...car, id: makeId(), mine: false },
    hasPlate: car.plate ? 'yes' : 'no',
    step: 'method',
    trail: [],
    jump: true,
  });
  save();
  go('#/new');
}

function exportBackup() {
  const data = { ...state, draft: null, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = el('a', {
    href: URL.createObjectURL(blob),
    download: `rideguide-${new Date().toISOString().slice(0, 10)}.json`,
  });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importBackup(file) {
  const s = t();
  let next;
  try {
    next = migrate(JSON.parse(await file.text()), state.lang);
  } catch {
    next = null;
  }
  if (!next) {
    alert(s.settings.importError);
    return;
  }
  if (!confirm(s.settings.confirmImport)) return;
  next.lang = state.lang;
  next.draft = null;
  state = next;
  save();
  toast(s.toast.imported);
  render();
}

// ---------- rendering ----------

const TABS = [
  ['#/new', 'new', ICONS.plus],
  ['#/garage', 'garage', ICONS.garage],
  ['#/history', 'history', ICONS.history],
];

function renderTabs(route) {
  const s = t();
  tabs.replaceChildren(
    ...TABS.map(([href, key, icon]) => {
      const active =
        route.startsWith(href) ||
        (key === 'history' &&
          (route.startsWith('#/compare') || (route.startsWith('#/car/') && !currentCar(route)?.mine))) ||
        (key === 'garage' && route.startsWith('#/car/') && currentCar(route)?.mine);
      return el(
        'a',
        { href, class: 'tab', 'aria-current': active ? 'page' : null },
        svg(icon),
        el('span', {}, s.nav[key]),
      );
    }),
  );
  settingsLink.setAttribute('aria-label', s.nav.settings);
  settingsLink.setAttribute('aria-current', route.startsWith('#/settings') ? 'page' : 'false');
}

function currentCar(route) {
  const id = decodeURIComponent(route.split('/')[2] || '');
  return state.cars.find(c => c.id === id);
}

let lastRoute = '';
function render({ animate = false, back = false } = {}) {
  const route = location.hash || '#/new';
  if (!route.startsWith('#/history') && !route.startsWith('#/car/') && !route.startsWith('#/compare')) {
    ui.selecting = false;
    ui.selected.clear();
  }
  const ctx = {
    state,
    t: t(),
    ui,
    route,
    version: VERSION,
    save,
    go,
    render,
    saveDraft,
    updateCar,
    deleteCar,
    editCar,
    tryOtherMethod,
    exportBackup,
    importBackup,
  };
  document.documentElement.lang = state.lang;

  let node;
  const [, name, arg] = route.split('/');
  if (name === 'garage') node = renderGarage(ctx);
  else if (name === 'history') node = renderHistory(ctx);
  else if (name === 'car') node = renderCar(ctx, decodeURIComponent(arg || ''));
  else if (name === 'compare') node = renderCompare(ctx, (arg || '').split(',').map(decodeURIComponent));
  else if (name === 'settings') node = renderSettings(ctx);
  else node = renderWizard(ctx);

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (animate && !reduce) node.classList.add(back ? 'enter-back' : 'enter');
  view.replaceChildren(node);
  renderTabs(route);
  if (route !== lastRoute || animate) window.scrollTo(0, 0);
  lastRoute = route;
  document.title = `RideGuide`;
}

async function start() {
  const browserLang = (navigator.language || '').toLowerCase().startsWith('da') ? 'da' : 'en';
  state = migrate(await storage.load(), browserLang) ?? seedState(browserLang);
  save(); // writes migrated data back in the current format
  window.addEventListener('hashchange', () => render());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
  render();
  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(
      () => {
        splash.classList.add('hide');
        setTimeout(() => splash.remove(), 400);
      },
      Math.max(0, SPLASH_MIN_MS - performance.now()),
    );
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(() => {});
  }
}

start();
