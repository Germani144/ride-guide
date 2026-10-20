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

## Shared origin (all of Pedro's apps live on germani144.github.io)

Every app is served from the same origin, so they share one CacheStorage, one localStorage and one IndexedDB namespace. Keep these rules. Changes that apply to every app at once (caching and the like) are made from Pedro's orchestration chat; they never touch UI or calculations.

- **Service worker:** Cache names start with `rideguide-` (`CACHE` in `sw.js`; bump it when shipping changes). On activate, delete only caches with that prefix (never "every cache but the current one"). Read from this app's own cache (`caches.open(C).then(c => c.match(...))`), never the global `caches.match()`. Only handle requests whose URL starts with `self.registration.scope`; leave other apps, the GitHub API and other origins alone.
- **Updates:** fetch network-first with `{cache: 'no-cache'}`, store only `r.ok` responses, fall back to this app's own cache when offline. Register the worker with `{scope: './', updateViaCache: 'none'}`.
- **Storage:** all storage goes through the adapter in `src/storage.js`, whose key is `rideguide.v1` (always `rideguide.`-prefixed).
- **Manifest:** `scope` and `start_url` are `./`. `id` is unique to this app and stays stable: changing it makes phones treat the app as a new install, so only do it deliberately.
- The manifest `id` is `/ride-guide/app`.
