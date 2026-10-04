const fixed = (digits: number) =>
  new Intl.NumberFormat('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const int = fixed(0);
const one = fixed(1);

export const formatKm = (meters: number) => `${(meters >= 10000 ? int : one).format(meters / 1000)} km`;
export const formatM = (meters: number) => `${int.format(meters)} m`;
export const formatGrade = (grade: number) => `${one.format(grade)}%`;
export const formatIndex = (value: number) => one.format(value);
export const formatNumber = (value: number, digits = 0) => fixed(digits).format(value);

/** Evenly spaced "nice" axis ticks (1, 2, 2.5, 5 × 10ⁿ) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
  const ticks = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return ticks;
}

/** Expands [min, max] outward to the nearest nice ticks. */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
  const ticks = niceTicks(min, max, count);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 10;
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}
