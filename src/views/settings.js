import { LANGS } from '../i18n.js';
import { parseNumber } from '../model.js';
import { el, plain } from '../ui.js';

const LANG_NAMES = { en: 'English', da: 'Dansk' };

export function renderSettings(ctx) {
  const { state, t } = ctx;
  const lang = state.lang;

  const langs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t.settings.language },
    LANGS.map((l) => el('button', {
      type: 'button', role: 'radio', 'aria-checked': String(l === lang),
      onclick: () => { state.lang = l; ctx.save(); ctx.render(); },
    }, LANG_NAMES[l])));

  const buffer = el('input', {
    id: 'f-buffer', type: 'text', inputmode: 'decimal', value: plain(state.settings.buffer * 100, lang),
    oninput: (e) => {
      const v = parseNumber(e.target.value);
      state.settings.buffer = v == null || v < 0 ? 0 : v / 100;
      ctx.save();
    },
  });

  const file = el('input', {
    type: 'file', accept: 'application/json,.json', class: 'visually-hidden', id: 'import-file',
    onchange: (e) => {
      const f = e.target.files?.[0];
      if (f) ctx.importBackup(f);
      e.target.value = '';
    },
  });

  return el('div', { class: 'settings-view' },
    el('header', { class: 'view-head' }, el('h1', {}, t.settings.title)),
    el('section', { class: 'setting' }, el('h2', {}, t.settings.language), langs),
    el('section', { class: 'setting' },
      el('h2', {}, el('label', { for: 'f-buffer' }, t.settings.buffer)),
      el('div', { class: 'input-wrap short' }, buffer, el('span', { class: 'unit' }, t.settings.bufferUnit)),
      el('p', { class: 'hint' }, t.settings.bufferHint)),
    el('section', { class: 'setting' },
      el('h2', {}, t.settings.data),
      el('p', { class: 'hint' }, t.settings.dataHint),
      el('div', { class: 'actions stack' },
        el('button', { type: 'button', class: 'secondary', onclick: () => ctx.exportBackup() }, t.settings.export),
        el('label', { class: 'button secondary', for: 'import-file' }, t.settings.import, file),
        el('button', { type: 'button', class: 'danger', onclick: () => ctx.resetToSeed() }, t.settings.reset))));
}
