// RideGuide spreadsheet engine ("sheet mode").
// Faithful port of the "car_comparison" tab (newer column formulas, Fiesta onward).
// Kept only as the reference the tests check against the spreadsheet; the app uses engine.js.
// Pure functions only: no DOM, no storage, no network.

export const DEFAULT_BUFFER = 0.15; // sheet row "Projection per month": owned cars get +15%

/**
 * @typedef {Object} CarInput
 * @property {string} name
 * @property {number} year
 * @property {number} yearsOfUse        years you keep the car (fractions allowed, e.g. 9/12)
 * @property {number} downPayment       fraction of price paid up front (0..1); the rest is financed
 * @property {number} oneTimePayment    lease up-front payment, spread over the period
 * @property {number} returnFee         lease return fee ("Tilbageleveringsgebyr"), spread over the period
 * @property {number} depreciationFactor yearly value loss as a fraction, e.g. 0.03
 * @property {number} kmPerUnit         km per litre (or km per kWh)
 * @property {number} pricePerUnit      kr per litre (or per kWh)
 * @property {number} kmPerYear
 * @property {number} insuranceMo
 * @property {number} greenTaxMo
 * @property {number} maintenanceMo
 * @property {number} parkingMo
 * @property {number} leaseMo
 * @property {number} apr               ÅOP as a fraction, e.g. 0.05
 * @property {number} financeMonths
 * @property {number} price
 */

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// Excel PMT with fv = 0, returned as a positive payment for a positive loan.
export function pmt(ratePerPeriod, nper, pv) {
  if (!nper || !pv) return 0;
  if (ratePerPeriod === 0) return pv / nper;
  return (pv * ratePerPeriod) / (1 - Math.pow(1 + ratePerPeriod, -nper));
}

// Excel IPMT, returned as a negative number like Excel does for a positive loan.
// Periods outside 1..nper give 0 (the sheet wraps IPMT in IFERROR(..., 0)).
export function ipmt(ratePerPeriod, period, nper, pv) {
  if (!nper || !pv || period < 1 || period > nper) return 0;
  if (ratePerPeriod === 0) return 0;
  const payment = pmt(ratePerPeriod, nper, pv);
  const growth = Math.pow(1 + ratePerPeriod, period - 1);
  const balanceBefore = pv * growth - (payment * (growth - 1)) / ratePerPeriod;
  return -(balanceBefore * ratePerPeriod);
}

/**
 * @param {CarInput} input
 * @param {{buffer?: number}} [opts]
 */
export function calculate(input, opts = {}) {
  const buffer = opts.buffer ?? DEFAULT_BUFFER;
  const years = num(input.yearsOfUse);
  const months = 12 * years;
  const price = num(input.price);
  const apr = num(input.apr);
  const financeMonths = num(input.financeMonths);
  const kmPerYear = num(input.kmPerYear);
  const kmMo = kmPerYear / 12;

  const fuelPerKm = num(input.kmPerUnit) ? num(input.pricePerUnit) / num(input.kmPerUnit) : 0;
  const fuelMo = kmMo * fuelPerKm;

  // Depreciation: (price - price / (1 + f)^years) / months
  const deprMo = months ? (price - price / Math.pow(1 + num(input.depreciationFactor), years)) / months : 0;
  const residual = price - deprMo * months;

  // Finance: -PMT(apr/12, period, price - downPayment * price)
  const loan = price - num(input.downPayment) * price;
  const financeMo = financeMonths ? pmt(apr / 12, financeMonths, loan) : 0;

  const oneTimeMo = months ? num(input.oneTimePayment) / months : 0;
  const returnFeeMo = months ? num(input.returnFee) / months : 0;

  const fixed =
    num(input.insuranceMo) +
    num(input.greenTaxMo) +
    financeMo +
    deprMo +
    num(input.leaseMo) +
    returnFeeMo +
    num(input.parkingMo) +
    oneTimeMo;
  const variable = fuelMo + num(input.maintenanceMo);

  // Equity credit for financed cars: part of what you pay in instalments is not a cost
  // because you own the car's residual value. Interest paid in the period is added back.
  let credit = 0;
  if (apr !== 0 && months) {
    let interestSum = 0; // negative, like Excel IPMT
    const last = Math.floor(months);
    for (let k = 1; k <= last; k++) interestSum += ipmt(apr / 12, k, financeMonths, loan);
    const residualShare = price ? residual / price : 0;
    credit = (financeMo * months * residualShare + interestSum) / months;
  }
  const total = fixed + variable - credit;

  const isLease = num(input.leaseMo) !== 0;
  const cashflow = -(isLease ? total : fixed + variable);
  const projection = isLease ? total : total * (1 + buffer);
  const kmCost = kmMo ? projection / kmMo : 0;
  const spent = total * months;

  const base = -cashflow || 1;
  const shares = {
    finance: financeMo / base,
    energy: fuelMo / base,
    greenTax: num(input.greenTaxMo) / base,
    depreciation: deprMo / base,
    parking: num(input.parkingMo) / base,
    maintenance: num(input.maintenanceMo) / base,
    insurance: num(input.insuranceMo) / base,
  };

  return {
    months,
    kmMo,
    fuelPerKm,
    fuelMo,
    deprMo,
    residual,
    financeMo,
    fixed,
    variable,
    total,
    cashflow,
    projection,
    kmCost,
    spent,
    shares,
  };
}

export function emptyCar(name = 'New car') {
  return {
    name,
    year: new Date().getFullYear(),
    yearsOfUse: 3,
    downPayment: 1,
    oneTimePayment: 0,
    returnFee: 0,
    depreciationFactor: 0,
    kmPerUnit: 15,
    pricePerUnit: 13,
    kmPerYear: 12000,
    insuranceMo: 0,
    greenTaxMo: 0,
    maintenanceMo: 0,
    parkingMo: 0,
    leaseMo: 0,
    apr: 0,
    financeMonths: 0,
    price: 0,
  };
}
