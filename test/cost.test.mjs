// Tests for the cost engine (src/engine.js): the money maths and each modelled cost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, valueCurve, yearlyValueLoss, pmt, DEFAULT_SETTINGS, MAINTENANCE } from '../src/engine.js';

const near = (a, b, tol, label) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);
const base = {
  fuel: 'petrol', age: 0, kmPerYear: 15000, kmPerUnit: 15, pricePerUnit: 14,
  insuranceMo: 0, greenTaxMo: 0, parkingMo: 0, depreciationAuto: true, maintenanceAuto: true,
};
// Only the money parts: no running costs, no margin, no return.
const bare = { buffer: 0, returnRate: 0, tyreSetPrice: 0, inspectionPrice: 0, roadsideYear: 0, washingMo: 0 };
const noRunning = { ...base, kmPerUnit: 0, maintenanceAuto: false, maintenanceMo: 0 };

test('value curve: a bigger first-year loss, then a steady yearly loss', () => {
  near(valueCurve('petrol', 15000, 0), 1, 1e-12, 'new');
  near(valueCurve('petrol', 15000, 1), 0.8, 1e-12, 'one year');
  near(valueCurve('petrol', 15000, 3), 0.8 * 0.88 ** 2, 1e-12, 'three years');
  near(yearlyValueLoss('petrol', 25000), 0.14, 1e-12, 'driving more loses more');
  near(yearlyValueLoss('petrol', 500000), 0.30, 1e-12, 'capped');
});

test('cash with no return: the cost is the plain loss in value', () => {
  const out = calculate({ ...noRunning, method: 'cash', price: 200000, downPayment: 1 }, { ...bare, years: 3 });
  const residual = 200000 * 0.8 * 0.88 ** 2;
  near(out.residual, residual, 1e-6, 'residual');
  near(out.perMonth, (200000 - residual) / 36, 1e-6, 'per month');
  near(out.parts.capital, 0, 1e-6, 'no money tied up at 0%');
  assert.equal(out.upfront, 200000);
});

test('money tied up: return lost on the price, compounding, net of the sale', () => {
  const r = 0.04;
  const out = calculate({ ...noRunning, method: 'cash', price: 200000, downPayment: 1 }, { ...bare, returnRate: r, years: 3 });
  const rm = (1 + r) ** (1 / 12) - 1;
  let a = 0;
  for (let k = 1; k <= 36; k++) a += (1 + rm) ** -k;
  const expected = (200000 - out.residual * (1 + rm) ** -36) / a;
  near(out.perMonth, expected, 1e-6, 'equivalent monthly cost');
  assert.ok(out.parts.capital > 0);
  near(out.parts.depreciation + out.parts.capital, out.perMonth, 1e-6, 'split adds up');
});

test('a car bought used continues down the curve', () => {
  const out = calculate({ ...noRunning, method: 'cash', price: 100000, age: 5 }, { ...bare, years: 2 });
  near(out.residual, 100000 * 0.88 ** 2, 1e-6, 'two more years at the yearly rate');
});

test('manual loss in value uses the typed yearly rate', () => {
  const out = calculate({ ...noRunning, method: 'cash', price: 100000, depreciationAuto: false, depreciationFactor: 0.1 }, { ...bare, years: 2 });
  near(out.residual, 100000 / 1.1 ** 2, 1e-6, 'residual');
});

test('finance: interest is paid, the rest of the loan is paid off at the sale', () => {
  const car = { ...noRunning, method: 'finance', price: 200000, downPayment: 0.2, apr: 0.06, financeMonths: 84 };
  const out = calculate(car, { ...bare, years: 3 });
  const payment = pmt(0.005, 84, 160000);
  let bal = 160000;
  let interest = 0;
  for (let k = 0; k < 36; k++) { const i = bal * 0.005; interest += i; bal -= payment - i; }
  near(out.interestPaid, interest, 1e-6, 'interest');
  near(out.loanLeft, bal, 1e-6, 'loan left');
  near(out.upfront, 40000, 1e-9, 'down payment');
  // With no return on money, finance costs exactly cash plus the interest.
  const cash = calculate({ ...car, method: 'cash', downPayment: 1 }, { ...bare, years: 3 });
  near(out.perMonth, cash.perMonth + interest / 36, 1e-6, 'cash + interest');
});

test('finance at 0% beats cash once your money earns a return', () => {
  const s = { ...bare, returnRate: 0.04, years: 3 };
  const car = { ...noRunning, method: 'finance', price: 200000, downPayment: 0, apr: 0, financeMonths: 36 };
  const fin = calculate(car, s);
  const cash = calculate({ ...car, method: 'cash', downPayment: 1 }, s);
  assert.ok(fin.perMonth < cash.perMonth);
  assert.ok(fin.parts.capital < cash.parts.capital);
});

test('lease renews to fill the time span, a partial last lease pro rata', () => {
  const car = { ...noRunning, method: 'lease', leaseMo: 3000, oneTimePayment: 12000, returnFee: 1200, leaseYears: 2, serviceIncluded: true };
  const out = calculate(car, { ...bare, years: 3 });
  // 36 months of 3000, one-time 12000 + 6000, return fee 1200 + 600
  near(out.perMonth, (36 * 3000 + 18000 + 1800) / 36, 1e-6, 'per month');
  assert.equal(out.upfront, 12000);
  assert.equal(out.parts.buffer, 0, 'no margin on leases');
});

test('maintenance rises with age and is skipped when the lease includes service', () => {
  const s = { ...bare, years: 1 };
  const young = calculate({ ...base, kmPerUnit: 0, method: 'cash', price: 0, age: 0 }, s).parts.maintenance;
  const old = calculate({ ...base, kmPerUnit: 0, method: 'cash', price: 0, age: 10 }, s).parts.maintenance;
  assert.ok(old > young * 1.5);
  const m = MAINTENANCE.petrol;
  near(young, ((m.baseYear + m.perKm * 15000) / 12) * (1 + MAINTENANCE.ageGrowth * 0.5), 1e-6, 'average over the first year');
  const lease = calculate({ ...base, kmPerUnit: 0, method: 'lease', leaseMo: 1, leaseYears: 1, serviceIncluded: true }, s);
  assert.equal(lease.parts.maintenance, 0);
});

test('tyres per km, plus swaps for winter tyres; included tyres cost nothing', () => {
  const s = { ...bare, years: 1, tyreSetPrice: 3600, tyreLifeKm: 36000 };
  const car = { ...noRunning, method: 'cash', price: 0, kmPerYear: 12000 };
  near(calculate(car, s).parts.tyres, 100, 1e-9, '1000 km a month at 0.10 kr per km');
  near(calculate(car, { ...s, winterTyres: true, tyreSwapPrice: 300 }).parts.tyres, 150, 1e-9, 'plus 600 a year');
  assert.equal(calculate({ ...car, method: 'lease', leaseMo: 1, leaseYears: 1, tyresIncluded: true }, s).parts.tyres, 0);
});

test('inspection at 4 years, then every 2; roadside only for owned cars', () => {
  const s = { ...bare, years: 4, inspectionPrice: 480 };
  const car = { ...noRunning, method: 'cash', price: 0, age: 3 };
  near(calculate(car, s).parts.other, (2 * 480) / 48, 1e-9, 'inspections at age 4 and 6');
  near(calculate(car, { ...s, inspectionPrice: 0, roadsideYear: 600 }).parts.other, 50, 1e-9, 'roadside');
  near(calculate({ ...car, method: 'lease', leaseMo: 1, leaseYears: 4 }, { ...s, inspectionPrice: 0, roadsideYear: 600 }).parts.other, 0, 1e-9, 'lease');
});

test('electric energy mixes home and public charging, with extra use in the cold', () => {
  const car = { ...noRunning, fuel: 'electric', kmPerUnit: 6, pricePerUnit: 1.5, kmPerYear: 12000, method: 'cash', price: 0 };
  const s = { ...bare, years: 1, evPublicShare: 0.25, evPublicPrice: 3.5, evWinterExtra: 0.2 };
  near(calculate(car, s).parts.energy, (1000 / (6 / 1.2)) * (0.75 * 1.5 + 0.25 * 3.5), 1e-9, 'energy');
});

test('insurance on an owned car follows its value down; on a lease it stays', () => {
  const s = { ...bare, years: 5 };
  const own = calculate({ ...noRunning, method: 'cash', price: 300000, insuranceMo: 600 }, s);
  assert.ok(own.parts.insurance < 600 && own.parts.insurance > 300);
  const lease = calculate({ ...noRunning, method: 'lease', leaseMo: 1, leaseYears: 5, insuranceMo: 600 }, s);
  near(lease.parts.insurance, 600, 1e-9, 'lease');
});

test('the safety margin applies to owned cars only', () => {
  const s = { ...bare, years: 3, buffer: 0.05 };
  const out = calculate({ ...noRunning, method: 'cash', price: 100000 }, s);
  near(out.parts.buffer, (out.perMonth - out.parts.buffer) * 0.05, 1e-6, 'buffer');
});

test('defaults land near FDM\'s 2026 car budget (300,000 kr, 20,000 km a year, 5 years)', () => {
  const car = { ...base, kmPerYear: 20000, kmPerUnit: 16, pricePerUnit: 13.7, insuranceMo: 700, greenTaxMo: 200, method: 'cash', price: 300000 };
  const fdm = { ...DEFAULT_SETTINGS, years: 5 };
  const petrol = calculate(car, fdm);
  near(petrol.perKm, 4.32, 0.35, 'petrol kr per km (FDM 4.32)');
  const ev = calculate({ ...car, fuel: 'electric', kmPerUnit: 6.5, pricePerUnit: 1.4 }, fdm);
  near(ev.perKm, 3.86, 0.35, 'electric kr per km (FDM 3.86)');
});

test('km per year falls back to the shared setting', () => {
  const car = { ...base, kmPerYear: undefined, method: 'cash', price: 0 };
  const out = calculate(car, { ...bare, kmPerYear: 12000 });
  near(out.kmMo, 1000, 1e-9, 'km per month');
});
