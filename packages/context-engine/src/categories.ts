/**
 * Category scoring.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * The numbers this module produces ("Career 84") are PRODUCT HEURISTICS. They
 * are built from two ingredients:
 *
 *   1. Transit geometry — astronomical fact, computed elsewhere and verified.
 *   2. Affinity and valence tables below — editorial judgement, nothing more.
 *
 * Ingredient 2 is not measured, not researched, and not validated against any
 * outcome. It is a defensible reading of astrological tradition and no more than
 * that. Every score therefore ships with the individual contributions that
 * produced it, so the product can always answer "why is this 84?".
 *
 * See docs/ADR/0003-scores-are-heuristics.md.
 */

import type { BodyId, NatalTarget, TransitEvent } from '@astrolapp/astro-engine';

export const CATEGORIES = [
  'love',
  'career',
  'finance',
  'energy',
  'communication',
  'creativity',
  'personalGrowth',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** How strongly a point relates to a life area, 0..1. Absent means unrelated. */
export type AffinityTable = Readonly<Partial<Record<Category, number>>>;

/**
 * Topical affinity of each transiting body.
 *
 * Loosely follows traditional planetary significations: Venus with affection and
 * value, Mercury with exchange of information, Mars with drive, Saturn with
 * structure and obligation, and so on.
 */
export const TRANSITING_BODY_AFFINITY: Readonly<Partial<Record<BodyId, AffinityTable>>> = {
  sun: { energy: 0.6, career: 0.5, personalGrowth: 0.4, creativity: 0.3 },
  moon: { love: 0.4, energy: 0.4, personalGrowth: 0.4, communication: 0.2 },
  mercury: { communication: 0.9, career: 0.4, creativity: 0.3 },
  venus: { love: 0.9, finance: 0.5, creativity: 0.5 },
  mars: { energy: 0.9, career: 0.4, love: 0.3 },
  jupiter: { finance: 0.7, career: 0.6, personalGrowth: 0.6, love: 0.3 },
  saturn: { career: 0.7, finance: 0.5, personalGrowth: 0.5 },
  uranus: { creativity: 0.6, personalGrowth: 0.5, career: 0.3 },
  neptune: { creativity: 0.7, personalGrowth: 0.5, love: 0.3 },
  pluto: { personalGrowth: 0.8, career: 0.3, finance: 0.3 },
  northNode: { personalGrowth: 0.5, career: 0.3 },
  southNode: { personalGrowth: 0.5 },
};

/** Topical affinity of the natal point being contacted. */
export const NATAL_TARGET_AFFINITY: Readonly<Partial<Record<NatalTarget, AffinityTable>>> = {
  sun: { energy: 0.6, career: 0.5, personalGrowth: 0.5 },
  moon: { love: 0.6, personalGrowth: 0.5, energy: 0.3 },
  mercury: { communication: 0.9, career: 0.3 },
  venus: { love: 0.9, finance: 0.5, creativity: 0.4 },
  mars: { energy: 0.8, career: 0.4 },
  jupiter: { finance: 0.6, career: 0.5, personalGrowth: 0.5 },
  saturn: { career: 0.7, finance: 0.4, personalGrowth: 0.4 },
  uranus: { creativity: 0.5, personalGrowth: 0.4 },
  neptune: { creativity: 0.6, personalGrowth: 0.4 },
  pluto: { personalGrowth: 0.7 },
  ascendant: { energy: 0.6, personalGrowth: 0.5, love: 0.3 },
  midheaven: { career: 0.9, finance: 0.4 },
  northNode: { personalGrowth: 0.5 },
  southNode: { personalGrowth: 0.5 },
};

/**
 * Whether an aspect reads as supportive or difficult, -1..+1.
 *
 * Conjunctions are deliberately absent: a conjunction takes on the character of
 * the body making it, so it is resolved through `CONJUNCTION_VALENCE` instead.
 */
export const ASPECT_VALENCE: Readonly<Record<string, number>> = {
  trine: 1,
  sextile: 0.7,
  square: -0.8,
  opposition: -0.7,
  semisextile: 0.3,
  quintile: 0.5,
  semisquare: -0.4,
  sesquiquadrate: -0.4,
  quincunx: -0.3,
};

/**
 * Valence of a conjunction, by the body making it.
 *
 * Follows the traditional benefic/malefic distinction. Jupiter and Venus read as
 * easy; Saturn, Mars and Pluto as demanding. This is tradition, not a claim
 * about outcomes.
 */
export const CONJUNCTION_VALENCE: Readonly<Partial<Record<BodyId, number>>> = {
  sun: 0.3,
  moon: 0.2,
  mercury: 0.2,
  venus: 0.8,
  mars: -0.4,
  jupiter: 0.8,
  saturn: -0.6,
  uranus: -0.2,
  neptune: -0.1,
  pluto: -0.4,
  northNode: 0.3,
  southNode: -0.3,
};

/** One transit's contribution to one category score. */
export interface CategoryContribution {
  /** Interpretation key for the underlying event, e.g. `transit.mars.square.sun`. */
  readonly key: string;
  readonly label: string;
  /** Signed contribution to the category's valence. */
  readonly contribution: number;
  /** Unsigned relevance, used for confidence. */
  readonly relevance: number;
}

export interface CategoryScore {
  readonly category: Category;
  /** 0..100, where 50 is neutral. */
  readonly score: number;
  /** Raw signed total before the score curve. Retained for transparency. */
  readonly valence: number;
  /**
   * 0..1 — how much relevant evidence exists. A score of 50 with confidence
   * 0.05 means "nothing much is happening here", not "conflicting influences".
   * The UI must be able to tell those apart.
   */
  readonly confidence: number;
  /** Every event that moved this score, strongest first. */
  readonly contributions: readonly CategoryContribution[];
}

/**
 * Shape of the valence-to-score curve.
 *
 * `tanh` is used because it is monotonic, symmetric about neutral, bounded, and
 * saturating — twenty mild supportive transits should not read as more
 * significant than a handful of strong ones.
 *
 * `VALENCE_SCALE` sets the dynamic range, and it matters more than it looks.
 * Typical net valence for a real day is around 0.2-0.6, because affinity
 * products are usually well under 1 and orb strength rarely approaches it. A
 * scale of 1.5 mapped almost every day into 45-55, so every category read
 * "mixed" and the number told the user nothing. At 0.6 an ordinary day spreads
 * across roughly 25-75 while genuinely quiet categories still sit at 50.
 *
 * This is a DISPLAY calibration, chosen so the scale is legible. It is not
 * evidence about anything, and real calibration would need outcome data the
 * product does not have. `scoreCategories` spread is asserted in
 * `context.test.ts` so a future weight change cannot silently flatten it again.
 */
const VALENCE_SCALE = 0.6;
const CONFIDENCE_SCALE = 0.8;

export function valenceOf(event: TransitEvent): number {
  if (event.aspect.type === 'conjunction') {
    return CONJUNCTION_VALENCE[event.transitingBody] ?? 0;
  }
  return ASPECT_VALENCE[event.aspect.type] ?? 0;
}

/** Interpretation key for a transit event. */
export function transitKey(event: TransitEvent): string {
  return `transit.${event.transitingBody}.${event.aspect.type}.${event.natalTarget}`;
}

function readableLabel(event: TransitEvent): string {
  return `${event.transitingBody} ${event.aspect.type} natal ${event.natalTarget}`;
}

/**
 * Score every category from a set of transit events.
 *
 * A category with no relevant transits scores exactly 50 with confidence 0 —
 * genuinely neutral, rather than zero, which would read to a user as "terrible"
 * when it actually means "nothing to report".
 */
export function scoreCategories(events: readonly TransitEvent[]): Record<Category, CategoryScore> {
  const accumulator = new Map<
    Category,
    { valence: number; relevance: number; contributions: CategoryContribution[] }
  >();
  for (const category of CATEGORIES) {
    accumulator.set(category, { valence: 0, relevance: 0, contributions: [] });
  }

  for (const event of events) {
    const bodyAffinity = TRANSITING_BODY_AFFINITY[event.transitingBody] ?? {};
    const targetAffinity = NATAL_TARGET_AFFINITY[event.natalTarget] ?? {};
    const valence = valenceOf(event);
    // Strength is already 0..100 and already folds in orb and editorial weights.
    const magnitude = event.strength / 100;

    for (const category of CATEGORIES) {
      const affinity = (bodyAffinity[category] ?? 0) * (targetAffinity[category] ?? 0);
      if (affinity === 0) continue;

      const relevance = magnitude * affinity;
      const contribution = relevance * valence;
      if (relevance === 0) continue;

      const bucket = accumulator.get(category);
      if (bucket === undefined) continue;

      bucket.valence += contribution;
      bucket.relevance += relevance;
      bucket.contributions.push({
        key: transitKey(event),
        label: readableLabel(event),
        contribution,
        relevance,
      });
    }
  }

  const result = {} as Record<Category, CategoryScore>;
  for (const category of CATEGORIES) {
    const bucket = accumulator.get(category) ?? { valence: 0, relevance: 0, contributions: [] };
    result[category] = {
      category,
      score: Math.round((50 + 50 * Math.tanh(bucket.valence / VALENCE_SCALE)) * 10) / 10,
      valence: bucket.valence,
      confidence: Math.round((1 - Math.exp(-bucket.relevance / CONFIDENCE_SCALE)) * 1000) / 1000,
      contributions: [...bucket.contributions].sort(
        (left, right) => Math.abs(right.contribution) - Math.abs(left.contribution),
      ),
    };
  }
  return result;
}

/**
 * Aggregate supportive and demanding pressure across all events.
 *
 * These are deliberately not categories: they describe the character of the day
 * rather than a life area, and a day can be high in both at once.
 */
export function computeValenceTotals(events: readonly TransitEvent[]): {
  opportunity: number;
  friction: number;
} {
  let opportunity = 0;
  let friction = 0;

  for (const event of events) {
    const valence = valenceOf(event);
    const magnitude = event.strength / 100;
    if (valence > 0) opportunity += valence * magnitude;
    if (valence < 0) friction += -valence * magnitude;
  }

  const curve = (total: number): number =>
    Math.round(100 * (1 - Math.exp(-total / CONFIDENCE_SCALE)) * 10) / 10;

  return { opportunity: curve(opportunity), friction: curve(friction) };
}
