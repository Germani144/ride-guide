# RideGuide

What will this car really cost you? Lease, buy cash, or finance, per month and per km.
Built from the `car_comparison` tab in my `life_sheet.xlsx`, as an installable offline web app.

Live: https://germani144.github.io/ride-guide/ (open on the phone and choose **Install app**
or **Add to Home screen**).

## Use it

The app has three tabs:

- **New car** (the landing page) asks one question per screen, from the most general to the
  most specific:
  1. Do you have the license plate? If yes, type it in (Danish format `AB 12 345`).
  2. Which car is it: make and model, model year, fuel (petrol, diesel or electric).
  3. How will you pay: pay upfront, finance or lease.
  4. The terms for that choice:
     - pay upfront: price, years you keep it, yearly loss in value
     - finance: price, down payment (below 100%), ÅOP, loan period, years you keep it, yearly loss in value
     - lease: monthly lease, one-time payment, return fee, lease period
  5. Driving: km per year, fuel or energy use, fuel or electricity price.
  6. Running costs per month: insurance, green tax, maintenance, parking.
  7. The result: kr per km, cost per month, where the money goes. Save it as **my car**
     or just to **history**. Any answer can be changed from the result screen.
- **Garage** shows the cars you marked as yours.
- **History** shows every car you have added. Tap **Compare** to put 2 or 3 side by side.

On a car's page you can mark it as yours, edit it, **try another way to pay** (same car,
new payment method, so lease vs. finance is two taps away), compare it, or delete it.

Settings (top right) holds the language (English or Danish), the buffer on owned cars
(the sheet's +15%), backup export and import, and a reset to the spreadsheet cars.

Numbers can be typed the Danish or English way: `13,69`, `13.69`, `250.000` and `250 000`
all work. The license plate is stored with the car; automatic lookup of green tax and fuel use
from the plate is not connected yet.

Data is stored in the browser on the device only. Older v0.1 data is upgraded automatically.

## Run locally

No build step and no dependencies.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # engine and model tests (Node 18+)
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

The sheet only sums interest over 96 months. The app has no such limit.

What the app shows, and where it comes from:

- **kr per km** is the sheet's "Final kr/km".
- **Cost per month** is the sheet's "Projection per month" (TOTAL plus the buffer on owned cars),
  so it matches kr per km.
- **Paid out per month** is the sheet's "Cashflow/month".
- **Total for the period** is cost per month × months kept.
- **Value at the end** is the residual value (owned cars only).
- **Where the money goes** splits the cash paid out per month into lease (including one-time
  payment and return fee spread over the period), loan, loss in value, fuel or power,
  insurance, green tax, maintenance and parking.

`src/model.js` maps each car to the engine's inputs by payment method, using the sheet's
conventions: a lease has no price and no loss in value, paying upfront is 100% down,
and numbers that belong to another method count as zero (they stay saved, so switching back
loses nothing).

The first three sheet columns (Avensis, Aygo, A4) use an older formula generation and are
not part of the seed data. Their values are kept in `data/sheet_fixtures.json`.

## Tests

- `test/engine.test.mjs` checks the engine against the spreadsheet: the seven current columns
  in `data/sheet_fixtures.json` must match to within 0.01 kr, and three financed scenarios in
  `data/sheet_fixtures_financed.json` (set on a copy of the workbook and recalculated in
  LibreOffice) check the finance logic.
- `test/model.test.mjs` checks that the seed cars give identical results through the model,
  the payment method mapping, the v0.1 data upgrade, plate formatting, number parsing,
  validation, and that the breakdown adds up to the cash paid out.

## Structure

```
index.html, styles.css        page shell and styling (light and dark)
src/engine.js                 cost engine: pure functions, no DOM or storage
src/model.js                  car data model, payment methods, migration, validation
src/storage.js                storage adapter (localStorage today)
src/i18n.js                   English and Danish strings
src/seed.js                   cars from the spreadsheet
src/ui.js                     shared interface pieces (plate, price, breakdown, formatting)
src/app.js                    state, routing (#/new, #/garage, #/history, #/car/:id,
                              #/compare/:ids, #/settings) and actions
src/views/wizard.js           New car decision tree
src/views/cars.js             Garage, History, car page, comparison
src/views/settings.js         settings
fonts/                        Barlow and Barlow Condensed (SIL Open Font License, OFL.txt)
sw.js, manifest.webmanifest   offline support and install
data/, test/                  spreadsheet fixtures and tests
```

## Built to grow

The pieces that would change for a commercial version are kept separate:

- **Engine and model** have no browser dependencies, so they can run unchanged on a server
  (Node) or be ported to another backend language with the fixtures as the acceptance test.
- **Storage** sits behind `load()` and `save()`. Swapping localStorage for an API with
  accounts means adding one adapter, not touching the UI.
- **Saved data** carries a `version` field, and `migrate()` upgrades older versions.
- **The decision tree** is a small table of steps in `src/views/wizard.js`, so a plate lookup
  step that prefills the car can slot in after the plate question.
- **Strings** are all in `src/i18n.js`, so more languages are one block each.

## Deploy

GitHub Pages serves the repository root from `main`. Bump `CACHE` in `sw.js` when shipping
changes.

The service worker loads files from the network first (so a change shows up on the next open)
and falls back to its cached copy offline. Other apps are served from the same
`germani144.github.io` origin and share its cache storage, so the worker only creates, reads
and deletes caches named `rideguide-*` and only handles requests inside `/ride-guide/`.
The manifest has its own `id` (`/ride-guide/`) and `scope` (`./`), so the browser treats
RideGuide as a separate app from the others on the same site.
