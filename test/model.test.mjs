import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculate, DEFAULT_SETTINGS, PART_KEYS } from '../src/engine.js';
import {
  sanitizeCar, toEngineInput, migrate, formatPlate, parseNumber, validate, newCar, inferMethod,
  costFields, runningFields, STATE_VERSION, toShown, fromShown,
} from '../src/model.js';
import { SEED_CARS } from '../src/seed.js';

test('every seed car gives finite results through the model', () => {
  for (const seed of SEED_CARS) {
    const out = calculate(toEngineInput(sanitizeCar(seed), { year: 2026 }));
    assert.ok(Number.isFinite(out.perMonth) && out.perMonth > 0, seed.name);
    assert.ok(Number.isFinite(out.perKm), seed.name);
  }
});

test('the app version is the same in version.js and package.json', () => {
  const js = readFileSync(new URL('../src/version.js', import.meta.url), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(js.match(/RIDEGUIDE_VERSION = '([^']+)'/)[1], pkg.version);
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
  assert.equal(lease.leaseYears, 3);
  const cash = toEngineInput({ ...car, method: 'cash' });
  assert.equal(cash.leaseMo, 0);
  assert.equal(cash.downPayment, 1);
  assert.equal(cash.price, 300000);
  assert.equal(cash.leaseYears, 0);
  const fin = toEngineInput({ ...car, method: 'finance' });
  assert.equal(fin.apr, 0.05);
  assert.equal(fin.leaseMo, 0);
  assert.equal(toEngineInput({ ...car, year: 2020 }, { year: 2026 }).age, 6);
  assert.equal(toEngineInput({ ...car, year: 0 }, { year: 2026 }).age, 0);
});

test('migrates the v0.1 grid state and keeps settings', () => {
  const v1 = { version: 1, lang: 'da', settings: { buffer: 0.1 }, cars: SEED_CARS.map((c) => ({ id: 'x' + c.name, ...c })) };
  const s = migrate(v1);
  assert.equal(s.version, STATE_VERSION);
  assert.equal(s.lang, 'da');
  assert.equal(s.settings.buffer, 0.1);
  assert.equal(s.settings.returnRate, DEFAULT_SETTINGS.returnRate);
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

test('v2 data moves to v3: new switches on, the old 15% buffer becomes the new default', () => {
  const v2 = { version: 2, lang: 'en', settings: { buffer: 0.15 }, cars: [{ name: 'Old', method: 'cash', price: 100000, depreciationFactor: 0.03 }] };
  const s = migrate(v2);
  assert.equal(s.version, STATE_VERSION);
  assert.equal(s.settings.buffer, DEFAULT_SETTINGS.buffer);
  assert.equal(s.settings.years, DEFAULT_SETTINGS.years);
  const car = s.cars[0];
  assert.equal(car.depreciationAuto, true);
  assert.equal(car.maintenanceAuto, true);
  assert.equal(car.depreciationFactor, 0.03, 'the old value is kept for the manual mode');
  // A buffer the user changed is kept, and junk settings fall back to defaults.
  const kept = migrate({ version: 2, settings: { buffer: 0.08, years: -1, returnRate: 'x' }, cars: [] });
  assert.equal(kept.settings.buffer, 0.08);
  assert.equal(kept.settings.years, DEFAULT_SETTINGS.years);
  assert.equal(kept.settings.returnRate, DEFAULT_SETTINGS.returnRate);
});

test('switches decide which fields are asked', () => {
  const cash = newCar({ method: 'cash' });
  assert.deepEqual(costFields(cash), ['price']);
  assert.deepEqual(costFields({ ...cash, depreciationAuto: false }), ['price', 'depreciationFactor']);
  assert.ok(!runningFields(cash).includes('maintenanceMo'));
  assert.ok(runningFields({ ...cash, maintenanceAuto: false }).includes('maintenanceMo'));
  const lease = newCar({ method: 'lease', maintenanceAuto: false });
  assert.ok(!runningFields(lease).includes('maintenanceMo'), 'service included in the lease');
  assert.ok(runningFields({ ...lease, serviceIncluded: false }).includes('maintenanceMo'));
  assert.ok(costFields(lease).includes('yearsOfUse'));
});

test('breakdown parts add up to the monthly cost', () => {
  for (const seed of SEED_CARS) {
    const out = calculate(toEngineInput(sanitizeCar(seed), { year: 2026 }));
    const sum = PART_KEYS.reduce((a, k) => a + out.parts[k], 0);
    assert.ok(Math.abs(sum - out.perMonth) < 1e-6, `${seed.name}: ${sum} vs ${out.perMonth}`);
  }
});

test('v3 data moves to v4: 3 years by default, km per year shared by all cars', () => {
  const v3 = { version: 3, settings: { years: 5, buffer: 0.05 }, cars: [{ name: 'A', method: 'cash', price: 1, kmPerYear: 8000 }] };
  const s = migrate(v3);
  assert.equal(s.version, 4);
  assert.equal(s.settings.years, 3);
  assert.equal(s.settings.kmPerYear, 10000);
  assert.equal(migrate({ ...v3, settings: { years: 6 } }).settings.years, 6, 'a chosen span is kept');
  // The car's own km no longer count: the shared value does.
  assert.equal(toEngineInput(s.cars[0], { kmPerYear: s.settings.kmPerYear }).kmPerYear, 10000);
});

test('green tax is typed per half year and stored per month', () => {
  assert.equal(fromShown('greenTaxMo', 1200), 200);
  assert.equal(toShown('greenTaxMo', 200), 1200);
  assert.equal(toShown('apr', 0.05), 5);
  assert.equal(toShown('price', 1000), 1000);
});
