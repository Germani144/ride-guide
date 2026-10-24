// The app's addresses (hash routes) and what they mean. Plain functions, no DOM.
//   #/new  #/garage  #/history  #/car/:id  #/compare/:id,:id  #/settings

export function parseRoute(hash) {
  const route = hash || '#/new';
  const [, name = 'new', arg = ''] = route.split('/');
  return {
    route,
    name: ['garage', 'history', 'car', 'compare', 'settings'].includes(name) ? name : 'new',
    id: name === 'car' ? decodeURIComponent(arg) : '',
    ids: name === 'compare' ? arg.split(',').map(decodeURIComponent) : [],
  };
}

// Which bottom tab lights up. A car's page belongs to Garage if the car is yours, else History.
export function activeTab(route, carIsMine) {
  if (route.startsWith('#/new')) return 'new';
  if (route.startsWith('#/garage') || (route.startsWith('#/car/') && carIsMine)) return 'garage';
  if (route.startsWith('#/history') || route.startsWith('#/compare') || route.startsWith('#/car/'))
    return 'history';
  return null;
}

// Picking cars to compare survives moving between History, a car's page and the comparison.
export function keepsCompareSelection(route) {
  return route.startsWith('#/history') || route.startsWith('#/car/') || route.startsWith('#/compare');
}
