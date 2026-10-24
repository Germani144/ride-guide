// "New car": the landing page. A decision tree that asks one thing per screen,
// starting with the most general question (do you have the plate?).
import {
  newCar,
  METHODS,
  DRIVING_FIELDS,
  costFields,
  runningFields,
  formatPlate,
  validate,
} from '../model.js';
import { fmt } from '../i18n.js';
import { el, svg, ICONS, euStrip, carTitle } from '../ui.js';
import { labelKey, choiceList, textField, numberField, switchField, fuelPicker } from './fields.js';
import { renderResult } from './result.js';

const FIRST = 'plate';
const NEXT = {
  plate: d => (d.hasPlate === 'yes' ? 'plateEntry' : 'car'),
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
  const editing = d.editingId ? state.cars.find(c => c.id === d.editingId) : null;
  const head = el(
    'div',
    { class: 'wizard-head' },
    el('p', { class: 'step-count' }, fmt(t.wizard.stepOf, { n: index + 1, total: steps.length })),
    el(
      'button',
      {
        type: 'button',
        class: 'link',
        onclick: () => {
          state.draft = null;
          ctx.save();
          editing ? ctx.go(`#/car/${editing.id}`) : ctx.render();
        },
      },
      editing ? t.wizard.discard : t.wizard.startOver,
    ),
  );
  const track = el(
    'div',
    {
      class: 'track',
      role: 'progressbar',
      'aria-valuemin': '1',
      'aria-valuemax': String(steps.length),
      'aria-valuenow': String(index + 1),
    },
    el('span', { style: `width:${((index + 1) / steps.length) * 100}%` }),
  );

  const body = el('section', { class: 'step', 'aria-live': 'polite' });
  const intro =
    !editing && d.step === FIRST && !d.trail.length
      ? el('header', { class: 'intro' }, el('h1', {}, t.intro.title), el('p', {}, t.intro.sub))
      : editing
        ? el('p', { class: 'editing' }, fmt(t.wizard.editing, { name: carTitle(editing, t) }))
        : null;

  // ----- step content -----
  if (d.step === 'plate') {
    body.append(
      el('h2', {}, t.steps.plate.title),
      choiceList(
        ['yes', 'no'],
        k => t.steps.plate[k],
        d.hasPlate,
        k => {
          d.hasPlate = k;
          if (k === 'no') car.plate = '';
          if (d.jump && k === 'no') go('result');
          else if (d.jump) go('plateEntry');
          else advance();
        },
      ),
    );
  } else if (d.step === 'method') {
    body.append(
      el('h2', {}, t.steps.method.title),
      choiceList(
        METHODS,
        k => t.steps.method[k],
        d.editingId || d.jump ? car.method : null,
        k => {
          car.method = k;
          if (k === 'cash') car.downPayment = 1;
          if (k === 'finance' && car.downPayment >= 1) car.downPayment = 0.2;
          advance();
        },
      ),
    );
  } else if (d.step === 'result') {
    body.append(renderResult(ctx, d));
  } else {
    body.append(renderForm(ctx, d, advance));
  }

  const nav =
    d.trail.length && d.step !== FIRST
      ? el('button', { type: 'button', class: 'back', onclick: back }, svg(ICONS.back), t.wizard.back)
      : null;

  return el('div', { class: 'wizard' }, intro, head, track, nav, body);
}

function renderForm(ctx, d, advance) {
  const { state, t } = ctx;
  const car = d.car;
  const lang = state.lang;
  const fields = fieldsFor(d.step, car);
  const form = el('form', { class: 'form', novalidate: true });
  const title =
    d.step === 'plateEntry'
      ? t.steps.plateEntry.title
      : d.step === 'car'
        ? t.steps.car.title
        : d.step === 'cost'
          ? t.steps.cost[car.method]
          : t.steps[d.step].title;
  form.append(el('h2', {}, title));
  const hint = ['plateEntry', 'running', 'driving'].includes(d.step) ? t.steps[d.step].hint : null;

  const errorNodes = {};
  const showErrors = errs => {
    for (const [f, node] of Object.entries(errorNodes)) {
      node.textContent = errs[f] ? t.errors[errs[f]] : '';
      node.closest('.field')?.classList.toggle('invalid', Boolean(errs[f]));
    }
  };

  if (d.step === 'plateEntry') {
    const input = el('input', {
      class: 'plate-input',
      type: 'text',
      value: car.plate,
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: 'false',
      maxlength: '9',
      'aria-label': t.fields.plate[0],
      placeholder: 'AB 12 345',
      oninput: e => {
        const formatted = formatPlate(e.target.value);
        e.target.value = formatted;
        car.plate = formatted;
        ctx.save();
      },
    });
    errorNodes.plate = el('p', { class: 'error', id: 'err-plate' });
    form.append(
      el(
        'div',
        { class: 'field plate-field' },
        el('label', { class: 'plate plate-lg plate-edit' }, euStrip(), input),
        errorNodes.plate,
      ),
    );
    setTimeout(() => input.focus(), 0);
  }

  if (d.step === 'car') {
    form.append(
      textField(
        'name',
        car.name,
        t,
        v => {
          car.name = v;
        },
        ctx,
        errorNodes,
      ),
    );
    form.append(numberField('year', car, t, lang, ctx, errorNodes, { decimals: false }));
    form.append(fuelPicker(car, t, ctx));
  }

  // Switches that change which fields are asked; flipping one redraws the step.
  const switches = [];
  if (d.step === 'cost' && car.method === 'lease') switches.push('serviceIncluded', 'tyresIncluded');
  if (d.step === 'cost' && car.method !== 'lease') switches.push('depreciationAuto');
  if (d.step === 'running' && !(car.method === 'lease' && car.serviceIncluded !== false))
    switches.push('maintenanceAuto');

  if (['cost', 'driving', 'running'].includes(d.step)) {
    const before =
      d.step === 'cost' && car.method !== 'lease' ? fields.filter(f => f !== 'depreciationFactor') : fields;
    for (const f of before)
      form.append(numberField(f, car, t, lang, ctx, errorNodes, { label: labelKey(f, car) }));
    for (const key of switches) form.append(switchField(key, car, t, ctx));
    if (fields.includes('depreciationFactor') && d.step === 'cost') {
      form.append(numberField('depreciationFactor', car, t, lang, ctx, errorNodes));
    }
  }

  if (hint) form.append(el('p', { class: 'hint step-hint' }, hint));

  form.append(
    el('div', { class: 'actions' }, el('button', { type: 'submit', class: 'primary' }, t.wizard.next)),
  );
  form.addEventListener('submit', e => {
    e.preventDefault();
    const errors = validate(car, fields);
    showErrors(errors);
    const first = fields.find(f => errors[f]);
    if (first) {
      form.querySelector(`[data-field="${first}"]`)?.focus();
      return;
    }
    advance();
  });
  return form;
}
