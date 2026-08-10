/**
 * Lunar state and lunation events.
 *
 * Phase is derived from actual solar and lunar longitudes, never from a
 * calendar approximation. An approximate synodic-day model drifts by hours
 * within a single lunation and will place a Full Moon on the wrong date several
 * times a year, which users notice immediately.
 */

import { normalizeDegrees } from '@astrolapp/shared';
import type { EphemerisProvider } from './ephemeris/types.js';
import { longitudeToZodiac, type ZodiacPosition } from './zodiac.js';

export const MOON_PHASES = [
  'new-moon',
  'waxing-crescent',
  'first-quarter',
  'waxing-gibbous',
  'full-moon',
  'waning-gibbous',
  'third-quarter',
  'waning-crescent',
] as const;

export type MoonPhaseName = (typeof MOON_PHASES)[number];

/** Mean synodic month in days. Used only to size search windows, never as a result. */
export const MEAN_SYNODIC_MONTH_DAYS = 29.530588853;

const MILLISECONDS_PER_DAY = 86_400_000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

/**
 * Phase angle band width, in degrees.
 *
 * The four principal phases are instants, not intervals, but a product must
 * still name the Moon's state at an arbitrary moment. This engine centres a
 * 45-degree band on each of the eight canonical angles, so "Full Moon" means
 * within 22.5 degrees of exact opposition — roughly a day and three quarters
 * either side. This is a presentation convention and is documented as such;
 * the exact instants remain available through `findNextPhase`.
 */
const PHASE_BAND_DEGREES = 45;

export interface LunarState {
  /** Elongation of the Moon from the Sun, [0, 360). 0 is new, 180 is full. */
  readonly phaseAngle: number;
  readonly phase: MoonPhaseName;
  /** Illuminated fraction of the disc, 0..1. */
  readonly illumination: number;
  /** Days elapsed since the preceding New Moon. */
  readonly ageDays: number;
  readonly moonLongitude: number;
  readonly sunLongitude: number;
  readonly position: ZodiacPosition;
  /** True while elongation is increasing, i.e. between new and full. */
  readonly waxing: boolean;
}

/**
 * Name the phase for a given elongation.
 *
 * The New Moon band straddles 0/360, so the comparison is done on the shortest
 * distance to each band centre rather than on raw interval containment.
 */
export function classifyMoonPhase(phaseAngle: number): MoonPhaseName {
  const angle = normalizeDegrees(phaseAngle);
  const index = Math.round(angle / PHASE_BAND_DEGREES) % MOON_PHASES.length;
  const phase = MOON_PHASES[index];
  if (phase === undefined) {
    throw new RangeError(`Could not classify phase angle ${phaseAngle}`);
  }
  return phase;
}

/** Elongation of the Moon from the Sun at an instant, [0, 360). */
export function computePhaseAngle(provider: EphemerisProvider, date: Date): number {
  const [sun, moon] = [
    provider.getBodyPosition('sun', date),
    provider.getBodyPosition('moon', date),
  ];
  return normalizeDegrees(moon.longitude - sun.longitude);
}

/**
 * Instant of the most recent New Moon at or before `date`.
 *
 * The provider only searches forward, so this starts a lunation and a half back
 * and steps forward to the last crossing that has already happened. A window of
 * 40 days is guaranteed to contain at least one New Moon.
 */
export function findPreviousNewMoon(provider: EphemerisProvider, date: Date): Date {
  const searchStart = addDays(date, -(MEAN_SYNODIC_MONTH_DAYS + 11));
  let candidate = provider.searchMoonPhase(0, searchStart, 45);
  let previous: Date | null = null;

  while (candidate !== null && candidate.getTime() <= date.getTime()) {
    previous = candidate;
    candidate = provider.searchMoonPhase(0, addDays(candidate, 1), 45);
  }

  if (previous === null) {
    throw new Error(`Could not locate a New Moon before ${date.toISOString()}`);
  }
  return previous;
}

/** Next instant at which the Moon reaches the given elongation. */
export function findNextPhase(
  provider: EphemerisProvider,
  targetPhaseAngle: number,
  from: Date,
): Date {
  const result = provider.searchMoonPhase(targetPhaseAngle, from, 45);
  if (result === null) {
    throw new Error(
      `No lunar phase at ${targetPhaseAngle} degrees found within 45 days of ${from.toISOString()}`,
    );
  }
  return result;
}

/** Complete lunar state at an instant. */
export function computeLunarState(provider: EphemerisProvider, date: Date): LunarState {
  const sun = provider.getBodyPosition('sun', date);
  const moon = provider.getBodyPosition('moon', date);
  const phaseAngle = normalizeDegrees(moon.longitude - sun.longitude);
  const previousNewMoon = findPreviousNewMoon(provider, date);

  return {
    phaseAngle,
    phase: classifyMoonPhase(phaseAngle),
    illumination: provider.getMoonIlluminatedFraction(date),
    ageDays: (date.getTime() - previousNewMoon.getTime()) / MILLISECONDS_PER_DAY,
    moonLongitude: moon.longitude,
    sunLongitude: sun.longitude,
    position: longitudeToZodiac(moon.longitude),
    waxing: phaseAngle < 180,
  };
}

export interface UpcomingLunations {
  readonly nextNewMoon: Date;
  readonly nextFirstQuarter: Date;
  readonly nextFullMoon: Date;
  readonly nextThirdQuarter: Date;
}

/** The next occurrence of each principal phase after `date`. */
export function computeUpcomingLunations(
  provider: EphemerisProvider,
  date: Date,
): UpcomingLunations {
  return {
    nextNewMoon: findNextPhase(provider, 0, date),
    nextFirstQuarter: findNextPhase(provider, 90, date),
    nextFullMoon: findNextPhase(provider, 180, date),
    nextThirdQuarter: findNextPhase(provider, 270, date),
  };
}

export interface MoonSignIngress {
  readonly sign: ZodiacPosition['sign'];
  readonly enteredAt: Date;
}

/**
 * Instant the Moon next enters a new sign.
 *
 * Found by bisection on the sign index. The Moon covers about 13 degrees a day
 * and never stations, so its longitude increases monotonically and a sign
 * boundary is crossed at most once in the three-day search window.
 */
export function findNextMoonSignIngress(
  provider: EphemerisProvider,
  from: Date,
  toleranceMs = 1000,
): MoonSignIngress {
  const startSignIndex = longitudeToZodiac(
    provider.getBodyPosition('moon', from).longitude,
  ).signIndex;

  let low = from;
  let high = addDays(from, 3);

  const changed = (at: Date): boolean =>
    longitudeToZodiac(provider.getBodyPosition('moon', at).longitude).signIndex !== startSignIndex;

  if (!changed(high)) {
    throw new Error(`Moon did not change sign within 3 days of ${from.toISOString()}`);
  }

  while (high.getTime() - low.getTime() > toleranceMs) {
    const middle = new Date((low.getTime() + high.getTime()) / 2);
    if (changed(middle)) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return {
    sign: longitudeToZodiac(provider.getBodyPosition('moon', high).longitude).sign,
    enteredAt: high,
  };
}
