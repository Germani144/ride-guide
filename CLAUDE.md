# RideGuide: working rules

- Keep README.md up to date whenever a change affects usage, formulas, structure or deployment.
- The cost engine (`src/engine.js`) must keep matching the spreadsheet: `npm test` must pass.
  Do not change a formula without the owner's approval; if a formula changes on purpose,
  update the fixtures and the formula table in README.md in the same change.
- Keep `src/engine.js` and `src/model.js` free of DOM, storage and network code so they can move
  to a backend. `npm test` covers both.
- All storage goes through the adapter in `src/storage.js`. All UI text goes in `src/i18n.js`,
  in both English and Danish.
- No build step and no runtime dependencies unless the owner agrees to add them.
- Bump `CACHE` in `sw.js` when shipping changes, and add new app files to its `SHELL` list.
- Changes to saved data shape go through `migrate()` in `src/model.js`, with a test.
- Ask before pushing to GitHub.

## Address and shared-origin rules

RideGuide lives at https://germani144-ride.github.io/ride-guide/ (repo `germani144-ride/ride-guide`, moved from `Germani144/ride-guide` on 2026-10-20).

**One installable app per address.** Chrome on Android lets only one app per address (origin) be installed: a second app on the same address shows "This app is already installed" and can't be installed (found 2026-10-20). So every app Pedro installs needs its own address. Nap Log is the installed app on `germani144.github.io`; Lift Log moved to `germani144-lift.github.io`, Home log to `germani144-home.github.io` and RideGuide to `germani144-ride.github.io` (each its own free GitHub organization). Changes that apply to every app at once are made from Pedro's orchestration chat; they never touch UI or calculations. Never move RideGuide back onto an address another installable app uses (`rideguide.dk`'s DNS is on Cloudflare, which Pedro doesn't manage here). The rules below still apply, so RideGuide stays clean if it ever shares an address again.

- **Service worker:** Cache names start with `rideguide-` (`CACHE` in `sw.js`; bump it when shipping changes). On activate, delete only caches with that prefix (never "every cache but the current one"). Read from this app's own cache (`caches.open(C).then(c => c.match(...))`), never the global `caches.match()`. Only handle requests whose URL starts with `self.registration.scope`; leave other apps, the GitHub API and other origins alone.
- **Updates:** fetch network-first with `{cache: 'no-cache'}`, store only `r.ok` responses, fall back to this app's own cache when offline. Register the worker with `{scope: './', updateViaCache: 'none'}`.
- **Storage:** all storage goes through the adapter in `src/storage.js`, whose key is `rideguide.v1` (always `rideguide.`-prefixed).
- **Manifest:** `scope` and `start_url` are `./`. **Never change the manifest `id`**, not even to fix an install problem, unless Pedro explicitly asks for it in that chat. The id is how Android recognises the installed app: changing it orphans the installed copy. If installing fails on the phone, investigate and report; don't change the id.
- The manifest `id` is `/ride-guide/app`.
