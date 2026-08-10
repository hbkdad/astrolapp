/**
 * Transits: the moving sky measured against a fixed natal chart.
 *
 * IMPORTANT — on the score this module produces.
 *
 * `strength` is a PRODUCT HEURISTIC. It is a weighted combination of editorial
 * weight tables and a geometric orb measure. It is reproducible and it is
 * explainable, and it is NOT a scientific measurement of anything. Nothing in
 * this codebase, and nothing in any user-facing copy, may describe it as
 * evidence, prediction, or a measured effect. The geometry it is built on is
 * astronomical fact; the weighting is an editorial choice, and the two are kept
 * separable so the distinction survives into the UI.
 */

import { normalizeDegrees, signedAngularDifference } from '@astrolapp/shared';
import type { BodyId, EphemerisProvider } from './ephemeris/types.js';
import { DEFAULT_CHART_BODIES } from './ephemeris/types.js';
import {
  DEFAULT_ORBS,
  MAJOR_ASPECTS,
  findAspect,
  type Aspect,
  type AspectDefinition,
  type AspectType,
  type OrbConfig,
} from './aspects.js';
import type { NatalChart } from './natal.js';
import { longitudeToZodiac, type ZodiacPosition } from './zodiac.js';

/** Points in a natal chart a transit can aspect: the bodies plus the angles. */
export type NatalTarget = BodyId | 'ascendant' | 'midheaven';

/**
 * Editorial weights driving the heuristic score.
 *
 * These are product configuration, deliberately separated from the geometry so
 * they can be tuned — or replaced wholesale for a different astrological
 * tradition — without touching a single calculation. Changing any value here
 * requires bumping `ENGINE_VERSIONS.scoreModel`, or previously stored reports
 * stop being reproducible.
 */
export interface TransitScoreWeights {
  readonly transitingBody: Readonly<Partial<Record<BodyId, number>>>;
  readonly natalTarget: Readonly<Partial<Record<NatalTarget, number>>>;
  readonly aspect: Readonly<Partial<Record<AspectType, number>>>;
}

export const DEFAULT_TRANSIT_WEIGHTS: TransitScoreWeights = {
  // Slower bodies score higher: their transits last longer and traditional
  // practice treats them as more consequential.
  transitingBody: {
    sun: 1.0,
    moon: 0.6,
    mercury: 0.7,
    venus: 0.8,
    mars: 0.9,
    jupiter: 1.1,
    saturn: 1.2,
    uranus: 1.15,
    neptune: 1.1,
    pluto: 1.2,
    northNode: 0.7,
    southNode: 0.7,
  },
  // Personal points weigh more than the generational outers.
  natalTarget: {
    sun: 1.2,
    moon: 1.2,
    ascendant: 1.2,
    midheaven: 1.1,
    mercury: 0.9,
    venus: 0.9,
    mars: 0.9,
    jupiter: 0.8,
    saturn: 0.8,
    uranus: 0.6,
    neptune: 0.6,
    pluto: 0.6,
    northNode: 0.6,
    southNode: 0.6,
  },
  aspect: {
    conjunction: 1.0,
    opposition: 0.9,
    square: 0.85,
    trine: 0.8,
    sextile: 0.6,
    semisextile: 0.3,
    semisquare: 0.35,
    quintile: 0.3,
    sesquiquadrate: 0.35,
    quincunx: 0.4,
  },
};

/** A single transiting-body-to-natal-point contact. */
export interface TransitEvent {
  readonly transitingBody: BodyId;
  readonly transitingLongitude: number;
  readonly transitingPosition: ZodiacPosition;
  readonly retrograde: boolean;
  readonly natalTarget: NatalTarget;
  readonly natalLongitude: number;
  readonly aspect: Aspect;
  /** Heuristic 0..100. See the module comment before using this anywhere. */
  readonly strength: number;
  /** The factors multiplied together to reach `strength`, for transparency. */
  readonly strengthFactors: {
    readonly transitingBodyWeight: number;
    readonly natalTargetWeight: number;
    readonly aspectWeight: number;
    readonly orbStrength: number;
  };
}

export interface TransitOptions {
  readonly bodies?: readonly BodyId[];
  readonly targets?: readonly NatalTarget[];
  readonly aspects?: readonly AspectDefinition[];
  readonly orbs?: OrbConfig;
  readonly weights?: TransitScoreWeights;
}

/** Largest product the weight tables can produce, used to normalise to 0..100. */
function maximumWeightProduct(weights: TransitScoreWeights): number {
  const max = (values: readonly number[]): number =>
    values.length === 0 ? 1 : Math.max(...values);
  return (
    max(Object.values(weights.transitingBody)) *
    max(Object.values(weights.natalTarget)) *
    max(Object.values(weights.aspect))
  );
}

/** Natal longitudes for every aspectable point, bodies and angles alike. */
function natalTargetLongitudes(chart: NatalChart): Map<NatalTarget, number> {
  const longitudes = new Map<NatalTarget, number>();
  for (const placement of chart.placements) {
    longitudes.set(placement.body, placement.longitude);
  }
  longitudes.set('ascendant', chart.angles.ascendant);
  longitudes.set('midheaven', chart.angles.midheaven);
  return longitudes;
}

/**
 * All transit contacts active at an instant, strongest first.
 *
 * Natal points are treated as fixed, so only the transiting body contributes
 * motion when classifying applying versus separating.
 */
export function computeTransits(
  provider: EphemerisProvider,
  chart: NatalChart,
  date: Date,
  options: TransitOptions = {},
): TransitEvent[] {
  const {
    bodies = DEFAULT_CHART_BODIES,
    aspects: aspectDefinitions = MAJOR_ASPECTS,
    orbs = DEFAULT_ORBS,
    weights = DEFAULT_TRANSIT_WEIGHTS,
  } = options;

  const targetLongitudes = natalTargetLongitudes(chart);
  const targets = options.targets ?? [...targetLongitudes.keys()];
  const normaliser = maximumWeightProduct(weights);
  const events: TransitEvent[] = [];

  for (const position of provider.getBodyPositions(bodies, date)) {
    for (const target of targets) {
      const natalLongitude = targetLongitudes.get(target);
      if (natalLongitude === undefined) continue;

      const aspect = findAspect(position.longitude, natalLongitude, {
        aspects: aspectDefinitions,
        orbs,
        // The natal point does not move, so its speed is zero by definition.
        speeds: { a: position.longitudeSpeed, b: 0 },
      });
      if (aspect === null) continue;

      const transitingBodyWeight = weights.transitingBody[position.body] ?? 0;
      const natalTargetWeight = weights.natalTarget[target] ?? 0;
      const aspectWeight = weights.aspect[aspect.type] ?? 0;
      const orbStrength = aspect.normalizedStrength;

      const raw = transitingBodyWeight * natalTargetWeight * aspectWeight * orbStrength;

      events.push({
        transitingBody: position.body,
        transitingLongitude: position.longitude,
        transitingPosition: longitudeToZodiac(position.longitude),
        retrograde: position.retrograde,
        natalTarget: target,
        natalLongitude,
        aspect,
        strength: normaliser === 0 ? 0 : Math.round((raw / normaliser) * 1000) / 10,
        strengthFactors: { transitingBodyWeight, natalTargetWeight, aspectWeight, orbStrength },
      });
    }
  }

  return events.sort((left, right) => right.strength - left.strength);
}

/**
 * Signed distance from exactness for a transiting body against a fixed point.
 *
 * Returns a value that passes through zero when the aspect perfects, which is
 * what makes bisection possible. The unsigned orb has a V shape at exactness
 * and would defeat a sign-change search.
 */
function signedOrbAt(
  provider: EphemerisProvider,
  body: BodyId,
  natalLongitude: number,
  target: number,
  at: Date,
): number {
  const longitude = provider.getBodyPosition(body, at).longitude;
  return signedAngularDifference(normalizeDegrees(longitude - natalLongitude), target);
}

export interface TransitWindow {
  /** When the aspect first came within orb, or null if not found in range. */
  readonly enteredOrb: Date | null;
  /** When the aspect is exact, or null if it does not perfect in range. */
  readonly exact: Date | null;
  /** When the aspect leaves orb, or null if not found in range. */
  readonly leftOrb: Date | null;
}

/**
 * Locate the exact moment and the orb window of a transit.
 *
 * Scans the search range on a coarse step looking for a sign change in the
 * signed orb, then bisects to the requested precision. A coarse step is
 * necessary because retrograde motion lets a slow planet perfect the same
 * aspect three times, and a naive monotonic search would find only the first.
 *
 * Returns the first perfection at or after `from`.
 */
export function findTransitWindow(
  provider: EphemerisProvider,
  body: BodyId,
  natalLongitude: number,
  aspect: AspectDefinition,
  from: Date,
  to: Date,
  options: { readonly maxOrb?: number; readonly stepHours?: number } = {},
): TransitWindow {
  const maxOrb = options.maxOrb ?? DEFAULT_ORBS[aspect.type] ?? 1;
  const stepMs = (options.stepHours ?? 6) * 3_600_000;

  // A body can aspect a point from either side; pick the branch it is nearest.
  const startDelta = normalizeDegrees(
    provider.getBodyPosition(body, from).longitude - natalLongitude,
  );
  const target =
    Math.abs(signedAngularDifference(startDelta, aspect.exactAngle)) <=
    Math.abs(signedAngularDifference(startDelta, -aspect.exactAngle))
      ? aspect.exactAngle
      : -aspect.exactAngle;

  const orbAt = (at: Date): number => signedOrbAt(provider, body, natalLongitude, target, at);

  let exact: Date | null = null;
  let enteredOrb: Date | null = null;
  let leftOrb: Date | null = null;

  let previousTime = from.getTime();
  let previousOrb = orbAt(from);
  let wasInOrb = Math.abs(previousOrb) <= maxOrb;
  if (wasInOrb) enteredOrb = from;

  for (let time = previousTime + stepMs; time <= to.getTime(); time += stepMs) {
    const current = new Date(time);
    const currentOrb = orbAt(current);
    const isInOrb = Math.abs(currentOrb) <= maxOrb;

    if (!wasInOrb && isInOrb && enteredOrb === null) {
      enteredOrb = bisect(orbAt, new Date(previousTime), current, (o) => Math.abs(o) <= maxOrb);
    }
    if (wasInOrb && !isInOrb && leftOrb === null) {
      leftOrb = bisect(orbAt, new Date(previousTime), current, (o) => Math.abs(o) > maxOrb);
    }

    // A sign change means the aspect perfected somewhere in this step. The
    // magnitude guard rejects the wrap between +180 and -180, which is a jump
    // rather than a crossing.
    if (exact === null && Math.sign(currentOrb) !== Math.sign(previousOrb)) {
      if (Math.abs(currentOrb) < 90 && Math.abs(previousOrb) < 90) {
        exact = bisectZero(orbAt, new Date(previousTime), current);
      }
    }

    previousTime = time;
    previousOrb = currentOrb;
    wasInOrb = isInOrb;
  }

  return { enteredOrb, exact, leftOrb };
}

const BISECTION_TOLERANCE_MS = 60_000;

/** Bisect to the first instant where `predicate` holds, to the minute. */
function bisect(
  valueAt: (at: Date) => number,
  low: Date,
  high: Date,
  predicate: (value: number) => boolean,
): Date {
  let lowTime = low.getTime();
  let highTime = high.getTime();

  while (highTime - lowTime > BISECTION_TOLERANCE_MS) {
    const middleTime = Math.floor((lowTime + highTime) / 2);
    if (predicate(valueAt(new Date(middleTime)))) {
      highTime = middleTime;
    } else {
      lowTime = middleTime;
    }
  }
  return new Date(highTime);
}

/** Bisect a sign change to the zero crossing, to the minute. */
function bisectZero(valueAt: (at: Date) => number, low: Date, high: Date): Date {
  let lowTime = low.getTime();
  let highTime = high.getTime();
  const lowSign = Math.sign(valueAt(low));

  while (highTime - lowTime > BISECTION_TOLERANCE_MS) {
    const middleTime = Math.floor((lowTime + highTime) / 2);
    if (Math.sign(valueAt(new Date(middleTime))) === lowSign) {
      lowTime = middleTime;
    } else {
      highTime = middleTime;
    }
  }
  return new Date(highTime);
}
