/**
 * Ephemeris abstraction.
 *
 * NOTHING outside `src/ephemeris/` may import an ephemeris library directly.
 * All astronomical fact enters the system through this interface so the
 * underlying provider (currently astronomy-engine, potentially Swiss Ephemeris)
 * can be replaced without touching zodiac, aspect, house or transit code.
 *
 * See docs/ADR/0001-ephemeris-provider.md for the licensing analysis behind the
 * current default.
 */

/**
 * Bodies the platform can position.
 *
 * The ten classical bodies come from the ephemeris provider directly. The lunar
 * nodes are a derived mean-element calculation, not a provider lookup — see
 * `MEAN_NODE_*` in the astronomy-engine provider.
 *
 * Chiron, Lilith and the major asteroids are deliberately absent: they require
 * ephemeris data astronomy-engine does not carry. Adding them means either a
 * provider swap or a supplementary data source, not a change to this list alone.
 */
export const BODY_IDS = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'northNode',
  'southNode',
] as const;

export type BodyId = (typeof BODY_IDS)[number];

/** The ten bodies every chart includes by default. */
export const DEFAULT_CHART_BODIES: readonly BodyId[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
];

/**
 * A body's geocentric position at an instant.
 *
 * `longitude` is the tropical ecliptic longitude referred to the true equinox
 * and ecliptic OF DATE — not J2000. This is the frame Western astrology uses;
 * mixing frames silently shifts every placement by roughly a degree per 72
 * years, so the provider is responsible for guaranteeing it.
 */
export interface BodyPosition {
  readonly body: BodyId;
  /** Tropical ecliptic longitude of date, degrees, [0, 360). */
  readonly longitude: number;
  /** Ecliptic latitude, degrees. Zero by definition for the lunar nodes. */
  readonly latitude: number;
  /** Distance from Earth in astronomical units; null where not meaningful. */
  readonly distanceAu: number | null;
  /** Rate of change of longitude in degrees per day. Negative means retrograde. */
  readonly longitudeSpeed: number;
  /** True when `longitudeSpeed` is negative (apparent retrograde motion). */
  readonly retrograde: boolean;
}

/**
 * Source of astronomical fact.
 *
 * Implementations must be pure: the same instant must always yield the same
 * numbers, so that a stored chart can be recomputed and verified years later.
 */
export interface EphemerisProvider {
  /** Stable identifier recorded on every calculation, e.g. `astronomy-engine`. */
  readonly id: string;
  /** Provider version recorded on every calculation, for reproducibility. */
  readonly version: string;

  /** Geocentric apparent position of a single body. */
  getBodyPosition(body: BodyId, date: Date): BodyPosition;

  /** Geocentric apparent positions of several bodies at one instant. */
  getBodyPositions(bodies: readonly BodyId[], date: Date): BodyPosition[];

  /** True obliquity of the ecliptic of date, in degrees. Needed for houses. */
  getObliquityDegrees(date: Date): number;

  /** Greenwich apparent sidereal time, in degrees [0, 360). Needed for houses. */
  getGreenwichSiderealTimeDegrees(date: Date): number;

  /**
   * Instant of the next time the Moon reaches the given elongation from the Sun.
   *
   * `targetPhaseAngle` is (moonLongitude - sunLongitude) normalized to [0, 360):
   * 0 = New Moon, 90 = First Quarter, 180 = Full Moon, 270 = Third Quarter.
   * Returns null if no such instant occurs within `limitDays`.
   */
  searchMoonPhase(targetPhaseAngle: number, startDate: Date, limitDays: number): Date | null;

  /** Fraction of the Moon's disc illuminated, 0..1. */
  getMoonIlluminatedFraction(date: Date): number;
}
