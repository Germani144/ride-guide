import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculate, pmt, ipmt } from '../src/engine-sheet.js';

const cars = JSON.parse(readFileSync(new URL('../data/sheet_fixtures.json', import.meta.url)));
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 0.01, `${label}: engine ${a} vs sheet ${b}`);

// Canonical columns (Fiesta GM onward) must reproduce the sheet's cached values.
for (const car of cars.filter(c => c.canonical)) {
  test(`matches sheet: ${car.name}`, () => {
    const out = calculate({ name: car.name, ...car.input });
    const e = car.expected;
    close(out.fixed, e.fixed, 'fixed');
    close(out.variable, e.variable, 'variable');
    close(out.total, e.total, 'total');
    close(out.cashflow, e.cashflow, 'cashflow');
    close(out.kmCost, e.kmCost, 'kr/km');
    close(out.residual, e.residual, 'residual');
    close(out.spent, e.spent, 'money spent');
    if (e.projection != null) close(out.projection, e.projection, 'projection');
  });
}

test('pmt and ipmt behave like Excel', () => {
  // Excel: PMT(0.05/12, 60, 100000) = 1887.12 (as positive payment)
  assert.ok(Math.abs(pmt(0.05 / 12, 60, 100000) - 1887.12) < 0.01);
  // First-period interest is balance * rate; Excel returns it negative.
  assert.ok(Math.abs(ipmt(0.05 / 12, 1, 60, 100000) + 416.67) < 0.01);
  assert.equal(ipmt(0.05 / 12, 61, 60, 100000), 0);
  assert.equal(pmt(0, 10, 1000), 100);
});

test('financed purchase: equity credit lowers cost versus paying the full instalment', () => {
  const base = {
    name: 't',
    year: 2024,
    yearsOfUse: 3,
    downPayment: 0.2,
    oneTimePayment: 0,
    returnFee: 0,
    depreciationFactor: 0.1,
    kmPerUnit: 18,
    pricePerUnit: 13,
    kmPerYear: 12000,
    insuranceMo: 500,
    greenTaxMo: 100,
    maintenanceMo: 200,
    parkingMo: 0,
    leaseMo: 0,
    apr: 0.06,
    financeMonths: 60,
    price: 200000,
  };
  const out = calculate(base);
  assert.ok(out.financeMo > 0);
  assert.ok(out.total < out.fixed + out.variable, 'credit must reduce the total');
  assert.ok(Number.isFinite(out.total) && Number.isFinite(out.kmCost));
});

test('safe on empty input', () => {
  const out = calculate({ name: 'x', yearsOfUse: 0, price: 0 });
  for (const v of [out.total, out.kmCost, out.fixed, out.spent]) assert.ok(Number.isFinite(v));
});

// Financed scenarios: values set in a copy of the workbook and recalculated by LibreOffice.
const financed = JSON.parse(readFileSync(new URL('../data/sheet_fixtures_financed.json', import.meta.url)));
for (const car of financed) {
  test(`matches sheet (financed): ${car.name}`, () => {
    const out = calculate({ name: car.name, ...car.input });
    close(out.financeMo, car.financeMo, 'finance/mo');
    close(out.total, car.total, 'total');
    close(out.kmCost, car.kmCost, 'kr/km');
  });
}
