// Your card in the video game, rated every summer.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** skills: profile skill points (0..20000); avg: season average rating. */
export function rateCard(c, skills, age, year, avg, goals) {
  const sc = k => clamp(Math.round(38 + (skills[k] || 0) / 20000 * 60), 30, 99);
  const mean = ks => Math.round(ks.reduce((a, k) => a + sc(k), 0) / ks.length);
  const form = avg ? (avg - 6.4) * 10 : 0;
  const attrs = {
    PAC: clamp(Math.round(68 + Math.min(age, 24) - 16 + (age > 27 ? -(age - 27) * 3 : 0)), 35, 95),
    SHO: clamp(mean(['volley', 'snapshot', 'turn']) + Math.round(form / 2), 30, 99),
    HEA: mean(['header', 'overhead']), PAS: mean(['passing', 'crossing']), SET: mean(['penalty', 'freekick']),
    PHY: clamp(Math.round(52 + Math.min(age, 28) - 16 + (age > 31 ? -(age - 31) * 3 : 0)), 35, 92),
  };
  const ovr = clamp(Math.round(attrs.SHO * .3 + attrs.PAC * .15 + attrs.HEA * .15 + attrs.PAS * .1 + attrs.SET * .1 + attrs.PHY * .2 + form * .6 + Math.min(goals, 30) * .2), 40, 99);
  return { game: `FOOTY ${String(year + 1).slice(-2)}`, year, ovr, attrs, tier: ovr >= 75 ? 'gold' : ovr >= 65 ? 'silver' : 'bronze' };
}
