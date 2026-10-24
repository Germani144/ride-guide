// The "New car" wizard's step logic (src/wizard-flow.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_STEP,
  newDraft,
  stepPath,
  stepProgress,
  nextStep,
  stepAfterPlateAnswer,
  choosePaymentMethod,
  stepFields,
  stepSwitches,
  stepLayout,
  labelKey,
} from '../src/wizard-flow.js';
import { newCar } from '../src/model.js';

test('a new draft starts at the plate question with a fresh car', () => {
  const d = newDraft();
  assert.equal(d.step, FIRST_STEP);
  assert.deepEqual([d.hasPlate, d.trail, d.jump, d.editingId], [null, [], false, null]);
  assert.equal(d.car.method, 'cash');
  assert.equal(newDraft({ step: 'result' }).step, 'result');
});

test('the plate answer decides whether the plate step is on the path', () => {
  assert.deepEqual(stepPath(newDraft({ hasPlate: 'yes' })), [
    'plate',
    'plateEntry',
    'car',
    'method',
    'cost',
    'driving',
    'running',
    'result',
  ]);
  assert.equal(stepPath(newDraft({ hasPlate: 'no' })).length, 7);
  assert.deepEqual(stepProgress(newDraft({ hasPlate: 'no', step: 'method' })), { n: 3, total: 7 });
});

test('next step: in order, or back to the result when changing one answer', () => {
  assert.equal(nextStep(newDraft({ step: 'car' })), 'method');
  assert.equal(nextStep(newDraft({ step: 'running' })), 'result');
  assert.equal(nextStep(newDraft({ step: 'driving', jump: true })), 'result');
  assert.equal(nextStep(newDraft({ step: 'method', jump: true })), 'cost', 'a new method needs its terms');
  assert.equal(stepAfterPlateAnswer(newDraft({ hasPlate: 'yes' })), 'plateEntry');
  assert.equal(stepAfterPlateAnswer(newDraft({ hasPlate: 'no' })), 'car');
  assert.equal(stepAfterPlateAnswer(newDraft({ hasPlate: 'no', jump: true })), 'result');
  assert.equal(stepAfterPlateAnswer(newDraft({ hasPlate: 'yes', jump: true })), 'plateEntry');
});

test('choosing a payment method sets the down payment it implies', () => {
  assert.equal(choosePaymentMethod(newCar({ downPayment: 0.3 }), 'cash').downPayment, 1);
  assert.equal(choosePaymentMethod(newCar({ downPayment: 1 }), 'finance').downPayment, 0.2);
  assert.equal(choosePaymentMethod(newCar({ downPayment: 0.3 }), 'finance').downPayment, 0.3);
  assert.equal(choosePaymentMethod(newCar({ downPayment: 0.3 }), 'lease').downPayment, 0.3);
});

test('each step asks its fields and switches, in order', () => {
  const cash = newCar({ method: 'cash' });
  const lease = newCar({ method: 'lease' });
  assert.deepEqual(stepFields('car', cash), ['name', 'year']);
  assert.deepEqual(stepFields('plateEntry', cash), ['plate']);
  assert.deepEqual(stepFields('driving', cash), ['kmPerUnit']);
  assert.deepEqual(stepFields('method', cash), []);
  assert.deepEqual(stepSwitches('cost', cash), ['depreciationAuto']);
  assert.deepEqual(stepSwitches('cost', lease), ['serviceIncluded', 'tyresIncluded']);
  assert.deepEqual(stepSwitches('running', cash), ['maintenanceAuto']);
  assert.deepEqual(stepSwitches('running', lease), [], 'service included: no maintenance switch');
  assert.deepEqual(stepSwitches('running', { ...lease, serviceIncluded: false }), ['maintenanceAuto']);
  // The manual loss in value comes after the switch that reveals it.
  assert.deepEqual(stepLayout('cost', { ...cash, depreciationAuto: false }), {
    fields: ['price', 'depreciationFactor'],
    before: ['price'],
    switches: ['depreciationAuto'],
    after: ['depreciationFactor'],
  });
  assert.deepEqual(stepLayout('cost', lease).after, []);
});

test('labels depend on the fuel and the payment method', () => {
  assert.equal(labelKey('kmPerUnit', newCar({ fuel: 'electric' })), 'kmPerUnitEl');
  assert.equal(labelKey('kmPerUnit', newCar({ fuel: 'diesel' })), 'kmPerUnit');
  assert.equal(labelKey('yearsOfUse', newCar({ method: 'lease' })), 'yearsOfUseLease');
  assert.equal(labelKey('price', newCar()), 'price');
});
