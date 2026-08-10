/**
 * Angular arithmetic on the ecliptic circle.
 *
 * Every celestial longitude in this codebase is a tropical ecliptic longitude
 * expressed in degrees on the half-open interval [0, 360). Wrapping bugs are the
 * single most common source of silent astrology errors, so all wrapping goes
 * through this module and nowhere else.
 */

/** Degrees in a full circle. */
export const FULL_CIRCLE = 360;

/**
 * Normalize any angle in degrees into [0, 360).
 *
 * Uses a double-modulo so negative inputs land in range, and clamps the
 * pathological case where a tiny negative input (e.g. -1e-15) rounds up to
 * exactly 360 in floating point — that must come back as 0, never 360.
 */
export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new RangeError(`normalizeDegrees expects a finite number, received ${degrees}`);
  }
  const wrapped = ((degrees % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE;
  // Floating point can produce exactly 360 for inputs infinitesimally below 0.
  return wrapped === FULL_CIRCLE ? 0 : wrapped;
}

/**
 * Shortest unsigned separation between two longitudes, in [0, 180].
 *
 * This is the quantity aspect detection compares against exact aspect angles.
 */
export function angularSeparation(a: number, b: number): number {
  const diff = normalizeDegrees(a - b);
  return Math.min(diff, FULL_CIRCLE - diff);
}

/**
 * Signed shortest difference `a - b`, in (-180, 180].
 *
 * Positive means `a` is ahead of `b` in order of increasing longitude by the
 * short way round. Used to determine which side of an exact aspect a body sits
 * on, which in turn drives applying vs separating.
 */
export function signedAngularDifference(a: number, b: number): number {
  const diff = normalizeDegrees(a - b);
  return diff > 180 ? diff - FULL_CIRCLE : diff;
}

/** Degrees to radians. */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Radians to degrees. */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Split a positive decimal degree value into degrees, arcminutes, arcseconds.
 *
 * Rounds at the arcsecond and carries overflow upward so callers never see
 * 60 minutes or 60 seconds.
 */
export function toDegreeMinuteSecond(decimalDegrees: number): {
  degrees: number;
  minutes: number;
  seconds: number;
} {
  const totalSeconds = Math.round(decimalDegrees * 3600);
  const degrees = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { degrees, minutes, seconds };
}
