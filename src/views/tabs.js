// The bottom tab bar (New car, Garage, History) and the settings link in the top bar.
import { el, svg, ICONS } from '../ui.js';
import { activeTab } from '../routes.js';

const TABS = [
  ['#/new', 'new', ICONS.plus],
  ['#/garage', 'garage', ICONS.garage],
  ['#/history', 'history', ICONS.history],
];

// `carIsMine`: whether the car on a #/car/ page is in the garage (its page then belongs to Garage).
export function renderTabs(route, t, carIsMine) {
  const tabs = document.getElementById('tabs');
  const settingsLink = document.getElementById('settings-link');
  const active = activeTab(route, carIsMine);
  tabs.replaceChildren(
    ...TABS.map(([href, key, icon]) =>
      el(
        'a',
        { href, class: 'tab', 'aria-current': key === active ? 'page' : null },
        svg(icon),
        el('span', {}, t.nav[key]),
      ),
    ),
  );
  settingsLink.setAttribute('aria-label', t.nav.settings);
  settingsLink.setAttribute('aria-current', route.startsWith('#/settings') ? 'page' : 'false');
}
