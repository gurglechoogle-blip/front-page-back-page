// How hard a chance is depends on who you're up against. Your skill level maps
// onto the same scale as club strength (0% skill ≈ National League standard,
// 50% ≈ Championship, 100% ≈ world class). Against a defence above your level
// the timing windows tighten; against one below it they open up a little.
// Training (no opponent) is untouched: the moments only ever see this number.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const playerRating = skillLevel => 30 + skillLevel * .62;
export function difficultyMult(skillLevel, oppStrength) {
  const gap = oppStrength - playerRating(skillLevel);
  return clamp(1 - gap / 45, .7, 1.2);
}
/** base: your normal skill factor for this moment (1..1.5). */
export const matchSkillFactor = (base, skillLevel, oppStrength) => clamp(base * difficultyMult(skillLevel, oppStrength), .7, 1.5);
