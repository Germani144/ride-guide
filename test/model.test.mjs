import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/engine.js';
import {
  sanitizeCar, toEngineInput, migrate, formatPlate, parseNumber, validate, newCar, inferMethod,
} from '../src/model.js';
import { SEED_CARS } from '../src/seed.js';

test('seed cars give the same results through the model as straight from the sheet', () => {
  for (const seed of SEED_CARS) {
    const direct = calculate(seed);
    const viaModel = calculate(toEngineInput(sanitizeCar(seed)));
    for (const k of ['total', 'kmCost', 'fixed', 'variable', 'cashflow', 'spent']) {
      assert.ok(Math.abs(direct[k] - viaModel[k]) < 1e-9, `${seed.name} ${k}`);
    }
  }
});

test('payment method is inferred from the sheet columns', () => {
  const methods = Object.fromEntries(SEED_CARS.map((c) => [c.name, sanitizeCar(c).method]));
  assert.equal(methods['Fiesta GM'], 'lease');
  assert.equal(methods.CeedGM, 'lease');
  assert.equal(methods.MondeoI, 'cash');
  assert.equal(inferMethod({ financeMonths: 60, downPayment: 0.2 }), 'finance');
});

test('fields of other methods do not count', () => {
  const car = newCar({
    method: 'lease', leaseMo: 3000, yearsOfUse: 3, price: 300000, apr: 0.05, financeMonths: 60,
    downPayment: 0.2, depreciationFactor: 0.1, kmPerYear: 10000, kmPerUnit: 15, pricePerUnit: 13,
  });
  const lease = toEngineInput(car);
  assert.equal(lease.price, 0);
  assert.equal(lease.financeMonths, 0);
  const cash = toEngineInput({ ...car, method: 'cash' });
  assert.equal(cash.leaseMo, 0);
  assert.equal(cash.downPayment, 1);
  assert.equal(cash.price, 300000);
  const fin = toEngineInput({ ...car, method: 'finance' });
  assert.equal(fin.apr, 0.05);
  assert.equal(fin.leaseMo, 0);
});

test('migrates the v0.1 grid state and keeps settings', () => {
  const v1 = { version: 1, lang: 'da', settings: { buffer: 0.1 }, cars: SEED_CARS.map((c) => ({ id: 'x' + c.name, ...c })) };
  const s = migrate(v1);
  assert.equal(s.version, 2);
  assert.equal(s.lang, 'da');
  assert.equal(s.settings.buffer, 0.1);
  assert.equal(s.cars.length, SEED_CARS.length);
  assert.ok(s.cars.every((c) => c.mine === false && c.method));
  assert.equal(migrate({ nope: true }), null);
  assert.equal(migrate(null), null);
});

test('plates are formatted the Danish way', () => {
  assert.equal(formatPlate('ab12345'), 'AB 12 345');
  assert.equal(formatPlate('Ab 12-34'), 'AB 12 34');
  assert.equal(formatPlate('ab'), 'AB');
  assert.equal(formatPlate('pedro1'), 'PEDRO1');
});

test('numbers parse in Danish and English notation', () => {
  assert.equal(parseNumber('13,69'), 13.69);
  assert.equal(parseNumber('13.69'), 13.69);
  assert.equal(parseNumber('250.000'), 250000);
  assert.equal(parseNumber('250 000 kr'), 250000);
  assert.equal(parseNumber('1.234,5'), 1234.5);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('abc'), null);
});

test('validation follows the payment method', () => {
  const fin = newCar({ method: 'finance', price: 200000, yearsOfUse: 3, downPayment: 1 });
  const e = validate(fin, ['price', 'downPayment', 'apr', 'financeMonths', 'yearsOfUse']);
  assert.equal(e.downPayment, 'downPaymentRange');
  assert.equal(e.apr, 'required');
  assert.equal(e.financeMonths, 'required');
  assert.equal(e.price, undefined);
  const lease = newCar({ method: 'lease', leaseMo: 0 });
  assert.equal(validate(lease, ['leaseMo']).leaseMo, 'required');
  assert.deepEqual(validate(newCar({ name: 'Ok' }), ['name']), {});
});

test('breakdown parts add up to the cash paid out per month', async () => {
  const { costParts, PART_KEYS } = await import('../src/model.js');
  for (const seed of SEED_CARS) {
    const input = toEngineInput(sanitizeCar(seed));
    const out = calculate(input);
    const parts = costParts(input, out);
    const sum = PART_KEYS.reduce((a, k) => a + parts[k], 0);
    assert.ok(Math.abs(sum - (out.fixed + out.variable)) < 1e-6, `${seed.name}: ${sum} vs ${out.fixed + out.variable}`);
  }
});
