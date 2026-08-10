/**
 * Aspect detection.
 *
 * This module answers one question: given two ecliptic longitudes, do they form
 * a recognised angular relationship, and how exact is it?
 *
 * It returns structured data only. No interpretation text appears here, and no
 * function in this file knows what a "Mars square Sun" is supposed to mean.
 * Interpretation is keyed off these results downstream.
 */

import { angularSeparation } from '@astrolapp/shared';

export type AspectType =
  | 'conjunction'
  | 'sextile'
  | 'square'
  | 'trine'
  | 'opposition'
  | 'semisextile'
  | 'semisquare'
  | 'quintile'
  | 'sesquiquadrate'
  | 'quincunx';

export interface AspectDefinition {
  readonly type: AspectType;
  /** The exact angular separation that defines this aspect, in degrees. */
  readonly exactAngle: number;
  /** Whether this is one of the five classical major aspects. */
  readonly major: boolean;
  /**
   * Traditional valence. Advisory metadata for the interpretation layer only;
   * nothing in the calculation path branches on it.
   */
  readonly nature: 'harmonious' | 'challenging' | 'neutral';
}

/** The five major aspects, active by default. */
export const MAJOR_ASPECTS: readonly AspectDefinition[] = [
  { type: 'conjunction', exactAngle: 0, major: true, nature: 'neutral' },
  { type: 'sextile', exactAngle: 60, major: true, nature: 'harmonious' },
  { type: 'square', exactAngle: 90, major: true, nature: 'challenging' },
  { type: 'trine', exactAngle: 120, major: true, nature: 'harmonious' },
  { type: 'opposition', exactAngle: 180, major: true, nature: 'challenging' },
];

/** Minor aspects, opt-in. Not included in `MAJOR_ASPECTS`. */
export const MINOR_ASPECTS: readonly AspectDefinition[] = [
  { type: 'semisextile', exactAngle: 30, major: false, nature: 'neutral' },
  { type: 'semisquare', exactAngle: 45, major: false, nature: 'challenging' },
  { type: 'quintile', exactAngle: 72, major: false, nature: 'harmonious' },
  { type: 'sesquiquadrate', exactAngle: 135, major: false, nature: 'challenging' },
  { type: 'quincunx', exactAngle: 150, major: false, nature: 'challenging' },
];

export const ALL_ASPECTS: readonly AspectDefinition[] = [...MAJOR_ASPECTS, ...MINOR_ASPECTS];

/**
 * Maximum orb per aspect type, in degrees.
 *
 * Orbs are a convention, not a fact — different traditions and different
 * products use different values. They live in configuration so a product
 * decision never requires an engine change.
 */
export type OrbConfig = Readonly<Partial<Record<AspectType, number>>>;

export const DEFAULT_ORBS: OrbConfig = {
  conjunction: 8,
  sextile: 5,
  square: 7,
  trine: 7,
  opposition: 8,
  semisextile: 2,
  semisquare: 2,
  quintile: 2,
  sesquiquadrate: 2,
  quincunx: 3,
};

/**
 * Whether the aspect is closing toward exactness or moving away from it.
 *
 * `unknown` is returned when relative motion is too slow to call — near a
 * station the direction genuinely is indeterminate, and guessing would be worse
 * than admitting it.
 */
export type AspectPhase = 'applying' | 'separating' | 'unknown';

export interface Aspect {
  readonly type: AspectType;
  /** The defining angle, e.g. 90 for a square. */
  readonly exactAngle: number;
  /** The actual angular separation of the two bodies, in [0, 180]. */
  readonly actualAngle: number;
  /** Distance from exactness in degrees: `|actualAngle - exactAngle|`. */
  readonly orb: number;
  /** The maximum orb that was allowed for this aspect. */
  readonly maxOrb: number;
  /** 1 at exact, falling linearly to 0 at the orb limit. */
  readonly normalizedStrength: number;
  readonly phase: AspectPhase;
  readonly nature: AspectDefinition['nature'];
  readonly major: boolean;
}

export interface FindAspectOptions {
  /** Which aspects to test for. Defaults to the five majors. */
  readonly aspects?: readonly AspectDefinition[];
  /** Orb limits by aspect type. Defaults to `DEFAULT_ORBS`. */
  readonly orbs?: OrbConfig;
  /**
   * Longitude speeds in degrees/day, used to classify applying vs separating.
   * Omit when speeds are unknown; `phase` is then `unknown`.
   */
  readonly speeds?: { readonly a: number; readonly b: number };
}

/**
 * Relative speed below which applying/separating is not asserted, in deg/day.
 *
 * Chosen so that a body within a few hours of station reports `unknown` rather
 * than a direction that will reverse before the aspect perfects.
 */
const STATIONARY_THRESHOLD_DEG_PER_DAY = 1e-4;

/**
 * Strongest aspect between two longitudes, or null if none is within orb.
 *
 * When several aspects could match (possible with wide orbs and close exact
 * angles, e.g. a 2-degree semisextile orb against an 8-degree conjunction orb),
 * the tightest orb wins.
 */
export function findAspect(
  longitudeA: number,
  longitudeB: number,
  options: FindAspectOptions = {},
): Aspect | null {
  const definitions = options.aspects ?? MAJOR_ASPECTS;
  const orbs = options.orbs ?? DEFAULT_ORBS;
  const separation = angularSeparation(longitudeA, longitudeB);

  let best: Aspect | null = null;

  for (const definition of definitions) {
    const maxOrb = orbs[definition.type];
    if (maxOrb === undefined || maxOrb <= 0) continue;

    const orb = Math.abs(separation - definition.exactAngle);
    if (orb > maxOrb) continue;

    const candidate: Aspect = {
      type: definition.type,
      exactAngle: definition.exactAngle,
      actualAngle: separation,
      orb,
      maxOrb,
      normalizedStrength: Math.max(0, 1 - orb / maxOrb),
      phase: classifyPhase(longitudeA, longitudeB, definition.exactAngle, options.speeds),
      nature: definition.nature,
      major: definition.major,
    };

    if (best === null || candidate.orb < best.orb) {
      best = candidate;
    }
  }

  return best;
}

/**
 * Decide whether an aspect is closing or opening.
 *
 * Rather than reasoning about which body is faster and on which side of exact
 * it sits — a case analysis that is easy to get subtly wrong across the 0/360
 * boundary — this projects both bodies forward by a small step and asks whether
 * the orb got smaller. That is the definition of applying, computed directly.
 */
function classifyPhase(
  longitudeA: number,
  longitudeB: number,
  exactAngle: number,
  speeds: FindAspectOptions['speeds'],
): AspectPhase {
  if (speeds === undefined) return 'unknown';

  const relativeSpeed = speeds.a - speeds.b;
  if (Math.abs(relativeSpeed) < STATIONARY_THRESHOLD_DEG_PER_DAY) return 'unknown';

  const stepDays = 0.01;
  const currentOrb = Math.abs(angularSeparation(longitudeA, longitudeB) - exactAngle);
  const futureOrb = Math.abs(
    angularSeparation(longitudeA + speeds.a * stepDays, longitudeB + speeds.b * stepDays) -
      exactAngle,
  );

  if (futureOrb === currentOrb) return 'unknown';
  return futureOrb < currentOrb ? 'applying' : 'separating';
}

/** Every aspect within orb, tightest first. Useful for diagnostics and tests. */
export function findAllAspects(
  longitudeA: number,
  longitudeB: number,
  options: FindAspectOptions = {},
): Aspect[] {
  const definitions = options.aspects ?? MAJOR_ASPECTS;
  const found: Aspect[] = [];

  for (const definition of definitions) {
    const aspect = findAspect(longitudeA, longitudeB, { ...options, aspects: [definition] });
    if (aspect !== null) found.push(aspect);
  }

  return found.sort((left, right) => left.orb - right.orb);
}
