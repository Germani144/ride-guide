# RideGuide

What will this car really cost you? Lease, buy cash, or finance, per month and per km.
Built from the `car_comparison` tab in my `life_sheet.xlsx`, as an installable offline web app.

Live: https://germani144-ride.github.io/ride-guide/ (open on the phone and choose **Install**). It has its
own address because Chrome on Android installs only one app per address; it moved from
`germani144.github.io` on 2026-10-20.

## Use it

The app has three tabs:

- **New car** (the landing page) asks one question per screen, from the most general to the
  most specific:
  1. Do you have the license plate? If yes, type it in (Danish format `AB 12 345`).
  2. Which car is it: make and model, model year, fuel (petrol, diesel or electric).
  3. How will you pay: pay upfront, finance or lease.
  4. The terms for that choice:
     - pay upfront: price; loss in value is estimated (switch it off to type your own yearly rate)
     - finance: price, down payment (below 100%), ÅOP, loan period; loss in value as above
     - lease: monthly lease, one-time payment, return fee, lease period, and switches for
       "service included" (default on) and "tyres included" (default off)
  5. Fuel: fuel or energy use. Prices are shared by every car (Settings).
  6. Running costs: insurance and parking per month, green tax per half year (as on the bill;
     the app divides it by 6); maintenance is estimated
     (switch it off to type your own; not asked when the lease includes service).
  7. The result: kr per km, cost per month, where the money goes, for the shared years of
     ownership and km per year (two bars right there). Save it as **my car** or just to **history**. Any answer
     can be changed from the result screen.
- **Garage** shows the cars you marked as yours.
- **History** shows every car you have added. Tap **Compare** to put 2 or 3 side by side.

Years of ownership (default 3) and km per year (default 10,000) are the same for every car, so
cars are always compared on equal terms. Two bars at the top of Garage, History, the comparison,
a car's page and the result change them for all cars at once (also in Settings). A car only stores
its own fuel use; a lease keeps its own lease period.

On a car's page you can mark it as yours, edit it, **try another way to pay** (same car,
new payment method, so lease vs. finance is two taps away), compare it, or delete it.

Settings (top right) holds the language (English or Danish), the years of ownership and km per
year, the return on your money (4% a year), the safety margin on owned cars (5%), the running-cost
prices (tyres, winter tyres, inspection, washing), fuel and electricity
(petrol, diesel, electricity at home and at public chargers, public charging share, extra winter
use for electric cars, yearly price change),
and backup export and import. Settings save automatically as you
change them; a "Saved" message confirms it. The app version is next to the name in the header, at the
bottom of Settings and on the loading screen. **Check for updates** (bottom of Settings) asks the
server which version it serves right now: if it is newer, the app updates on the spot (it refreshes
the service worker, deletes only its own `rideguide-` caches and reloads), so there is no need to
close the app or reinstall. It also shows whether a push actually went live.

Numbers can be typed the Danish or English way: `13,69`, `13.69`, `250.000` and `250 000`
all work. The license plate is stored with the car; automatic lookup of green tax and fuel use
from the plate is not connected yet.

Data is stored in the browser on the device only. Older data (v0.1 and v2) is upgraded
automatically: cars switch to the estimated loss in value and maintenance (their typed values are
kept for the manual mode), the old 15% buffer becomes the new 5% default, and the old 5-year
default span becomes 3 years. Km per year saved on each car is kept but no longer used.

## Run locally

No build step and no dependencies.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # engine and model tests (Node 18+)
```

Opening `index.html` straight from disk does not work, because ES modules need a server.

## How the numbers are calculated

`src/engine.js` simulates each car month by month over one **shared time span** (years of
ownership, default 3) at one **shared km per year** (default 10,000), so every car is compared
on the same terms. Owned cars are sold at the end
at their estimated value (any loan left is paid off from the sale). Leases renew on the same terms
until the span is filled; a partial last lease counts pro rata.

Every payment is **discounted** at the return your money could earn (default 4% a year,
compounding monthly). That counts the money tied up in a car and makes a big payment now
comparable with small payments later. The result is the **equivalent fixed monthly cost**:
the steady monthly amount with the same value today as all the car's payments.
All prices are in today's money.

| Part | How it is calculated |
|---|---|
| Loss in value | price − value at the end, spread evenly per month. Value curve: −20% in the first year, then a yearly loss that shrinks with age: 6% + 9% × e^(−(age − 1) ÷ 4), so 15% in the second year, about 9% at 5 years and about 6–7% for cars over 10 (electric: −22%, then 7% + 10% × the same). The yearly rate goes up 1 point per 5,000 km above 15,000 km a year, and down when you drive less (limits 3–30%). Checked against TjekBil's market values for a 2016 car. A used car continues from its age (model year). Manual mode: value = price ÷ (1 + yearly rate)^years. |
| Money tied up in the car | equivalent monthly cost of (down payment + instalments + loan left at the end − sale value) at the return rate, minus loss in value and interest. Negative ("saved by paying later") when a cheap loan beats paying cash. |
| Loan interest | interest paid within the span, spread per month. Instalments follow PMT(ÅOP ÷ 12, loan period, loan). |
| Lease | monthly lease + one-time payment at each start + return fee at each end, discounted. |
| Fuel / power | km per month ÷ km per unit × price, growing by the yearly price change. Prices are settings shared by every car: petrol 17.50 and diesel 19.50 kr per litre (October 2026), electricity 1.40 kr per kWh at home and 3.50 at public chargers (FDM 2026). Electric: 80% home + 20% public, and 10% extra use in the cold. |
| Insurance | today's premium; on owned cars half of it follows the car's value down. |
| Maintenance and repairs | (yearly base + per km × km a year) ÷ 12 × (1 + 8% × age), age up to 15. Petrol 3,000 kr + 0.25 kr/km, diesel 3,500 kr + 0.25 kr/km, electric 2,000 kr + 0.15 kr/km. Skipped when the lease includes service. |
| Tyres | km × (four tyres 3,500 kr ÷ tyre life 30,000 km; electric 25,000 km), plus two swaps a year (400 kr each) with winter tyres. Skipped when the lease includes tyres. |
| Inspection and washing | inspection (500 kr) at age 4 and then every 2 years, unless the lease includes service; washing 100 kr a month. Roadside assistance is not counted: it comes with the car insurance. |
| Green tax | typed per half year, as on the bill, stored and counted per month (÷ 6). |
| Parking | as typed, per month. |
| Safety margin | owned cars only: 5% on top of everything else. |

Results: **kr per km** = cost per month ÷ km per month. **Total** = cost per month × months.
**Paid up front** = down payment (cash: the price) or the first one-time lease payment.
**Paid out per month** = plain average of everything paid after the start (instalments, lease,
running costs), without discounting or the sale.

With the defaults, a new 300,000 kr car driven 20,000 km a year for 5 years comes out close to
FDM's 2026 car budget (petrol about 4.3 kr/km, electric about 3.6 kr/km; FDM: 4.32 and 3.86);
`test/cost.test.mjs` keeps it within 0.35 kr/km.

Defaults come from: [FDM, cost of a car in 2026](https://fdm.dk/nyheder/nyt-om-trafik-og-biler/hvad-koster-det-at-holde-bil-i-2026-faa-svaret-her)
(home/public charging split, totals), [FDM, inspection rules](https://fdm.dk/vaerd-at-vide/biltest-bilsyn/hvornaar-skal-min-bil-synes),
and Danish price surveys for [tyres](https://www.skagenonline.dk/faq/hvad-koster-nye-daek-inkl-montering) and
[inspection](https://www.skagenonline.dk/faq/hvad-koster-et-bilsyn-hos-dekra).
The value and maintenance curves are first estimates, to be replaced by data (the survival model
for maintenance is planned).

**Sheet mode.** `src/engine-sheet.js` is the original port of the spreadsheet's formulas
(the Fiesta GM column onward). The app no longer uses it; it stays as the reference the tests
check against `life_sheet.xlsx`. The first three sheet columns (Avensis, Aygo, A4) use an older
formula generation; their values are kept in `data/sheet_fixtures.json`.

`src/model.js` maps each car to the engine's inputs by payment method: a lease has no price,
paying upfront is 100% down, and numbers that belong to another method count as zero (they stay
saved, so switching back loses nothing).

## Planned

- **Look up a car by its plate**: green tax, fuel use, and ideally market value.
- **Today's Danish fuel and electricity prices**, fetched automatically instead of typed in
  Settings (they vary a lot). Needs a price source the app may call from the browser.
- **Survival model for maintenance**, from Pedro's own algorithms, replacing the maintenance curve.

## Tests

- `test/cost.test.mjs` checks the cost engine: value curve, money tied up, finance, lease
  renewal, maintenance, tyres, inspection, electricity, insurance, safety margin,
  and that the defaults stay near FDM's 2026 budget.
- `test/engine.test.mjs` checks sheet mode (`src/engine-sheet.js`) against the spreadsheet: the seven current columns
  in `data/sheet_fixtures.json` must match to within 0.01 kr, and three financed scenarios in
  `data/sheet_fixtures_financed.json` (set on a copy of the workbook and recalculated in
  LibreOffice) check the finance logic.
- `test/model.test.mjs` checks the payment method mapping, the v0.1 and v2 data upgrades,
  which fields the switches ask for, plate formatting, number parsing, validation, that the
  breakdown adds up to the monthly cost, and that the version matches in `src/version.js` and
  `package.json`.

## Structure

```
index.html, styles.css        page shell and styling (light and dark)
src/version.js                app version (loading screen, Settings, offline cache name)
src/engine.js                 cost engine: pure functions, no DOM or storage
src/engine-sheet.js           sheet mode: the spreadsheet's formulas, used by the tests only
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
  (Node) or be ported to another backend language with the tests as the acceptance test.
- **Storage** sits behind `load()` and `save()`. Swapping localStorage for an API with
  accounts means adding one adapter, not touching the UI.
- **Saved data** carries a `version` field, and `migrate()` upgrades older versions.
- **The decision tree** is a small table of steps in `src/views/wizard.js`, so a plate lookup
  step that prefills the car can slot in after the plate question.
- **Strings** are all in `src/i18n.js`, so more languages are one block each.

## Deploy

GitHub Pages serves the repository root from `main`. Bump the version in `src/version.js`
(and `package.json`) with every change that ships: it shows on the loading screen and in
Settings, and names the offline cache, so phones pick up the new files. After pushing, fetch
`https://germani144-ride.github.io/ride-guide/src/version.js` and check the new version is live;
if GitHub Pages didn't publish it, another push re-triggers the build.

The service worker loads files from the network first (so a change shows up on the next open)
and falls back to its cached copy offline. It still only creates, reads and deletes caches named
`rideguide-*` and only handles requests inside `/ride-guide/`, so it stays clean if it ever shares
an origin with another app again.
The manifest has its own `id` (`/ride-guide/app`) and `scope` (`./`). Never change the `id` of an
installed app: phones treat a new id as a different app.
