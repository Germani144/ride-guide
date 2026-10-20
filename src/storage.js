// Storage adapter. The app only talks to this interface:
//   load(): Promise<State|null>      save(state): Promise<void>
// Today it is localStorage. To move to a backend later, add another adapter with the same
// two methods (e.g. fetch('/api/state')) and pick it in app.js. Nothing else changes.

export const STATE_VERSION = 1;

export function createLocalStorageAdapter(key = 'rideguide.v1') {
  return {
    async load() {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null; // storage blocked or corrupt: start from seed
      }
    },
    async save(state) {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage full or blocked: the app keeps working in memory */
      }
    },
  };
}
