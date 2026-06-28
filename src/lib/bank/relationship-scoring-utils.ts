/** Cap positive contributions toward a maximum bonus. */
export function capPositive(value: number, max: number): number {
  if (value <= 0) return 0;
  return Math.min(value, max);
}

/** Cap negative penalties toward a maximum magnitude (returns positive magnitude). */
export function capNegativeMagnitude(value: number, maxMagnitude: number): number {
  if (value >= 0) return 0;
  return Math.min(Math.abs(value), maxMagnitude);
}

/** Signed cap: positive values capped at max; negative values capped at -maxMagnitude. */
export function capSigned(value: number, maxPositive: number, maxNegativeMagnitude?: number): number {
  if (value > 0) return Math.min(value, maxPositive);
  if (value < 0) return -capNegativeMagnitude(value, maxNegativeMagnitude ?? maxPositive);
  return 0;
}
