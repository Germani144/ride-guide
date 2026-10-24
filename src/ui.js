// Small DOM helpers and shared pieces of interface. User text only ever goes in via
// textContent or input values, never as HTML.
import { calculate, PART_KEYS } from './engine.js';
import { toEngineInput, toShown } from './model.js';
import { fmt } from './i18n.js';

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function svg(markup, cls = 'icon') {
  const node = document.createElementNS(SVG_NS, 'svg');
  node.setAttribute('viewBox', '0 0 24 24');
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('class', cls);
  node.innerHTML = markup; // static, trusted markup only
  return node;
}

export const ICONS = {
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  garage:
    '<path d="M3 10.5 12 5l9 5.5V20H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 20v-6h10v6M7 17h10" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  history:
    '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4.5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  settings:
    '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  check:
    '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};

// ---------- numbers ----------

const locale = lang => (lang === 'da' ? 'da-DK' : 'en-GB');
export function money(v, lang, digits = 0) {
  return new Intl.NumberFormat(locale(lang), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v || 0);
}
export function plain(v, lang) {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 2 }).format(v || 0);
}

// Value shown inside an input: percentages as %, Danish decimal comma, empty for zero.
export function toInputText(field, v, lang) {
  if (!v) return '';
  const shown = +Number(toShown(field, v)).toFixed(4);
  const s = String(shown);
  return lang === 'da' ? s.replace('.', ',') : s;
}

// ---------- results ----------

// Everything the views show about a car, under the user's settings.
export function evaluate(car, settings) {
  const out = calculate(toEngineInput(car, { kmPerYear: settings.kmPerYear }), settings);
  return { ...out, out };
}

// Parts below zero (a loan can beat paying cash) are listed as savings but left out of the bar.
export function breakdownBar(parts, t, lang) {
  const all = PART_KEYS.map(k => [k, parts[k] || 0]).filter(([, v]) => Math.abs(v) > 0.5);
  const items = all.filter(([, v]) => v > 0);
  const sum = items.reduce((a, [, v]) => a + v, 0) || 1;
  const bar = el('div', { class: 'bar', role: 'img' });
  bar.setAttribute(
    'aria-label',
    items.map(([k, v]) => `${t.shares[k]} ${Math.round((v / sum) * 100)}%`).join(', '),
  );
  for (const [k, v] of items) {
    const seg = el('span', { class: `part-${k}` });
    seg.style.flexGrow = String(v);
    bar.append(seg);
  }
  const legend = el(
    'ul',
    { class: 'legend' },
    all
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) =>
        el(
          'li',
          { class: v < 0 ? 'saving' : null },
          el('i', { class: `part-${k}` }),
          el('span', { class: 'legend-name' }, v < 0 ? (t.sharesNegative[k] ?? t.shares[k]) : t.shares[k]),
          el('span', { class: 'legend-val' }, `${money(v, lang)} ${t.fields.price[1]}`),
        ),
      ),
  );
  return { bar, legend };
}

// The answer block used on the result step, the car page and the comparison.
export function priceBlock(r, t, lang, { compact = false } = {}) {
  return el(
    'div',
    { class: compact ? 'price compact' : 'price' },
    el(
      'p',
      { class: 'price-km' },
      el('span', { class: 'price-num' }, money(r.perKm, lang, 2)),
      el('span', { class: 'price-unit' }, t.result.perKm),
    ),
    el(
      'p',
      { class: 'price-month' },
      el('span', { class: 'price-month-num' }, money(r.perMonth, lang)),
      ` ${t.result.perMonth}`,
    ),
  );
}

export function factsList(r, car, t, lang, settings) {
  const kr = t.fields.price[1];
  const years = plain(r.months / 12, lang);
  const rows = [
    r.upfront > 0.5 ? [t.result.upfront, `${money(r.upfront, lang)} ${kr}`] : null,
    [t.result.cashOut, `${money(r.paidMonthly, lang)} ${kr}`],
    [`${t.result.spent} (${fmt(t.result.period, { years })})`, `${money(r.period, lang)} ${kr}`],
    r.owned && r.residual > 0
      ? [fmt(t.result.residual, { years }), `${money(r.residual, lang)} ${kr}`]
      : null,
    r.loanLeft > 0.5 ? [t.result.loanLeft, `${money(r.loanLeft, lang)} ${kr}`] : null,
  ].filter(Boolean);
  const list = el(
    'dl',
    { class: 'facts' },
    rows.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v))),
  );
  const note = el(
    'p',
    { class: 'note' },
    fmt(r.owned && settings.buffer > 0 ? t.result.noteOwned : t.result.note, {
      years,
      km: money(settings.kmPerYear, lang),
      rate: plain(settings.returnRate * 100, lang),
      pct: plain(settings.buffer * 100, lang),
    }),
  );
  return [list, note];
}

// Years of ownership and km per year: shared by every car, chosen from bars on History,
// Comparison, the result and Settings. Changing a bar changes the setting.
export const SPAN_CHOICES = [1, 2, 3, 4, 5, 6, 8, 10];
export const KM_CHOICES = [5000, 10000, 15000, 20000, 25000, 30000];

function choiceBar(ctx, key, choices, label, show) {
  const { state, t } = ctx;
  const current = state.settings[key];
  return el(
    'div',
    { class: 'field span-field' },
    el('span', { class: 'label' }, label),
    el(
      'div',
      { class: 'segmented', role: 'radiogroup', 'aria-label': label },
      choices.map(v =>
        el(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(v === current),
            onclick: () => {
              state.settings[key] = v;
              ctx.save();
              ctx.render();
              if (ctx.route.startsWith('#/settings')) toast(t.settings.saved);
            },
          },
          show(v),
        ),
      ),
    ),
  );
}

export function spanPicker(ctx) {
  return choiceBar(ctx, 'years', SPAN_CHOICES, ctx.t.compare.span, String);
}
export function kmPicker(ctx) {
  return choiceBar(ctx, 'kmPerYear', KM_CHOICES, ctx.t.compare.km, v => String(v / 1000));
}
export function assumptionBars(ctx) {
  return el('div', { class: 'assumptions' }, spanPicker(ctx), kmPicker(ctx));
}

// ---------- plate ----------

const EU_STARS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return `<circle cx="${(12 + Math.cos(a) * 6.2).toFixed(2)}" cy="${(12 + Math.sin(a) * 6.2).toFixed(2)}" r="1.05" fill="#ffd617"/>`;
}).join('');

export function euStrip() {
  return el(
    'span',
    { class: 'plate-eu', 'aria-hidden': 'true' },
    svg(EU_STARS, 'plate-stars'),
    el('b', {}, 'DK'),
  );
}

export function plate(text, size = 'sm') {
  return el(
    'span',
    { class: `plate plate-${size}`, 'aria-label': text },
    euStrip(),
    el('span', { class: 'plate-text' }, text),
  );
}

// ---------- toast ----------

let toastTimer;
export function toast(message) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2400);
}

export function carTitle(car, t) {
  return car.name || t.unnamed;
}

export function carSubline(car, t, lang) {
  return `${t.method[car.method]}, ${t.fuel[car.fuel].toLowerCase()}${car.year ? `, ${car.year}` : ''}`.replace(
    /^./,
    c => c.toUpperCase(),
  );
}
