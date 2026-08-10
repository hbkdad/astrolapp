/**
 * EphemerisProvider backed by `astronomy-engine` (MIT).
 *
 * Frame guarantee: `Astronomy.Ecliptic()` returns coordinates in the TRUE
 * ecliptic and equinox OF DATE, which is the frame tropical astrology requires.
 * This was verified empirically rather than assumed — at the March 2024 equinox
 * the Sun's longitude computes to 359.99975 degrees, i.e. within one arcsecond
 * of zero. A J2000-referred frame would have been off by roughly 0.33 degrees.
 * `ephemeris.test.ts` locks this behaviour down so a dependency upgrade that
 * silently changed frames would fail the build.
 */

import * as Astronomy from 'astronomy-engine';
import { normalizeDegrees, signedAngularDifference, toDegrees, toRadians } from '@astrolapp/shared';
import type { BodyId, BodyPosition, EphemerisProvider } from './types.js';

/** Bodies astronomy-engine positions directly. The nodes are handled separately. */
const ASTRONOMY_BODY_BY_ID: Partial<Record<BodyId, Astronomy.Body>> = {
  sun: Astronomy.Body.Sun,
  moon: Astronomy.Body.Moon,
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluto: Astronomy.Body.Pluto,
};

/**
 * Interval used for numerical differentiation of longitude, in days.
 *
 * A central difference over this span resolves the Moon (~13 deg/day) and the
 * outer planets (~0.002 deg/day near station) without floating-point noise.
 */
const SPEED_DELTA_DAYS = 0.01;

const MILLISECONDS_PER_DAY = 86_400_000;

/** Julian centuries of Terrestrial Time since J2000.0. */
function julianCenturiesTT(date: Date): number {
  return Astronomy.MakeTime(date).tt / 36525;
}

/**
 * Mean longitude of the Moon's ascending node, in degrees.
 *
 * Meeus, *Astronomical Algorithms* 2nd ed., chapter 47. This is the MEAN node.
 * The true (osculating) node oscillates about it by up to ~1.6 degrees; which
 * one a chart should use is an astrological convention choice, and this engine
 * documents its answer rather than leaving it implicit.
 */
function meanAscendingNodeLongitude(date: Date): number {
  const t = julianCenturiesTT(date);
  const longitude =
    125.0445479 -
    1934.1362891 * t +
    0.0020754 * t * t +
    (t * t * t) / 467_441 -
    (t * t * t * t) / 60_616_000;
  return normalizeDegrees(longitude);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

/** Geocentric apparent ecliptic-of-date longitude/latitude for a provider body. */
function eclipticOfDate(
  body: Astronomy.Body,
  date: Date,
): { longitude: number; latitude: number; distanceAu: number } {
  // `true` requests aberration correction, giving the apparent position — the
  // position an observer actually sees, which is what a chart should show.
  const geoVector = Astronomy.GeoVector(body, date, true);
  const ecliptic = Astronomy.Ecliptic(geoVector);
  return {
    longitude: normalizeDegrees(ecliptic.elon),
    latitude: ecliptic.elat,
    distanceAu: Math.hypot(geoVector.x, geoVector.y, geoVector.z),
  };
}

/**
 * Longitude rate of change via central difference, in degrees per day.
 *
 * Differencing goes through `signedAngularDifference` so a sample pair that
 * straddles 0/360 yields a small real speed rather than a spurious ~360.
 */
function longitudeSpeed(longitudeAt: (date: Date) => number, date: Date): number {
  const before = longitudeAt(addDays(date, -SPEED_DELTA_DAYS));
  const after = longitudeAt(addDays(date, SPEED_DELTA_DAYS));
  return signedAngularDifference(after, before) / (2 * SPEED_DELTA_DAYS);
}

export class AstronomyEngineProvider implements EphemerisProvider {
  readonly id = 'astronomy-engine';
  readonly version: string;

  constructor(version = '2.1.19') {
    this.version = version;
  }

  getBodyPosition(body: BodyId, date: Date): BodyPosition {
    if (body === 'northNode' || body === 'southNode') {
      return this.nodePosition(body, date);
    }

    const astronomyBody = ASTRONOMY_BODY_BY_ID[body];
    if (astronomyBody === undefined) {
      throw new RangeError(`Body '${body}' is not supported by ${this.id}`);
    }

    const { longitude, latitude, distanceAu } = eclipticOfDate(astronomyBody, date);
    const speed = longitudeSpeed((d) => eclipticOfDate(astronomyBody, d).longitude, date);

    return {
      body,
      longitude,
      latitude,
      distanceAu,
      longitudeSpeed: speed,
      retrograde: speed < 0,
    };
  }

  /**
   * Lunar node position.
   *
   * The mean node moves retrograde essentially always (~ -0.053 deg/day), so
   * `retrograde` is a computed result here like any other body rather than a
   * hardcoded flag. The south node is exactly opposite the north node.
   */
  private nodePosition(body: 'northNode' | 'southNode', date: Date): BodyPosition {
    const offset = body === 'northNode' ? 0 : 180;
    const longitudeAt = (d: Date): number =>
      normalizeDegrees(meanAscendingNodeLongitude(d) + offset);
    const speed = longitudeSpeed(longitudeAt, date);

    return {
      body,
      longitude: longitudeAt(date),
      latitude: 0,
      distanceAu: null,
      longitudeSpeed: speed,
      retrograde: speed < 0,
    };
  }

  getBodyPositions(bodies: readonly BodyId[], date: Date): BodyPosition[] {
    return bodies.map((body) => this.getBodyPosition(body, date));
  }

  /**
   * True obliquity of date, in degrees.
   *
   * Derived from the library's own EQD->ECT rotation by rotating the equatorial
   * pole into the ecliptic frame and measuring its tilt. Taking obliquity from
   * the same source as the body positions keeps houses and planets in one
   * consistent frame; an independently-computed obliquity could drift from it.
   */
  getObliquityDegrees(date: Date): number {
    const time = Astronomy.MakeTime(date);
    const rotation = Astronomy.Rotation_EQD_ECT(time);
    const equatorialPole = new Astronomy.Vector(0, 0, 1, time);
    const inEcliptic = Astronomy.RotateVector(rotation, equatorialPole);
    return toDegrees(Math.acos(inEcliptic.z));
  }

  /** Greenwich apparent sidereal time in degrees. The library returns hours. */
  getGreenwichSiderealTimeDegrees(date: Date): number {
    return normalizeDegrees(Astronomy.SiderealTime(date) * 15);
  }

  searchMoonPhase(targetPhaseAngle: number, startDate: Date, limitDays: number): Date | null {
    const result = Astronomy.SearchMoonPhase(
      normalizeDegrees(targetPhaseAngle),
      startDate,
      limitDays,
    );
    return result === null ? null : result.date;
  }

  getMoonIlluminatedFraction(date: Date): number {
    return Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction;
  }
}

/** Convenience singleton. Stateless, so sharing one instance is safe. */
export const defaultEphemerisProvider: EphemerisProvider = new AstronomyEngineProvider();

/** Exported for the house engine, which needs radians for spherical trigonometry. */
export const obliquityRadians = (provider: EphemerisProvider, date: Date): number =>
  toRadians(provider.getObliquityDegrees(date));
