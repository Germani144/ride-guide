// Car data model. Pure functions: no DOM, no storage, no network.
// A saved car keeps every number it has ever been given, so switching payment method and back
// loses nothing. toEngineInput() decides which numbers count for the chosen method.

export const STATE_VERSION = 2;
export const METHODS = ['cash', 'finance', 'lease'];
export const FUELS = ['petrol', 'diesel', 'electric'];

// Energy prices from the spreadsheet, used as starting values for a new car.
export const ENERGY_DEFAULTS = { petrol: 13.69, diesel: 13.29, electric: 2.5 };

export const NUMBER_FIELDS = [
  'year', 'yearsOfUse', 'price', 'downPayment', 'apr', 'financeMonths', 'depreciationFactor',
  'leaseMo', 'oneTimePayment', 'returnFee', 'kmPerYear', 'kmPerUnit', 'pricePerUnit',
  'insuranceMo', 'greenTaxMo', 'maintenanceMo', 'parkingMo',
];

// Fields asked for on the payment step, per method.
export const COST_FIELDS = {
  cash: ['price', 'yearsOfUse', 'depreciationFactor'],
  finance: ['price', 'downPayment', 'apr', 'financeMonths', 'yearsOfUse', 'depreciationFactor'],
  lease: ['leaseMo', 'oneTimePayment', 'returnFee', 'yearsOfUse'],
};
export const DRIVING_FIELDS = ['kmPerYear', 'kmPerUnit', 'pricePerUnit'];
export const RUNNING_FIELDS = ['insuranceMo', 'greenTaxMo', 'maintenanceMo', 'parkingMo'];

// Stored as fractions, shown and typed as percentages.
export const PERCENT_FIELDS = new Set(['downPayment', 'apr', 'depreciationFactor']);

export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function newCar(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: makeId(), plate: '', name: '', fuel: 'petrol', method: 'cash', mine: false,
    createdAt: now, updatedAt: now,
    year: 0, yearsOfUse: 3, price: 0, downPayment: 1, apr: 0,
    financeMonths: 0, depreciationFactor: 0, leaseMo: 0, oneTimePayment: 0, returnFee: 0,
    kmPerYear: 0, kmPerUnit: 0, pricePerUnit: ENERGY_DEFAULTS.petrol,
    insuranceMo: 0, greenTaxMo: 0, maintenanceMo: 0, parkingMo: 0,
    ...overrides,
  };
}

export function inferMethod(c) {
  if (Number(c.leaseMo) > 0) return 'lease';
  if (Number(c.financeMonths) > 0 && Number(c.downPayment) < 1) return 'finance';
  return 'cash';
}

export function inferFuel(c) {
  const p = Number(c.pricePerUnit);
  return p > 0 && p < 6 ? 'electric' : 'petrol'; // kr per kWh is far below kr per litre
}

export function sanitizeCar(raw) {
  const base = newCar();
  const car = { ...base };
  car.id = typeof raw?.id === 'string' && raw.id ? raw.id.slice(0, 64) : base.id;
  car.name = String(raw?.name ?? '').trim().slice(0, 60);
  car.plate = formatPlate(String(raw?.plate ?? ''));
  car.fuel = FUELS.includes(raw?.fuel) ? raw.fuel : inferFuel(raw ?? {});
  car.method = METHODS.includes(raw?.method) ? raw.method : inferMethod(raw ?? {});
  car.mine = raw?.mine === true;
  car.createdAt = typeof raw?.createdAt === 'string' ? raw.createdAt : base.createdAt;
  car.updatedAt = typeof raw?.updatedAt === 'string' ? raw.updatedAt : car.createdAt;
  for (const f of NUMBER_FIELDS) {
    const v = Number(raw?.[f]);
    car[f] = Number.isFinite(v) ? v : base[f];
  }
  return car;
}

// The numbers the engine sees. Fields that do not belong to the chosen method count as zero,
// with the same conventions as the spreadsheet (leases have no price; cash is 100% down).
export function toEngineInput(car) {
  const input = {
    name: car.name, year: car.year, yearsOfUse: car.yearsOfUse,
    kmPerYear: car.kmPerYear, kmPerUnit: car.kmPerUnit, pricePerUnit: car.pricePerUnit,
    insuranceMo: car.insuranceMo, greenTaxMo: car.greenTaxMo,
    maintenanceMo: car.maintenanceMo, parkingMo: car.parkingMo,
    price: 0, downPayment: 1, apr: 0, financeMonths: 0, depreciationFactor: 0,
    leaseMo: 0, oneTimePayment: 0, returnFee: 0,
  };
  if (car.method === 'cash') {
    Object.assign(input, { price: car.price, depreciationFactor: car.depreciationFactor });
  } else if (car.method === 'finance') {
    Object.assign(input, {
      price: car.price, depreciationFactor: car.depreciationFactor,
      downPayment: car.downPayment, apr: car.apr, financeMonths: car.financeMonths,
    });
  } else if (car.method === 'lease') {
    Object.assign(input, {
      leaseMo: car.leaseMo, oneTimePayment: car.oneTimePayment, returnFee: car.returnFee,
    });
  }
  return input;
}

export function emptyState(lang = 'en') {
  return { version: STATE_VERSION, lang, settings: { buffer: 0.15 }, cars: [], draft: null };
}

// Accepts the current state, the v0.1 grid state, or an export of either.
export function migrate(raw, fallbackLang = 'en') {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.cars)) return null;
  const lang = raw.lang === 'da' || raw.lang === 'en' ? raw.lang : fallbackLang;
  const buffer = Number(raw.settings?.buffer);
  const state = emptyState(lang);
  state.settings.buffer = Number.isFinite(buffer) && buffer >= 0 ? buffer : 0.15;
  state.cars = raw.cars.slice(0, 500).map(sanitizeCar);
  if (raw.version === STATE_VERSION && raw.draft && typeof raw.draft === 'object' && raw.draft.car) {
    state.draft = { ...raw.draft, car: sanitizeCar(raw.draft.car) };
  }
  return state;
}

// Danish plates are two letters and five digits, written "AB 12 345".
// Anything else (personal plates, foreign plates) is kept as typed, uppercased.
export function formatPlate(input) {
  const raw = String(input).toUpperCase().replace(/[^A-ZÆØÅ0-9]/g, '').slice(0, 7);
  const m = raw.match(/^([A-ZÆØÅ]{2})(\d{0,2})(\d{0,3})$/);
  if (!m) return raw;
  return [m[1], m[2], m[3]].filter(Boolean).join(' ');
}

// Parses numbers typed the Danish or English way: "13,69", "13.69", "13.000", "250 000".
export function parseNumber(text) {
  let s = String(text ?? '').trim().replace(/\s/g, '').replace(/kr\.?/gi, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

// Returns { field: errorKey } for the fields a step asks for.
export function validate(car, fields) {
  const errors = {};
  const positive = (f) => { if (!(car[f] > 0)) errors[f] = 'required'; };
  for (const f of fields) {
    if (f === 'name' && !car.name.trim()) errors.name = 'required';
    if (f === 'plate' && !car.plate.trim()) errors.plate = 'required';
    if (['price', 'leaseMo', 'yearsOfUse', 'kmPerYear', 'kmPerUnit', 'pricePerUnit'].includes(f)) positive(f);
    if (f === 'apr' && car.method === 'finance') positive(f);
    if (f === 'financeMonths' && car.method === 'finance') positive(f);
    if (f === 'downPayment' && car.method === 'finance' && !(car.downPayment >= 0 && car.downPayment < 1)) {
      errors.downPayment = 'downPaymentRange';
    }
    if (car[f] < 0) errors[f] = 'negative';
  }
  return errors;
}

// Monthly amounts behind the cash paid out (fixed + variable costs), for the breakdown bar.
// Display only: each part comes straight from the engine output or the car's own inputs.
export const PART_KEYS = ['lease', 'finance', 'depreciation', 'energy', 'insurance', 'greenTax', 'maintenance', 'parking'];

export function costParts(engineInput, out) {
  const months = out.months || 1;
  return {
    lease: engineInput.leaseMo + (engineInput.oneTimePayment + engineInput.returnFee) / months,
    finance: out.financeMo,
    depreciation: out.deprMo,
    energy: out.fuelMo,
    insurance: engineInput.insuranceMo,
    greenTax: engineInput.greenTaxMo,
    maintenance: engineInput.maintenanceMo,
    parking: engineInput.parkingMo,
  };
}
