/**
 * Deterministic daily reading.
 *
 * This is the complete product experience with the AI layer switched OFF. It is
 * not a placeholder or a degraded mode: if the language model is unavailable,
 * rate-limited, or deliberately disabled, this is what users get, and it must
 * stand on its own.
 *
 * Building it first also fixes the data contract. The AI layer rewrites this
 * material into better prose; it never introduces material of its own.
 */

import type { DailyContext, Category, CategoryScore } from '@astrolapp/context-engine';
import { CATEGORIES } from '@astrolapp/context-engine';
import { lunationFact } from './facts.js';
import {
  interpretMoonPhase,
  interpretMoonSign,
  interpretNumerologyValue,
  interpretTransit,
} from './interpret.js';
import type { Interpretation } from './types.js';

/**
 * Standing framing shown with every reading.
 *
 * Required, not optional. The product presents an interpretive tradition, and
 * saying so plainly is a condition of presenting it at all.
 */
export const READING_DISCLAIMER =
  'Astrology and numerology are interpretive traditions, not established science. ' +
  'The astronomical positions behind this reading are calculated and verifiable; ' +
  'the meanings drawn from them are traditional interpretations. Scores are ' +
  'product heuristics, not measurements. Nothing here is medical, financial, ' +
  'legal or safety advice.';

/** Plain-language band for a 0-100 score, so meaning is never colour-only. */
export function describeScore(score: number): string {
  if (score >= 75) return 'strongly supported';
  if (score >= 60) return 'supported';
  if (score > 40) return 'mixed';
  if (score > 25) return 'demanding';
  return 'strongly demanding';
}

/** Plain-language band for confidence. */
export function describeConfidence(confidence: number): string {
  if (confidence >= 0.6) return 'several significant contacts';
  if (confidence >= 0.3) return 'a few relevant contacts';
  if (confidence > 0.05) return 'little relevant activity';
  return 'no relevant activity';
}

export interface CategoryReading {
  readonly category: Category;
  readonly score: number;
  /** Text equivalent of the score, so meaning never depends on colour alone. */
  readonly band: string;
  readonly confidence: number;
  readonly confidenceLabel: string;
  /** Why this score is what it is, in plain language. */
  readonly explanation: string;
}

export interface DailyReading {
  readonly date: string;
  readonly instant: string;
  readonly headline: string;
  readonly summary: string;
  readonly overall: number;
  readonly overallBand: string;
  readonly categories: readonly CategoryReading[];
  readonly strongestTransit: Interpretation | null;
  readonly transits: readonly Interpretation[];
  readonly moonPhase: Interpretation;
  readonly moonSign: Interpretation;
  readonly upcomingLunations: readonly string[];
  readonly numerology: readonly Interpretation[];
  readonly disclaimer: string;
  readonly metadata: DailyContext['metadata'];
}

/**
 * Category keys are camelCase identifiers; user-facing text needs words.
 *
 * `personalGrowth` must never reach a reader as-is.
 */
export function humaniseCategory(category: Category): string {
  return category.replace(/([A-Z])/g, ' $1').toLowerCase();
}

function explainCategory(score: CategoryScore): string {
  if (score.contributions.length === 0) {
    return `No transits currently contact the points associated with ${score.category}, so this sits at neutral.`;
  }

  const top = score.contributions.slice(0, 3).map((contribution) => {
    const direction = contribution.contribution >= 0 ? 'supporting' : 'challenging';
    return `${contribution.label} (${direction})`;
  });

  return `Based on ${describeConfidence(score.confidence)}: ${top.join('; ')}.`;
}

/**
 * Headline drawn from the strongest signal.
 *
 * Deterministic: the same context always yields the same headline, which keeps
 * cached readings stable and makes the output testable.
 */
function buildHeadline(context: DailyContext, strongest: Interpretation | null): string {
  if (strongest !== null) {
    return strongest.title;
  }
  const phase = context.moon.phase.replace(/-/g, ' ');
  return `A quiet day — ${phase} in ${context.moon.position.sign}`;
}

function buildSummary(context: DailyContext, categories: readonly CategoryReading[]): string {
  const ranked = [...categories].sort((left, right) => right.confidence - left.confidence);
  const notable = ranked.filter((category) => category.confidence > 0.15).slice(0, 3);

  const overallSentence = `Overall the day reads as ${describeScore(context.overall)}.`;

  if (notable.length === 0) {
    return (
      `${overallSentence} No transit is currently within orb of a significant natal point, ` +
      `so the astrological picture is quiet.`
    );
  }

  const parts = notable.map(
    (category) => `${humaniseCategory(category.category)} (${category.band})`,
  );
  return `${overallSentence} The most active areas are ${parts.join(', ')}.`;
}

/**
 * Assemble the complete deterministic reading.
 *
 * Pure with respect to its input: the same `DailyContext` always produces the
 * same reading, which is what allows readings to be cached and reproduced.
 */
export function buildDailyReading(context: DailyContext): DailyReading {
  const transits = context.transits.map(interpretTransit);
  const strongestTransit = transits.at(0) ?? null;

  const categories: CategoryReading[] = CATEGORIES.map((category) => {
    const score = context.categories[category];
    return {
      category,
      score: score.score,
      band: describeScore(score.score),
      confidence: score.confidence,
      confidenceLabel: describeConfidence(score.confidence),
      explanation: explainCategory(score),
    };
  });

  const numerology: Interpretation[] =
    context.numerology === null
      ? []
      : [
          interpretNumerologyValue('life-path', context.numerology.profile.lifePath),
          interpretNumerologyValue('personal-year', context.numerology.cycles.personalYear),
          interpretNumerologyValue('personal-month', context.numerology.cycles.personalMonth),
          interpretNumerologyValue('personal-day', context.numerology.cycles.personalDay),
        ];

  return {
    date: context.date,
    instant: context.instant,
    headline: buildHeadline(context, strongestTransit),
    summary: buildSummary(context, categories),
    overall: context.overall,
    overallBand: describeScore(context.overall),
    categories,
    strongestTransit,
    transits,
    moonPhase: interpretMoonPhase(context.moon),
    moonSign: interpretMoonSign(context.moon),
    upcomingLunations: [
      lunationFact('The next New Moon', context.upcomingLunations.nextNewMoon),
      lunationFact('The next Full Moon', context.upcomingLunations.nextFullMoon),
    ],
    numerology,
    disclaimer: READING_DISCLAIMER,
    metadata: context.metadata,
  };
}
