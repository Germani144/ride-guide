// What the comparison screen highlights, from the cars' results. Plain functions, no DOM.

// For each result: whether it is the cheapest per km, and how much more per month it costs than
// the cheapest per month. Also the parts of all cars added up, for one shared legend.
export function compareResults(results) {
  const priced = results.filter(r => r.perKm > 0);
  const bestKm = priced.length ? Math.min(...priced.map(r => r.perKm)) : null;
  const bestMonth = results.length ? Math.min(...results.map(r => r.perMonth)) : 0;
  const mergedParts = {};
  for (const r of results)
    for (const [k, v] of Object.entries(r.parts)) mergedParts[k] = (mergedParts[k] || 0) + v;
  return {
    cheapest: results.map(r => bestKm != null && r.perKm === bestKm),
    extraPerMonth: results.map(r => r.perMonth - bestMonth),
    mergedParts,
  };
}
