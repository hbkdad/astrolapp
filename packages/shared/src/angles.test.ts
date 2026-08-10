import { describe, expect, it } from 'vitest';
import {
  angularSeparation,
  normalizeDegrees,
  signedAngularDifference,
  toDegreeMinuteSecond,
} from './angles.js';

describe('normalizeDegrees', () => {
  it('leaves in-range values untouched', () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(180)).toBe(180);
    expect(normalizeDegrees(359.999)).toBeCloseTo(359.999, 10);
  });

  it('wraps a full turn back to zero rather than to 360', () => {
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(720)).toBe(0);
    expect(normalizeDegrees(-360)).toBe(0);
  });

  it('maps negative angles into range', () => {
    expect(normalizeDegrees(-1)).toBe(359);
    expect(normalizeDegrees(-90)).toBe(270);
    expect(normalizeDegrees(-450)).toBe(270);
  });

  // A tiny negative input can round up to exactly 360 in floating point. If that
  // escaped, floor(360/30) would give sign index 12 and crash sign lookup.
  it('never returns exactly 360 for infinitesimally negative input', () => {
    expect(normalizeDegrees(-1e-15)).toBe(0);
    expect(normalizeDegrees(-Number.MIN_VALUE)).toBe(0);
  });

  it('rejects non-finite input instead of propagating NaN', () => {
    expect(() => normalizeDegrees(Number.NaN)).toThrow(RangeError);
    expect(() => normalizeDegrees(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('angularSeparation', () => {
  it('measures the short way round', () => {
    expect(angularSeparation(10, 350)).toBeCloseTo(20, 10);
    expect(angularSeparation(350, 10)).toBeCloseTo(20, 10);
    expect(angularSeparation(0, 190)).toBeCloseTo(170, 10);
  });

  it('is symmetric and bounded by 180', () => {
    for (const [a, b] of [
      [0, 0],
      [0, 180],
      [45, 315],
      [359.9, 0.1],
      [123.456, 300.789],
    ] as const) {
      expect(angularSeparation(a, b)).toBeCloseTo(angularSeparation(b, a), 10);
      expect(angularSeparation(a, b)).toBeLessThanOrEqual(180);
      expect(angularSeparation(a, b)).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles the 0/360 seam without inventing a large separation', () => {
    expect(angularSeparation(359.999, 0.001)).toBeCloseTo(0.002, 10);
  });
});

describe('signedAngularDifference', () => {
  it('returns a signed value in (-180, 180]', () => {
    expect(signedAngularDifference(10, 350)).toBeCloseTo(20, 10);
    expect(signedAngularDifference(350, 10)).toBeCloseTo(-20, 10);
    expect(signedAngularDifference(0, 180)).toBeCloseTo(180, 10);
  });
});

describe('toDegreeMinuteSecond', () => {
  it('splits decimal degrees', () => {
    expect(toDegreeMinuteSecond(0)).toEqual({ degrees: 0, minutes: 0, seconds: 0 });
    expect(toDegreeMinuteSecond(12.5)).toEqual({ degrees: 12, minutes: 30, seconds: 0 });
  });

  // Rounding 59.9999 arcseconds up must carry into minutes, not display as 60.
  it('carries rounding overflow upward', () => {
    const result = toDegreeMinuteSecond(29.999999);
    expect(result.minutes).toBeLessThan(60);
    expect(result.seconds).toBeLessThan(60);
    expect(result).toEqual({ degrees: 30, minutes: 0, seconds: 0 });
  });
});
