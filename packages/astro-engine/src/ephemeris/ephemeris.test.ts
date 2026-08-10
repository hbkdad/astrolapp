import { describe, expect, it } from 'vitest';
import { angularSeparation, normalizeDegrees } from '@astrolapp/shared';
import { AstronomyEngineProvider } from './astronomy-engine-provider.js';
import { LUNAR_FIXTURES, MOTION_FIXTURES, SOLAR_FIXTURES } from './fixtures.js';
import { BODY_IDS } from './types.js';

const provider = new AstronomyEngineProvider();

/**
 * The frame lock.
 *
 * These assertions exist to catch a specific, silent, high-impact failure: the
 * ephemeris returning J2000-referred coordinates instead of ecliptic-of-date.
 * Both are "correct" longitudes, but they differ by about 0.33 degrees today
 * and the error grows with time. Nothing else in the system would notice.
 */
describe('ecliptic frame', () => {
  it.each(SOLAR_FIXTURES)(
    'places the Sun at $expectedSunLongitude degrees at $label',
    ({ instant, expectedSunLongitude, toleranceDegrees }) => {
      const longitude = provider.getBodyPosition('sun', new Date(instant)).longitude;
      // Compared as a separation so the 0/360 case at the March equinox works.
      expect(angularSeparation(longitude, expectedSunLongitude)).toBeLessThan(toleranceDegrees);
    },
  );

  it('is of-date rather than J2000, by the size of the precession offset', () => {
    // Precession moves the equinox ~50.3 arcsec/yr. Between J2000 and 2024 that
    // is ~0.335 degrees. An of-date frame lands on zero at the equinox; a J2000
    // frame would sit roughly a third of a degree away.
    const equinox2024 = new Date('2024-03-20T03:06:00Z');
    const offset = angularSeparation(provider.getBodyPosition('sun', equinox2024).longitude, 0);
    expect(offset).toBeLessThan(0.01);
    expect(offset).toBeLessThan(0.1 * 0.335);
  });

  it('reports a true obliquity consistent with the current epoch', () => {
    // Mean obliquity in 2024 is ~23.4366 deg; nutation adds up to ~0.0026 deg.
    const obliquity = provider.getObliquityDegrees(new Date('2024-01-01T00:00:00Z'));
    expect(obliquity).toBeGreaterThan(23.43);
    expect(obliquity).toBeLessThan(23.45);
  });

  it('advances sidereal time by roughly one turn per sidereal day', () => {
    const start = new Date('2024-03-01T00:00:00Z');
    const later = new Date(start.getTime() + 86_164_091);
    const drift = angularSeparation(
      provider.getGreenwichSiderealTimeDegrees(start),
      provider.getGreenwichSiderealTimeDegrees(later),
    );
    expect(drift).toBeLessThan(0.05);
  });
});

describe('lunation search', () => {
  it.each(LUNAR_FIXTURES)('finds $label', ({ instant, phaseAngle, toleranceMinutes }) => {
    const expected = new Date(instant);
    const searchStart = new Date(expected.getTime() - 5 * 86_400_000);
    const found = provider.searchMoonPhase(phaseAngle, searchStart, 20);

    expect(found).not.toBeNull();
    const differenceMinutes = Math.abs((found as Date).getTime() - expected.getTime()) / 60_000;
    expect(differenceMinutes).toBeLessThan(toleranceMinutes);
  });

  it('reports near-full illumination at a Full Moon', () => {
    const illumination = provider.getMoonIlluminatedFraction(new Date('2024-01-25T17:54:00Z'));
    expect(illumination).toBeGreaterThan(0.99);
  });

  it('reports near-zero illumination at a New Moon', () => {
    const illumination = provider.getMoonIlluminatedFraction(new Date('2024-01-11T11:57:00Z'));
    expect(illumination).toBeLessThan(0.01);
  });
});

describe('longitude speed', () => {
  it.each(MOTION_FIXTURES)('classifies $label correctly', ({ body, instant, retrograde }) => {
    expect(provider.getBodyPosition(body, new Date(instant)).retrograde).toBe(retrograde);
  });

  it('never reports the Sun or Moon as retrograde', () => {
    for (let day = 0; day < 365; day += 7) {
      const date = new Date(Date.UTC(2024, 0, 1) + day * 86_400_000);
      expect(provider.getBodyPosition('sun', date).retrograde).toBe(false);
      expect(provider.getBodyPosition('moon', date).retrograde).toBe(false);
    }
  });

  it('gives the Sun and Moon their expected mean daily motion', () => {
    const date = new Date('2024-05-05T00:00:00Z');
    expect(provider.getBodyPosition('sun', date).longitudeSpeed).toBeCloseTo(0.9856, 1);
    // The Moon varies between roughly 11.8 and 15.4 deg/day.
    const moonSpeed = provider.getBodyPosition('moon', date).longitudeSpeed;
    expect(moonSpeed).toBeGreaterThan(11);
    expect(moonSpeed).toBeLessThan(16);
  });

  // Differentiating across the 0/360 seam must not produce a ~36000 deg/day spike.
  it('differentiates cleanly across the 0/360 seam', () => {
    // Scan a year of Moon positions; the seam is crossed roughly monthly.
    for (let hour = 0; hour < 24 * 60; hour += 6) {
      const date = new Date(Date.UTC(2024, 0, 1) + hour * 3_600_000);
      const speed = provider.getBodyPosition('moon', date).longitudeSpeed;
      expect(Math.abs(speed)).toBeLessThan(20);
    }
  });
});

describe('body coverage', () => {
  it('positions every declared body', () => {
    const date = new Date('2024-06-01T12:00:00Z');
    for (const body of BODY_IDS) {
      const position = provider.getBodyPosition(body, date);
      expect(position.longitude).toBeGreaterThanOrEqual(0);
      expect(position.longitude).toBeLessThan(360);
      expect(Number.isFinite(position.longitudeSpeed)).toBe(true);
    }
  });

  it('keeps the south node exactly opposite the north node', () => {
    const date = new Date('2024-06-01T12:00:00Z');
    const north = provider.getBodyPosition('northNode', date).longitude;
    const south = provider.getBodyPosition('southNode', date).longitude;
    expect(normalizeDegrees(south - north)).toBeCloseTo(180, 8);
  });

  it('moves the mean lunar node retrograde at its known rate', () => {
    const node = provider.getBodyPosition('northNode', new Date('2024-06-01T12:00:00Z'));
    expect(node.retrograde).toBe(true);
    // Mean node completes a circuit in ~18.6 years: ~ -0.0529 deg/day.
    expect(node.longitudeSpeed).toBeCloseTo(-0.0529, 3);
  });

  it('rejects an unsupported body rather than returning a wrong position', () => {
    // @ts-expect-error deliberately invalid body id
    expect(() => provider.getBodyPosition('chiron', new Date())).toThrow(RangeError);
  });

  it('is deterministic: the same instant always gives the same longitude', () => {
    const date = new Date('2024-06-01T12:00:00Z');
    const first = provider.getBodyPositions(BODY_IDS, date);
    const second = provider.getBodyPositions(BODY_IDS, date);
    expect(first).toEqual(second);
  });
});
