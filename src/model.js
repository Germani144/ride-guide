// Car data model. Pure functions: no DOM, no storage, no network.
import { DEFAULT_SETTINGS } from './engine.js';

// A saved car keeps every number it has ever been given, so switching payment method and back
// loses nothing. toEngineInput() decides which numbers count for the chosen method.

export const STATE_VERSION = 6;
export const METHODS = ['cash', 'finance', 'lease'];
export const FUELS = ['petrol', 'diesel', 'electric'];

// Energy prices from the spreadsheet, used as starting values for a new car.
export const ENERGY_DEFAULTS = { petrol: 13.69, diesel: 13.29, electric: 2.5 };

export const NUMBER_FIELDS = [
  'year',
  'yearsOfUse',
  'price',
  'downPayment',
  'apr',
  'financeMonths',
  'depreciationFactor',
  'leaseMo',
  'oneTimePayment',
  'returnFee',
  'kmPerYear',
  'kmPerUnit',
  'pricePerUnit',
  'insuranceMo',
  'greenTaxMo',
  'maintenanceMo',
  'parkingMo',
];

export const BOOL_FIELDS = ['depreciationAuto', 'maintenanceAuto', 'serviceIncluded', 'tyresIncluded'];

// Fields asked for on the payment step, per method. How long you keep an owned car is the
// shared time span in Settings, so it is no longer asked per car; a lease asks its period.
export const COST_FIELDS = {
  cash: ['price'],
  finance: ['price', 'downPayment', 'apr', 'financeMonths'],
  lease: ['leaseMo', 'oneTimePayment', 'returnFee', 'yearsOfUse'],
};
// Km per year is shared by all cars (Settings and the bars on History and Comparison), like the
// years of ownership, so a car only stores how much fuel it uses and what the fuel costs.
// Fuel and electricity prices are shared too (Settings), so a car only stores its consumption.
export const DRIVING_FIELDS = ['kmPerUnit'];
export const RUNNING_FIELDS = ['insuranceMo', 'greenTaxMo', 'maintenanceMo', 'parkingMo'];

// The fields a step really asks for, given the car's switches.
export function costFields(car) {
  const f = [...COST_FIELDS[car.method]];
  if (car.method !== 'lease' && car.depreciationAuto === false) f.push('depreciationFactor');
  return f;
}
export function runningFields(car) {
  return RUNNING_FIELDS.filter(
    f =>
      f !== 'maintenanceMo' ||
      (car.maintenanceAuto === false && !(car.method === 'lease' && car.serviceIncluded !== false)),
  );
}

// Settings the user can change, with their defaults (see engine.js).
export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

// Stored as fractions, shown and typed as percentages.
export const PERCENT_FIELDS = new Set(['downPayment', 'apr', 'depreciationFactor']);

// Shown and typed value = stored value × scale. Percentages, and green tax, which Danish
// owners know per half year (it is charged every 6 months) but is stored per month.
export const SHOWN_SCALE = { downPayment: 100, apr: 100, depreciationFactor: 100, greenTaxMo: 6 };
export const toShown = (field, v) => v * (SHOWN_SCALE[field] ?? 1);
export const fromShown = (field, v) => v / (SHOWN_SCALE[field] ?? 1);

export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function newCar(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    plate: '',
    name: '',
    fuel: 'petrol',
    method: 'cash',
    mine: false,
    createdAt: now,
    updatedAt: now,
    year: 0,
    yearsOfUse: 3,
    price: 0,
    downPayment: 1,
    apr: 0,
    financeMonths: 0,
    depreciationFactor: 0,
    leaseMo: 0,
    oneTimePayment: 0,
    returnFee: 0,
    kmPerYear: 0,
    kmPerUnit: 0,
    pricePerUnit: ENERGY_DEFAULTS.petrol,
    insuranceMo: 0,
    greenTaxMo: 0,
    maintenanceMo: 0,
    parkingMo: 0,
    depreciationAuto: true,
    maintenanceAuto: true,
    serviceIncluded: true,
    tyresIncluded: false,
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
  car.name = String(raw?.name ?? '')
    .trim()
    .slice(0, 60);
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
  for (const f of BOOL_FIELDS) car[f] = typeof raw?.[f] === 'boolean' ? raw[f] : base[f];
  return car;
}

// The numbers the engine sees. Fields that do not belong to the chosen method count as zero
// (they stay saved, so switching back loses nothing). `year` is the current calendar year,
// used for the car's age.
export function toEngineInput(
  car,
  { year = new Date().getFullYear(), kmPerYear = DEFAULT_SETTINGS.kmPerYear } = {},
) {
  const lease = car.method === 'lease';
  return {
    method: car.method,
    fuel: car.fuel,
    age: car.year > 1900 ? Math.max(0, year - car.year) : 0,
    price: lease ? 0 : car.price,
    downPayment: car.method === 'finance' ? car.downPayment : 1,
    apr: car.method === 'finance' ? car.apr : 0,
    financeMonths: car.method === 'finance' ? car.financeMonths : 0,
    depreciationAuto: car.depreciationAuto !== false,
    depreciationFactor: car.depreciationFactor,
    leaseMo: lease ? car.leaseMo : 0,
    oneTimePayment: lease ? car.oneTimePayment : 0,
    returnFee: lease ? car.returnFee : 0,
    leaseYears: lease ? car.yearsOfUse : 0,
    serviceIncluded: car.serviceIncluded !== false,
    tyresIncluded: car.tyresIncluded === true,
    kmPerYear,
    kmPerUnit: car.kmPerUnit, // fuel and electricity prices come from the settings
    insuranceMo: car.insuranceMo,
    greenTaxMo: car.greenTaxMo,
    maintenanceAuto: car.maintenanceAuto !== false,
    maintenanceMo: car.maintenanceMo,
    parkingMo: car.parkingMo,
  };
}

export function emptyState(lang = 'en') {
  return { version: STATE_VERSION, lang, settings: { ...DEFAULT_SETTINGS }, cars: [], draft: null };
}

// Keeps known settings of the right type and fills the rest with defaults.
export function sanitizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS };
  for (const k of SETTING_KEYS) {
    const v = raw?.[k];
    if (typeof DEFAULT_SETTINGS[k] === 'boolean') {
      if (typeof v === 'boolean') out[k] = v;
    } else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  if (!(out.years > 0)) out.years = DEFAULT_SETTINGS.years;
  return out;
}

// Accepts the current state, the v0.1 grid state, or an export of either.
export function migrate(raw, fallbackLang = 'en') {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.cars)) return null;
  const lang = raw.lang === 'da' || raw.lang === 'en' ? raw.lang : fallbackLang;
  const state = emptyState(lang);
  state.settings = sanitizeSettings(raw.settings);
  // Before v3 the buffer covered costs the model did not know about (tyres, rising repairs).
  // Those are modelled now, so the old 15% default becomes the new, smaller default.
  if ((raw.version ?? 1) < 3 && raw.settings?.buffer === 0.15)
    state.settings.buffer = DEFAULT_SETTINGS.buffer;
  // v4: years of ownership default 3 (was 5); km per year moved from each car to the settings.
  if ((raw.version ?? 1) < 4 && (raw.settings?.years == null || raw.settings.years === 5))
    state.settings.years = DEFAULT_SETTINGS.years;
  // v6: fuel prices updated to October 2026; prices still at the old defaults move with them.
  if ((raw.version ?? 1) < 6) {
    if (raw.settings?.petrolPrice === 13.69) state.settings.petrolPrice = DEFAULT_SETTINGS.petrolPrice;
    if (raw.settings?.dieselPrice === 13.29) state.settings.dieselPrice = DEFAULT_SETTINGS.dieselPrice;
  }
  state.cars = raw.cars.slice(0, 500).map(sanitizeCar);
  if (raw.version === STATE_VERSION && raw.draft && typeof raw.draft === 'object' && raw.draft.car) {
    state.draft = { ...raw.draft, car: sanitizeCar(raw.draft.car) };
  }
  return state;
}

// Danish plates are two letters and five digits, written "AB 12 345".
// Anything else (personal plates, foreign plates) is kept as typed, uppercased.
export function formatPlate(input) {
  const raw = String(input)
    .toUpperCase()
    .replace(/[^A-ZÆØÅ0-9]/g, '')
    .slice(0, 7);
  const m = raw.match(/^([A-ZÆØÅ]{2})(\d{0,2})(\d{0,3})$/);
  if (!m) return raw;
  return [m[1], m[2], m[3]].filter(Boolean).join(' ');
}

// Parses numbers typed the Danish or English way: "13,69", "13.69", "13.000", "250 000".
export function parseNumber(text) {
  let s = String(text ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/kr\.?/gi, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

// Returns { field: errorKey } for the fields a step asks for.
export function validate(car, fields) {
  const errors = {};
  const positive = f => {
    if (!(car[f] > 0)) errors[f] = 'required';
  };
  for (const f of fields) {
    if (f === 'name' && !car.name.trim()) errors.name = 'required';
    if (f === 'plate' && !car.plate.trim()) errors.plate = 'required';
    if (['price', 'leaseMo', 'kmPerUnit'].includes(f)) positive(f);
    if (f === 'yearsOfUse' && car.method === 'lease') positive(f);
    if (f === 'apr' && car.method === 'finance') positive(f);
    if (f === 'financeMonths' && car.method === 'finance') positive(f);
    if (f === 'downPayment' && car.method === 'finance' && !(car.downPayment >= 0 && car.downPayment < 1)) {
      errors.downPayment = 'downPaymentRange';
    }
    if (car[f] < 0) errors[f] = 'negative';
  }
  return errors;
}
