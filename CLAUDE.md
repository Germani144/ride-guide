# RideGuide: working rules

- Keep README.md up to date whenever a change affects usage, formulas, structure or deployment.
- The cost engine (`src/engine.js`) must keep matching the spreadsheet: `npm test` must pass.
  Do not change a formula without the owner's approval; if a formula changes on purpose,
  update the fixtures and the formula table in README.md in the same change.
- Keep the engine free of DOM, storage and network code so it can move to a backend.
- All storage goes through the adapter in `src/storage.js`. All UI text goes in `src/i18n.js`,
  in both English and Danish.
- No build step and no runtime dependencies unless the owner agrees to add them.
- Bump `CACHE` in `sw.js` when shipping changes, and add new app files to its `SHELL` list.
- Ask before pushing to GitHub.
