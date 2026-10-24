// The bottom tab bar (New car, Garage, History) and the settings link in the top bar.
import { el, svg, ICONS } from '../ui.js';

const TABS = [
  ['#/new', 'new', ICONS.plus],
  ['#/garage', 'garage', ICONS.garage],
  ['#/history', 'history', ICONS.history],
];

// `carIsMine` says whether the car on a #/car/ route is in the garage (it decides which tab lights up).
export function renderTabs(route, t, carIsMine) {
  const tabs = document.getElementById('tabs');
  const settingsLink = document.getElementById('settings-link');
  tabs.replaceChildren(
    ...TABS.map(([href, key, icon]) => {
      const active =
        route.startsWith(href) ||
        (key === 'history' &&
          (route.startsWith('#/compare') || (route.startsWith('#/car/') && !carIsMine))) ||
        (key === 'garage' && route.startsWith('#/car/') && carIsMine);
      return el(
        'a',
        { href, class: 'tab', 'aria-current': active ? 'page' : null },
        svg(icon),
        el('span', {}, t.nav[key]),
      );
    }),
  );
  settingsLink.setAttribute('aria-label', t.nav.settings);
  settingsLink.setAttribute('aria-current', route.startsWith('#/settings') ? 'page' : 'false');
}
