// "New car": the landing page. A decision tree that asks one thing per screen,
// starting with the most general question (do you have the plate?).
import {
  newCar, METHODS, FUELS, DRIVING_FIELDS, costFields, runningFields,
  formatPlate, parseNumber, validate, toShown, fromShown,
} from '../model.js';
import { fmt } from '../i18n.js';
import {
  el, svg, ICONS, euStrip, evaluate, priceBlock, factsList, breakdownBar, toInputText,
  plain, carTitle, assumptionBars,
} from '../ui.js';

const FIRST = 'plate';
const NEXT = {
  plate: (d) => (d.hasPlate === 'yes' ? 'plateEntry' : 'car'),
  plateEntry: () => 'car',
  car: () => 'method',
  method: () => 'cost',
  cost: () => 'driving',
  driving: () => 'running',
  running: () => 'result',
};

// Steps on the current branch of the tree, used for "Step n of N".
function path(d) {
  const steps = [FIRST];
  let s = FIRST;
  while (NEXT[s]) {
    s = NEXT[s](d);
    steps.push(s);
  }
  return steps;
}

export function startDraft(state, overrides = {}) {
  const car = newCar();
  return { car, hasPlate: null, step: FIRST, trail: [], jump: false, editingId: null, ...overrides };
}

function fieldsFor(step, car) {
  if (step === 'plateEntry') return ['plate'];
  if (step === 'car') return ['name', 'year'];
  if (step === 'cost') return costFields(car);
  if (step === 'driving') return DRIVING_FIELDS;
  if (step === 'running') return runningFields(car);
  return [];
}

// Label key variants that depend on the car (electric units, lease period wording).
function labelKey(field, car) {
  if (car.fuel === 'electric' && (field === 'kmPerUnit' || field === 'pricePerUnit')) return `${field}El`;
  if (field === 'yearsOfUse' && car.method === 'lease') return 'yearsOfUseLease';
  return field;
}

export function renderWizard(ctx) {
  const { state, t } = ctx;
  if (!state.draft) state.draft = startDraft(state);
  const d = state.draft;
  const car = d.car;
  const lang = state.lang;
  const steps = path(d);
  const index = Math.max(0, steps.indexOf(d.step));

  const go = (step, { push = true } = {}) => {
    if (push) d.trail.push(d.step);
    d.step = step;
    if (step === 'result') d.jump = false;
    ctx.save();
    ctx.render({ animate: true });
  };
  const back = () => {
    if (!d.trail.length) return;
    d.step = d.trail.pop();
    ctx.save();
    ctx.render({ animate: true, back: true });
  };
  const advance = () => go(d.jump ? (d.step === 'method' ? 'cost' : 'result') : NEXT[d.step](d));

  // ----- header: progress and escape hatch -----
  const editing = d.editingId ? state.cars.find((c) => c.id === d.editingId) : null;
  const head = el('div', { class: 'wizard-head' },
    el('p', { class: 'step-count' }, fmt(t.wizard.stepOf, { n: index + 1, total: steps.length })),
    el('button', {
      type: 'button', class: 'link',
      onclick: () => { state.draft = null; ctx.save(); editing ? ctx.go(`#/car/${editing.id}`) : ctx.render(); },
    }, editing ? t.wizard.discard : t.wizard.startOver));
  const track = el('div', { class: 'track', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(steps.length), 'aria-valuenow': String(index + 1) },
    el('span', { style: `width:${((index + 1) / steps.length) * 100}%` }));

  const body = el('section', { class: 'step', 'aria-live': 'polite' });
  const intro = !editing && d.step === FIRST && !d.trail.length
    ? el('header', { class: 'intro' }, el('h1', {}, t.intro.title), el('p', {}, t.intro.sub))
    : editing ? el('p', { class: 'editing' }, fmt(t.wizard.editing, { name: carTitle(editing, t) })) : null;

  // ----- step content -----
  if (d.step === 'plate') {
    body.append(el('h2', {}, t.steps.plate.title),
      choiceList(['yes', 'no'], (k) => t.steps.plate[k], d.hasPlate, (k) => {
        d.hasPlate = k;
        if (k === 'no') car.plate = '';
        if (d.jump && k === 'no') go('result');
        else if (d.jump) go('plateEntry');
        else advance();
      }));
  } else if (d.step === 'method') {
    body.append(el('h2', {}, t.steps.method.title),
      choiceList(METHODS, (k) => t.steps.method[k], d.editingId || d.jump ? car.method : null, (k) => {
        car.method = k;
        if (k === 'cash') car.downPayment = 1;
        if (k === 'finance' && car.downPayment >= 1) car.downPayment = 0.2;
        advance();
      }));
  } else if (d.step === 'result') {
    body.append(renderResult(ctx, d));
  } else {
    body.append(renderForm(ctx, d, advance));
  }

  const nav = d.trail.length && d.step !== FIRST
    ? el('button', { type: 'button', class: 'back', onclick: back }, svg(ICONS.back), t.wizard.back)
    : null;

  return el('div', { class: 'wizard' }, intro, head, track, nav, body);
}

function choiceList(keys, labelFor, selected, onPick) {
  return el('div', { class: 'choices' }, keys.map((k) => {
    const [title, sub] = labelFor(k);
    return el('button', {
      type: 'button', class: `choice${selected === k ? ' selected' : ''}`,
      onclick: () => onPick(k),
    }, el('span', { class: 'choice-title' }, title), el('span', { class: 'choice-sub' }, sub));
  }));
}

function renderForm(ctx, d, advance) {
  const { state, t } = ctx;
  const car = d.car;
  const lang = state.lang;
  const fields = fieldsFor(d.step, car);
  const form = el('form', { class: 'form', novalidate: true });
  const title = d.step === 'plateEntry' ? t.steps.plateEntry.title
    : d.step === 'car' ? t.steps.car.title
      : d.step === 'cost' ? t.steps.cost[car.method]
        : t.steps[d.step].title;
  form.append(el('h2', {}, title));
  const hint = ['plateEntry', 'running', 'driving'].includes(d.step) ? t.steps[d.step].hint : null;

  const errorNodes = {};
  const showErrors = (errs) => {
    for (const [f, node] of Object.entries(errorNodes)) {
      node.textContent = errs[f] ? t.errors[errs[f]] : '';
      node.closest('.field')?.classList.toggle('invalid', Boolean(errs[f]));
    }
  };

  if (d.step === 'plateEntry') {
    const input = el('input', {
      class: 'plate-input', type: 'text', value: car.plate, autocomplete: 'off', autocapitalize: 'characters',
      spellcheck: 'false', maxlength: '9', 'aria-label': t.fields.plate[0], placeholder: 'AB 12 345',
      oninput: (e) => {
        const formatted = formatPlate(e.target.value);
        e.target.value = formatted;
        car.plate = formatted;
        ctx.save();
      },
    });
    errorNodes.plate = el('p', { class: 'error', id: 'err-plate' });
    form.append(el('div', { class: 'field plate-field' },
      el('label', { class: 'plate plate-lg plate-edit' }, euStrip(), input), errorNodes.plate));
    setTimeout(() => input.focus(), 0);
  }

  if (d.step === 'car') {
    form.append(textField('name', car.name, t, (v) => { car.name = v; }, ctx, errorNodes));
    form.append(numberField('year', car, t, lang, ctx, errorNodes, { decimals: false }));
    form.append(fuelPicker(car, t, ctx));
  }

  // Switches that change which fields are asked; flipping one redraws the step.
  const switches = [];
  if (d.step === 'cost' && car.method === 'lease') switches.push('serviceIncluded', 'tyresIncluded');
  if (d.step === 'cost' && car.method !== 'lease') switches.push('depreciationAuto');
  if (d.step === 'running' && !(car.method === 'lease' && car.serviceIncluded !== false)) switches.push('maintenanceAuto');

  if (['cost', 'driving', 'running'].includes(d.step)) {
    const before = d.step === 'cost' && car.method !== 'lease' ? fields.filter((f) => f !== 'depreciationFactor') : fields;
    for (const f of before) form.append(numberField(f, car, t, lang, ctx, errorNodes, { label: labelKey(f, car) }));
    for (const key of switches) form.append(switchField(key, car, t, ctx));
    if (fields.includes('depreciationFactor') && d.step === 'cost') {
      form.append(numberField('depreciationFactor', car, t, lang, ctx, errorNodes));
    }
  }

  if (hint) form.append(el('p', { class: 'hint step-hint' }, hint));

  form.append(el('div', { class: 'actions' }, el('button', { type: 'submit', class: 'primary' }, t.wizard.next)));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errors = validate(car, fields);
    showErrors(errors);
    const first = fields.find((f) => errors[f]);
    if (first) {
      form.querySelector(`[data-field="${first}"]`)?.focus();
      return;
    }
    advance();
  });
  return form;
}

function textField(field, value, t, onValue, ctx, errorNodes) {
  const [label, , placeholder] = t.fields[field];
  const id = `f-${field}`;
  errorNodes[field] = el('p', { class: 'error', id: `err-${field}` });
  return el('div', { class: 'field' },
    el('label', { for: id }, label),
    el('div', { class: 'input-wrap' },
      el('input', {
        id, type: 'text', value, placeholder, 'data-field': field, autocomplete: 'off', maxlength: '60',
        'aria-describedby': `err-${field}`,
        oninput: (e) => { onValue(e.target.value); ctx.save(); },
      })),
    errorNodes[field]);
}

function numberField(field, car, t, lang, ctx, errorNodes, { label = field, decimals = true } = {}) {
  const [name, unit, help] = t.fields[label];
  const id = `f-${field}`;
  errorNodes[field] = el('p', { class: 'error', id: `err-${field}` });
  const input = el('input', {
    id, type: 'text', inputmode: decimals ? 'decimal' : 'numeric', 'data-field': field,
    value: toInputText(field, car[field], lang), placeholder: '0', autocomplete: 'off',
    'aria-describedby': `err-${field}${help ? ` help-${field}` : ''}`,
    oninput: (e) => {
      const v = parseNumber(e.target.value);
      car[field] = v == null ? 0 : fromShown(field, v);
      ctx.save();
    },
  });
  return el('div', { class: 'field' },
    el('label', { for: id }, name),
    el('div', { class: 'input-wrap' }, input, unit ? el('span', { class: 'unit' }, unit) : null),
    help ? el('p', { class: 'hint', id: `help-${field}` }, help) : null,
    errorNodes[field]);
}

function switchField(key, car, t, ctx) {
  const [label, help] = t.switches[key];
  const id = `s-${key}`;
  return el('div', { class: 'field switch-field' },
    el('label', { class: 'switch', for: id },
      el('input', {
        id, type: 'checkbox', role: 'switch', checked: car[key] !== false && (key !== 'tyresIncluded' || car[key] === true),
        onchange: (e) => { car[key] = e.target.checked; ctx.save(); ctx.render(); },
      }),
      el('span', { class: 'switch-text' }, label)),
    help ? el('p', { class: 'hint' }, help) : null);
}

function fuelPicker(car, t, ctx) {
  const group = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t.fields.fuel[0] });
  for (const f of FUELS) {
    group.append(el('button', {
      type: 'button', role: 'radio', 'aria-checked': String(car.fuel === f),
      onclick: (e) => {
        car.fuel = f;
        for (const b of group.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
        ctx.save();
      },
    }, t.fuel[f]));
  }
  return el('div', { class: 'field' }, el('span', { class: 'label' }, t.fields.fuel[0]), group);
}

function renderResult(ctx, d) {
  const { state, t } = ctx;
  const car = d.car;
  const lang = state.lang;
  const r = evaluate(car, state.settings);
  const { bar, legend } = breakdownBar(r.parts, t, lang);
  const editing = Boolean(d.editingId);

  const change = (step) => {
    d.trail.push('result');
    d.jump = true;
    d.step = step;
    ctx.save();
    ctx.render({ animate: true });
  };

  return el('div', { class: 'result' },
    el('h2', {}, t.steps.result.title),
    el('div', { class: 'result-head' },
      car.plate ? el('span', { class: 'plate plate-md' }, euStrip(), el('span', { class: 'plate-text' }, car.plate)) : null,
      el('p', { class: 'result-name' }, carTitle(car, t))),
    priceBlock(r, t, lang),
    assumptionBars(ctx),
    factsList(r, car, t, lang, state.settings),
    el('h3', {}, t.result.breakdown), bar, legend,
    answers(car, t, lang, change),
    el('div', { class: 'actions stack' },
      editing
        ? el('button', { type: 'button', class: 'primary', onclick: () => ctx.saveDraft({}) }, t.result.saveChanges)
        : [
          el('button', { type: 'button', class: 'primary', onclick: () => ctx.saveDraft({ mine: true }) }, t.result.saveMine),
          el('button', { type: 'button', class: 'secondary', onclick: () => ctx.saveDraft({ mine: false }) }, t.result.save),
        ]));
}

export function answers(car, t, lang, onChange) {
  const val = (f) => {
    const unit = t.fields[labelKey(f, car)][1];
    const n = toShown(f, car[f]);
    return `${plain(n, lang)}${unit ? ` ${unit}` : ''}`;
  };
  const row = (f) => el('div', {}, el('dt', {}, t.fields[labelKey(f, car)][0]), el('dd', {}, val(f)));
  const flag = (key) => el('div', {}, el('dt', {}, t.switches[key][0]), el('dd', {}, car[key] === true || (car[key] !== false && key !== 'tyresIncluded') ? t.yes : t.no));
  const groups = [
    ['car', 'plate', [
      el('div', {}, el('dt', {}, t.fields.name[0]), el('dd', {}, carTitle(car, t))),
      car.plate ? el('div', {}, el('dt', {}, t.fields.plate[0]), el('dd', {}, car.plate)) : null,
      el('div', {}, el('dt', {}, t.fields.year[0]), el('dd', {}, String(car.year || ''))),
      el('div', {}, el('dt', {}, t.fields.fuel[0]), el('dd', {}, t.fuel[car.fuel])),
    ]],
    ['payment', 'method', [
      el('div', {}, el('dt', {}, t.result.methodLabel), el('dd', {}, t.steps.method[car.method][0])),
      ...costFields(car).map(row),
      ...(car.method === 'lease' ? ['serviceIncluded', 'tyresIncluded'] : ['depreciationAuto']).map(flag),
    ]],
    ['driving', 'driving', DRIVING_FIELDS.map(row)],
    ['running', 'running', [
      ...runningFields(car).map(row),
      car.method === 'lease' && car.serviceIncluded !== false ? null : flag('maintenanceAuto'),
    ]],
  ];
  return el('div', { class: 'answers' }, groups.map(([key, step, rows]) =>
    el('section', { class: 'answer-group' },
      el('div', { class: 'answer-head' },
        el('h3', {}, t.result.groups[key]),
        onChange ? el('button', { type: 'button', class: 'link', onclick: () => onChange(step) }, t.result.change) : null),
      el('dl', { class: 'facts small' }, rows))));
}
