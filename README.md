# RideGuide

Compare what cars really cost you, per month and per km: lease, buy cash, or finance.
A port of the `car_comparison` tab in my `life_sheet.xlsx`, as an installable offline web app.

## Use it

- Each column is one car or offer. Fill in only what applies: lease fields for a lease,
  price, down payment, ÅOP and finance period for a purchase.
- Results update as you type. The cheapest car per km is highlighted.
- **Down payment** below 100% means the rest is financed with the given ÅOP and period.
- **Buffer on owned cars** adds a margin for surprises to owned cars (the sheet's +15%).
- **Export / Import** saves or restores everything as a JSON file.
  **Reset to sheet** restores the cars from the spreadsheet.
- English and Danish, switched in the top right corner.
- Data is stored in the browser on your device only.

## Run locally

No build step and no dependencies.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # engine tests (Node 18+)
```

Opening `index.html` straight from disk does not work, because ES modules need a server.

## How the numbers are calculated

`src/engine.js` is a direct port of the sheet's current formulas (the Fiesta GM column onward):

| Result | Formula |
|---|---|
| Fuel / power per mo. | km per month × kr per litre (kWh) ÷ km per litre (kWh) |
| Depreciation / mo. | (price − price ÷ (1 + yearly factor)^years) ÷ months |
| Finance / mo. | PMT(ÅOP ÷ 12, period, price − down payment × price) |
| Fixed costs | insurance + green tax + finance + depreciation + lease + parking + (one-time payment + return fee) ÷ months |
| Variable costs | fuel / power + maintenance |
| TOTAL / mo. | fixed + variable − equity credit (financed cars: instalments × residual ÷ price, plus interest paid in the period, spread per month) |
| Cash out / mo. | fixed + variable for owned cars, TOTAL for leases |
| Projection / mo. | TOTAL × (1 + buffer) for owned cars, TOTAL for leases |
| Final kr / km | projection ÷ km per month |
| Residual value | price − depreciation over the period |
| Money spent in period | TOTAL × months |

The sheet only sums interest over 96 months. The app has no such limit.

The first three sheet columns (Avensis, Aygo, A4) use an older formula generation and are
not part of the seed data. Their values are kept in `data/sheet_fixtures.json`.

## Tests

`test/engine.test.mjs` checks the engine against the spreadsheet:

- `data/sheet_fixtures.json`: inputs and cached results of all car columns. The seven current
  columns must match to within 0.01 kr.
- `data/sheet_fixtures_financed.json`: three financed scenarios (ÅOP and loan period set on a
  copy of the workbook and recalculated in LibreOffice), so the finance logic is checked too.

## Structure

```
index.html, styles.css      page and styling (light and dark)
src/engine.js               cost engine: pure functions, no DOM or storage
src/storage.js              storage adapter (localStorage today)
src/i18n.js                 English and Danish strings
src/seed.js                 cars from the spreadsheet
src/app.js                  UI
sw.js, manifest.webmanifest offline support and install
data/, test/                spreadsheet fixtures and engine tests
```

## Built to grow

The pieces that would change for a commercial version are kept separate:

- **Engine** has no browser dependencies, so it can run unchanged on a server (Node) or be
  ported to another backend language with the fixtures as the acceptance test.
- **Storage** sits behind `load()` and `save()`. Swapping localStorage for an API with
  accounts means adding one adapter, not touching the UI.
- **Exports** carry a `version` field so stored data can be migrated later.
- **Strings** are all in `src/i18n.js`, so more languages are one block each.

## Deploy

GitHub Pages works as is: serve the repository root. Bump `CACHE` in `sw.js` when shipping
changes, so installed copies update.
