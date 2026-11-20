// Commentary helpers: pick a line and fill its {placeholders}.
export const pickR = (a, R = Math.random) => a[Math.floor(R() * a.length)];
export function fill(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)); }
