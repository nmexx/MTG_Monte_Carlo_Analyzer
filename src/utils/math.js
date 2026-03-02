/**
 * math.js  –  Pure numerical helpers used across the app.
 */

/**
 * Arithmetic mean of a numeric array.
 * Null / NaN values are skipped rather than poisoning the result.
 * Returns 0 for empty or falsy input.
 */
export const average = arr => {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((s, v) => (v != null && !isNaN(v) ? s + v : s), 0);
  return sum / arr.length;
};

/**
 * Population standard deviation of a numeric array.
 * Null / NaN values are skipped.
 * Returns 0 for arrays with fewer than 2 elements.
 */
export const stdDev = arr => {
  if (!arr || arr.length < 2) return 0;
  const avg = average(arr);
  const variance =
    arr.reduce((s, v) => (v != null && !isNaN(v) ? s + (v - avg) ** 2 : s), 0) / arr.length;
  return Math.sqrt(variance);
};

/** Safe toFixed() that returns 0 for falsy/NaN values. */
export const safeToFixed = (value, decimals = 2) => {
  if (value === undefined || value === null || isNaN(value)) return 0;
  return parseFloat(value.toFixed(decimals));
};
