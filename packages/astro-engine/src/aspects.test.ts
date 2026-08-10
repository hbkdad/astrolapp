import { describe, expect, it } from 'vitest';
import { ALL_ASPECTS, DEFAULT_ORBS, MAJOR_ASPECTS, findAllAspects, findAspect } from './aspects.js';

describe('aspect detection', () => {
  it('finds each major aspect at its exact angle', () => {
    for (const definition of MAJOR_ASPECTS) {
      const aspect = findAspect(0, definition.exactAngle);
      expect(aspect?.type).toBe(definition.type);
      expect(aspect?.orb).toBeCloseTo(0, 10);
      expect(aspect?.normalizedStrength).toBeCloseTo(1, 10);
    }
  });

  it('detects aspects across the 0/360 seam', () => {
    // 350 and 80 are 90 degrees apart the short way round.
    expect(findAspect(350, 80)?.type).toBe('square');
    expect(findAspect(80, 350)?.type).toBe('square');
    // 359 and 1 are a 2-degree conjunction, not a 358-degree nothing.
    const conjunction = findAspect(359, 1);
    expect(conjunction?.type).toBe('conjunction');
    expect(conjunction?.orb).toBeCloseTo(2, 10);
  });

  it('is symmetric in its arguments', () => {
    for (let a = 0; a < 360; a += 17) {
      for (let b = 0; b < 360; b += 23) {
        const forward = findAspect(a, b);
        const backward = findAspect(b, a);
        expect(forward?.type).toBe(backward?.type);
        expect(forward?.orb ?? 0).toBeCloseTo(backward?.orb ?? 0, 10);
      }
    }
  });
});

describe('orb boundaries', () => {
  it('includes an aspect exactly at the orb limit', () => {
    // Square orb is 7 degrees by default.
    expect(findAspect(0, 97)?.type).toBe('square');
    expect(findAspect(0, 97)?.normalizedStrength).toBeCloseTo(0, 10);
  });

  it('excludes an aspect just beyond the orb limit', () => {
    expect(findAspect(0, 97.0001)).toBeNull();
  });

  it('scales strength linearly from exact to the orb limit', () => {
    const halfway = findAspect(0, 93.5);
    expect(halfway?.type).toBe('square');
    expect(halfway?.normalizedStrength).toBeCloseTo(0.5, 10);
  });

  it('respects a custom orb configuration', () => {
    const tight = findAspect(0, 95, { orbs: { ...DEFAULT_ORBS, square: 3 } });
    expect(tight).toBeNull();
    const wide = findAspect(0, 95, { orbs: { ...DEFAULT_ORBS, square: 10 } });
    expect(wide?.type).toBe('square');
  });

  it('treats a zero or missing orb as disabling that aspect', () => {
    expect(findAspect(0, 90, { orbs: { square: 0 } })).toBeNull();
    expect(findAspect(0, 90, { orbs: {} })).toBeNull();
  });

  it('prefers the tightest aspect when several are in range', () => {
    // 31 degrees is 1 degree from a semisextile and 29 from a conjunction; only
    // the semisextile is within its orb, but this also guards the ordering rule.
    const aspect = findAspect(0, 31, { aspects: ALL_ASPECTS });
    expect(aspect?.type).toBe('semisextile');
  });
});

describe('applying and separating', () => {
  // Faster body behind a slower one, closing on the exact angle.
  it('reports applying when the orb is closing', () => {
    const aspect = findAspect(88, 0, {
      speeds: { a: 1, b: 0 },
    });
    expect(aspect?.type).toBe('square');
    expect(aspect?.phase).toBe('applying');
  });

  it('reports separating when the orb is opening', () => {
    const aspect = findAspect(92, 0, { speeds: { a: 1, b: 0 } });
    expect(aspect?.type).toBe('square');
    expect(aspect?.phase).toBe('separating');
  });

  it('reverses when the faster body is retrograde', () => {
    const aspect = findAspect(92, 0, { speeds: { a: -1, b: 0 } });
    expect(aspect?.phase).toBe('applying');
  });

  it('returns unknown when no speeds are supplied', () => {
    expect(findAspect(88, 0)?.phase).toBe('unknown');
  });

  // Near a station the direction genuinely is undetermined; asserting one would
  // produce a prediction that reverses within hours.
  it('returns unknown when relative motion is negligible', () => {
    expect(findAspect(88, 0, { speeds: { a: 0.5, b: 0.5 } })?.phase).toBe('unknown');
  });

  it('classifies correctly across the 0/360 seam', () => {
    // Transiting body at 359 approaching a natal point at 1: applying conjunction.
    expect(findAspect(359, 1, { speeds: { a: 1, b: 0 } })?.phase).toBe('applying');
    expect(findAspect(1, 359, { speeds: { a: 1, b: 0 } })?.phase).toBe('separating');
  });
});

describe('findAllAspects', () => {
  it('returns every matching aspect ordered by orb', () => {
    const results = findAllAspects(0, 31, { aspects: ALL_ASPECTS });
    expect(results.length).toBeGreaterThan(0);
    for (let index = 1; index < results.length; index += 1) {
      expect(results[index]!.orb).toBeGreaterThanOrEqual(results[index - 1]!.orb);
    }
  });

  it('returns an empty array when nothing is in orb', () => {
    expect(findAllAspects(0, 20)).toEqual([]);
  });
});
