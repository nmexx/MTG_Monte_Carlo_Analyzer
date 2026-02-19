/**
 * math.js — Unit Tests
 *
 * Covers both exported pure functions:
 *   average      – mean of a numeric array
 *   safeToFixed  – null-safe toFixed with numeric return
 *
 * Run:  npm test
 */

import { describe, it, expect } from 'vitest';
import { average, safeToFixed } from '../src/utils/math.js';

// ─────────────────────────────────────────────────────────────────────────────
// average
// ─────────────────────────────────────────────────────────────────────────────
describe('average', () => {
  it('returns 0 for null', () => {
    expect(average(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(average(undefined)).toBe(0);
  });

  it('returns 0 for an empty array', () => {
    expect(average([])).toBe(0);
  });

  it('returns the single value for a 1-element array', () => {
    expect(average([7])).toBe(7);
  });

  it('computes the mean of a simple array', () => {
    expect(average([1, 2, 3, 4, 5])).toBe(3);
  });

  it('handles all-zero values', () => {
    expect(average([0, 0, 0])).toBe(0);
  });

  it('handles decimal values', () => {
    expect(average([1.5, 2.5])).toBe(2);
  });

  it('handles large arrays', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(average(arr)).toBe(50.5);
  });

  it('skips null values in the array', () => {
    // null elements are excluded from the sum but still count toward length
    // average([2, null, 4]) → sum=6, length=3 → 2
    expect(average([2, null, 4])).toBe(2);
  });

  it('skips NaN values', () => {
    expect(average([4, NaN, 6])).toBe(10 / 3);
  });

  it('handles negative numbers', () => {
    expect(average([-3, -1, 0, 1, 3])).toBe(0);
  });

  it('handles a 2-element array', () => {
    expect(average([10, 20])).toBe(15);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeToFixed
// ─────────────────────────────────────────────────────────────────────────────
describe('safeToFixed', () => {
  it('returns 0 for undefined', () => {
    expect(safeToFixed(undefined)).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(safeToFixed(null)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(safeToFixed(NaN)).toBe(0);
  });

  it('rounds to 2 decimal places by default', () => {
    expect(safeToFixed(3.14159)).toBe(3.14);
  });

  it('rounds to the specified number of decimals', () => {
    expect(safeToFixed(3.14159, 4)).toBe(3.1416);
    expect(safeToFixed(3.14159, 0)).toBe(3);
  });

  it('returns a JS number, not a string', () => {
    expect(typeof safeToFixed(1.234, 2)).toBe('number');
  });

  it('handles exact integers without change', () => {
    expect(safeToFixed(5, 2)).toBe(5);
  });

  it('handles zero', () => {
    expect(safeToFixed(0, 2)).toBe(0);
  });

  it('handles negative numbers', () => {
    expect(safeToFixed(-2.567, 2)).toBe(-2.57);
  });

  it('handles very small decimals', () => {
    expect(safeToFixed(0.001, 2)).toBe(0);
    expect(safeToFixed(0.001, 3)).toBe(0.001);
  });
});
