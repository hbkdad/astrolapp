import { describe, expect, it } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import { normalizeDegrees } from '@astrolapp/shared';
import { AstronomyEngineProvider } from './ephemeris/astronomy-engine-provider.js';
import {
  HouseSystemUndefinedError,
  computeChartAngles,
  computeHouseCusps,
  houseOfLongitude,
  type GeoCoordinates,
} from './houses.js';
import { longitudeToZodiac } from './zodiac.js';

const provider = new AstronomyEngineProvider();

const LONDON: GeoCoordinates = { latitude: 51.5074, longitude: -0.1278 };
const NEW_YORK: GeoCoordinates = { latitude: 40.7128, longitude: -74.006 };
const SYDNEY: GeoCoordinates = { latitude: -33.8688, longitude: 151.2093 };
const QUITO: GeoCoordinates = { latitude: -0.1807, longitude: -78.4678 };
const TROMSO: GeoCoordinates = { latitude: 69.6492, longitude: 18.9553 };

const SAMPLE_INSTANTS = [
  '1990-05-15T14:30:00Z',
  '2024-01-01T00:00:00Z',
  '2024-06-21T12:00:00Z',
  '2005-11-08T23:45:00Z',
];

/**
 * Convert an ecliptic longitude on the ecliptic plane to horizontal coordinates.
 *
 * This deliberately goes through the ephemeris library's own rotation machinery
 * rather than reusing any of our trigonometry, so the assertions below are an
 * independent check on `computeChartAngles` rather than a restatement of it.
 */
function horizontalForEclipticLongitude(
  longitude: number,
  date: Date,
  coordinates: GeoCoordinates,
): { altitude: number; azimuth: number } {
  const time = Astronomy.MakeTime(date);
  const sphere = new Astronomy.Spherical(0, longitude, 1);
  const eclipticVector = Astronomy.VectorFromSphere(sphere, time);
  const equatorial = Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(time), eclipticVector);
  const equatorialCoords = Astronomy.EquatorFromVector(equatorial);
  const observer = new Astronomy.Observer(coordinates.latitude, coordinates.longitude, 0);
  // Refraction MUST be off here. The ascendant is a geometric definition, not an
  // observed one, and atmospheric refraction lifts a body at the horizon by
  // ~0.48 degrees — enough to look like a formula error if left switched on.
  const horizontal = Astronomy.Horizon(
    time,
    observer,
    equatorialCoords.ra,
    equatorialCoords.dec,
    undefined,
  );
  return { altitude: horizontal.altitude, azimuth: horizontal.azimuth };
}

describe('chart angles', () => {
  /**
   * The defining property of the ascendant: it is the ecliptic degree sitting
   * on the eastern horizon. If the formula were wrong, this would not be zero.
   */
  it.each(
    SAMPLE_INSTANTS.flatMap((instant) =>
      [LONDON, NEW_YORK, SYDNEY, QUITO].map((coordinates) => [instant, coordinates] as const),
    ),
  )('puts the ascendant on the horizon at %s', (instant, coordinates) => {
    const date = new Date(instant);
    const angles = computeChartAngles(
      provider.getGreenwichSiderealTimeDegrees(date),
      provider.getObliquityDegrees(date),
      coordinates,
    );

    const { altitude, azimuth } = horizontalForEclipticLongitude(
      angles.ascendant,
      date,
      coordinates,
    );

    // Refraction is disabled above, so the horizon is exactly zero altitude.
    expect(Math.abs(altitude)).toBeLessThan(0.02);
    // Rising, therefore on the eastern half of the compass.
    expect(azimuth).toBeGreaterThan(0);
    expect(azimuth).toBeLessThan(180);
  });

  /** The midheaven is the ecliptic degree on the upper meridian, due south or north. */
  it.each(
    SAMPLE_INSTANTS.flatMap((instant) =>
      [LONDON, NEW_YORK, SYDNEY].map((coordinates) => [instant, coordinates] as const),
    ),
  )('puts the midheaven on the meridian at %s', (instant, coordinates) => {
    const date = new Date(instant);
    const angles = computeChartAngles(
      provider.getGreenwichSiderealTimeDegrees(date),
      provider.getObliquityDegrees(date),
      coordinates,
    );

    const { azimuth } = horizontalForEclipticLongitude(angles.midheaven, date, coordinates);
    // On the meridian means due north (0) or due south (180).
    const distanceFromMeridian = Math.min(azimuth, Math.abs(azimuth - 180), 360 - azimuth);
    expect(distanceFromMeridian).toBeLessThan(0.05);
  });

  it('keeps descendant and imum coeli exactly opposite their partners', () => {
    const date = new Date('2024-03-15T08:20:00Z');
    const angles = computeChartAngles(
      provider.getGreenwichSiderealTimeDegrees(date),
      provider.getObliquityDegrees(date),
      LONDON,
    );
    expect(normalizeDegrees(angles.descendant - angles.ascendant)).toBeCloseTo(180, 9);
    expect(normalizeDegrees(angles.imumCoeli - angles.midheaven)).toBeCloseTo(180, 9);
  });

  it('places the ascendant 90 degrees after the midheaven on the equator at RAMC 0', () => {
    // A closed-form case: on the equator with the vernal point culminating, the
    // ascendant is exactly 0 degrees Cancer.
    const angles = computeChartAngles(0, 23.4392911, { latitude: 0, longitude: 0 });
    expect(angles.midheaven).toBeCloseTo(0, 9);
    expect(angles.ascendant).toBeCloseTo(90, 9);
  });
});

describe('house systems', () => {
  const date = new Date('1990-05-15T14:30:00Z');
  const gst = provider.getGreenwichSiderealTimeDegrees(date);
  const obliquity = provider.getObliquityDegrees(date);

  it('starts whole-sign houses at the ascendant sign boundary', () => {
    const houses = computeHouseCusps('whole-sign', gst, obliquity, LONDON);
    const ascendantSign = longitudeToZodiac(houses.angles.ascendant).sign;

    expect(longitudeToZodiac(houses.cusps[0]!.longitude).sign).toBe(ascendantSign);
    expect(houses.cusps[0]!.longitude % 30).toBeCloseTo(0, 9);
    for (let index = 0; index < 12; index += 1) {
      expect(houses.cusps[index]!.longitude % 30).toBeCloseTo(0, 9);
    }
  });

  it('starts equal houses exactly on the ascendant', () => {
    const houses = computeHouseCusps('equal', gst, obliquity, LONDON);
    expect(houses.cusps[0]!.longitude).toBeCloseTo(houses.angles.ascendant, 9);
    expect(houses.cusps[6]!.longitude).toBeCloseTo(
      normalizeDegrees(houses.angles.ascendant + 180),
      9,
    );
  });

  it('places the midheaven on the tenth cusp under Placidus only', () => {
    const placidus = computeHouseCusps('placidus', gst, obliquity, LONDON);
    expect(placidus.cusps[9]!.longitude).toBeCloseTo(placidus.angles.midheaven, 9);
    expect(placidus.cusps[0]!.longitude).toBeCloseTo(placidus.angles.ascendant, 9);
  });

  it('keeps Placidus cusps in ascending order around the circle', () => {
    for (const coordinates of [LONDON, NEW_YORK, SYDNEY, QUITO]) {
      for (const instant of SAMPLE_INSTANTS) {
        const sampleDate = new Date(instant);
        const houses = computeHouseCusps(
          'placidus',
          provider.getGreenwichSiderealTimeDegrees(sampleDate),
          provider.getObliquityDegrees(sampleDate),
          coordinates,
        );

        // Consecutive forward spans must be positive and must total one circle.
        let total = 0;
        for (let index = 0; index < 12; index += 1) {
          const span = normalizeDegrees(
            houses.cusps[(index + 1) % 12]!.longitude - houses.cusps[index]!.longitude,
          );
          expect(span).toBeGreaterThan(0);
          expect(span).toBeLessThan(180);
          total += span;
        }
        expect(total).toBeCloseTo(360, 6);
      }
    }
  });

  it('keeps opposite Placidus cusps exactly 180 degrees apart', () => {
    const houses = computeHouseCusps('placidus', gst, obliquity, NEW_YORK);
    for (let index = 0; index < 6; index += 1) {
      const separation = normalizeDegrees(
        houses.cusps[index + 6]!.longitude - houses.cusps[index]!.longitude,
      );
      expect(separation).toBeCloseTo(180, 8);
    }
  });

  /**
   * Placidus genuinely has no solution inside the polar circles. Failing loudly
   * is correct; silently returning cusps would be a correctness bug that reached
   * the user as a plausible-looking but meaningless chart.
   */
  it('refuses to compute Placidus at polar latitudes', () => {
    expect(() => computeHouseCusps('placidus', gst, obliquity, TROMSO)).toThrow(
      HouseSystemUndefinedError,
    );
  });

  it('still computes whole-sign houses at polar latitudes', () => {
    const houses = computeHouseCusps('whole-sign', gst, obliquity, TROMSO);
    expect(houses.cusps).toHaveLength(12);
  });
});

describe('houseOfLongitude', () => {
  const date = new Date('1990-05-15T14:30:00Z');
  const houses = computeHouseCusps(
    'placidus',
    provider.getGreenwichSiderealTimeDegrees(date),
    provider.getObliquityDegrees(date),
    LONDON,
  );

  it('assigns a cusp longitude to its own house', () => {
    for (const cusp of houses.cusps) {
      expect(houseOfLongitude(cusp.longitude, houses.cusps)).toBe(cusp.house);
    }
  });

  it('assigns every longitude on the circle to exactly one house', () => {
    for (let longitude = 0; longitude < 360; longitude += 0.5) {
      const house = houseOfLongitude(longitude, houses.cusps);
      expect(house).toBeGreaterThanOrEqual(1);
      expect(house).toBeLessThanOrEqual(12);
    }
  });

  it('handles longitudes just below a cusp', () => {
    const secondCusp = houses.cusps[1]!;
    expect(houseOfLongitude(secondCusp.longitude - 0.0001, houses.cusps)).toBe(1);
    expect(houseOfLongitude(secondCusp.longitude, houses.cusps)).toBe(2);
  });

  it('rejects a malformed cusp array', () => {
    expect(() => houseOfLongitude(10, houses.cusps.slice(0, 5))).toThrow(RangeError);
  });
});
