// Plain helpers behind the screens: number formatting, the comparison, routes and switches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { money, plain, inputNumberText, toInputText } from '../src/format.js';
import { compareResults } from '../src/compare.js';
import { parseRoute, activeTab, keepsCompareSelection } from '../src/routes.js';
import { switchOn } from '../src/model.js';

test('numbers are formatted the English or Danish way', () => {
  assert.equal(money(12345.6, 'en'), '12,346');
  assert.equal(money(12345.6, 'da'), '12.346');
  assert.equal(money(4.151, 'en', 2), '4.15');
  assert.equal(money(4.151, 'da', 2), '4,15');
  assert.equal(plain(2.5, 'da'), '2,5');
  assert.equal(plain(3, 'en'), '3');
  assert.equal(inputNumberText(3500, 'en'), '3500', 'no thousands separator in inputs');
  assert.equal(inputNumberText(17.5, 'da'), '17,5');
  assert.equal(toInputText('apr', 0.069, 'en'), '6.9', 'percentages are shown as %');
  assert.equal(toInputText('greenTaxMo', 200, 'en'), '1200', 'green tax is shown per half year');
  assert.equal(toInputText('price', 0, 'en'), '', 'zero shows the placeholder');
});

test('the comparison marks the cheapest per km and the extra per month', () => {
  const results = [
    { perKm: 4.5, perMonth: 3700, parts: { energy: 100, insurance: 50 } },
    { perKm: 4.2, perMonth: 3500, parts: { energy: 80 } },
    { perKm: 0, perMonth: 3600, parts: {} },
  ];
  const c = compareResults(results);
  assert.deepEqual(c.cheapest, [false, true, false]);
  assert.deepEqual(c.extraPerMonth, [200, 0, 100]);
  assert.deepEqual(c.mergedParts, { energy: 180, insurance: 50 });
  assert.deepEqual(compareResults([]).cheapest, []);
});

test('routes: what each address shows and which tab lights up', () => {
  assert.deepEqual(parseRoute(''), { route: '#/new', name: 'new', id: '', ids: [] });
  assert.equal(parseRoute('#/nonsense').name, 'new');
  assert.deepEqual(parseRoute('#/car/a%20b'), { route: '#/car/a%20b', name: 'car', id: 'a b', ids: [] });
  assert.deepEqual(parseRoute('#/compare/a,b').ids, ['a', 'b']);
  assert.equal(activeTab('#/new', false), 'new');
  assert.equal(activeTab('#/car/x', true), 'garage');
  assert.equal(activeTab('#/car/x', false), 'history');
  assert.equal(activeTab('#/compare/a,b', false), 'history');
  assert.equal(activeTab('#/settings', false), null);
  assert.equal(keepsCompareSelection('#/car/x'), true);
  assert.equal(keepsCompareSelection('#/settings'), false);
});

test('switches fall back to their defaults', () => {
  assert.equal(switchOn({}, 'depreciationAuto'), true);
  assert.equal(switchOn({}, 'tyresIncluded'), false);
  assert.equal(switchOn({ tyresIncluded: true }, 'tyresIncluded'), true);
  assert.equal(switchOn({ serviceIncluded: false }, 'serviceIncluded'), false);
});
