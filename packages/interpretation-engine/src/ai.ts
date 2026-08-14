/**
 * The optional AI language layer.
 *
 * The model's ONLY job is to rewrite already-computed material into better
 * prose. It receives facts and traditional readings that have already been
 * derived and verified, and it must not add astronomical or numerological
 * content of its own.
 *
 * That rule is not left to the prompt. Model output is schema-validated and then
 * screened by `findUnsupportedClaims`, which rejects two specific failure modes:
 *
 *   1. FABRICATED ASTRONOMY — a model that writes "Mars sits at 12° Leo" has
 *      invented a position. Every real degree, orb and phase figure already
 *      exists in the `fact` fields, so numeric astronomical claims appearing in
 *      generated prose are, by construction, made up.
 *   2. OVERCLAIMING — certainty language, or medical, financial, legal and
 *      safety direction, which this product must never produce regardless of
 *      where the text came from.
 *
 * A rejected response is discarded and the deterministic reading is used
 * instead. The product never degrades below `buildDailyReading`.
 */

import type { DailyContext } from '@astrolapp/context-engine';
import type { DailyReading } from './reading.js';

/**
 * The payload sent to the model.
 *
 * Contains prepared facts and interpretations only. Notably it carries no birth
 * date, birth time, birth location or name — the model does not need identifying
 * data to rewrite a reading, so it is not sent.
 */
export interface AiReadingInput {
  readonly date: string;
  readonly overall: number;
  readonly overallBand: string;
  readonly categories: readonly {
    readonly category: string;
    readonly score: number;
    readonly band: string;
    readonly explanation: string;
  }[];
  readonly signals: readonly {
    readonly title: string;
    readonly fact: string;
    readonly interpretation: string;
    readonly tone: string;
  }[];
  readonly moon: { readonly fact: string; readonly interpretation: string };
  /**
   * Numerology values only — deliberately NOT the derivation trace.
   *
   * A numerology `fact` string spells out its own arithmetic, and that
   * arithmetic contains the birth date ("Year: 1990 → 19 → 10 → 1"). Sending it
   * would hand the model the user's date of birth to write a sentence that only
   * needs the resulting number. Many birth dates reduce to the same value, so
   * the value alone is not reversible.
   */
  readonly numerology: readonly { readonly title: string; readonly value: number }[];
  readonly instructions: string;
}

export const AI_INSTRUCTIONS =
  'Rewrite the supplied material as a short, warm, plain-spoken daily reading. ' +
  'Use ONLY the facts and interpretations provided. Do not state any planetary ' +
  'position, degree, orb, phase percentage or numerology value that is not ' +
  'already present in the input. Do not predict specific events. Do not give ' +
  'medical, financial, legal or safety advice. Frame astrological meaning as ' +
  'traditional interpretation rather than as fact about the world.';

/**
 * Numerology value from its interpretation key, e.g. `numerology.life-path.3`.
 *
 * Reading the value off the key avoids re-deriving it from birth data here.
 */
function numerologyValueOf(key: string): number {
  const parsed = Number(key.slice(key.lastIndexOf('.') + 1));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Build the model payload from a deterministic reading. */
export function buildAiReadingInput(reading: DailyReading): AiReadingInput {
  const signals = [
    ...(reading.strongestTransit === null ? [] : [reading.strongestTransit]),
    ...reading.transits.slice(1, 4),
  ].map((interpretation) => ({
    title: interpretation.title,
    fact: interpretation.fact,
    interpretation: interpretation.interpretation,
    tone: interpretation.tone,
  }));

  return {
    date: reading.date,
    overall: reading.overall,
    overallBand: reading.overallBand,
    categories: reading.categories.map((category) => ({
      category: category.category,
      score: category.score,
      band: category.band,
      explanation: category.explanation,
    })),
    signals,
    moon: {
      fact: reading.moonPhase.fact,
      interpretation: reading.moonPhase.interpretation,
    },
    numerology: reading.numerology.map((entry) => ({
      title: entry.title,
      value: numerologyValueOf(entry.key),
    })),
    instructions: AI_INSTRUCTIONS,
  };
}

/** Expected model output. */
export interface AiReading {
  readonly headline: string;
  readonly summary: string;
  readonly opportunity: string;
  readonly caution: string;
  readonly reflection: string;
  readonly categoryNotes: Readonly<Record<string, string>>;
}

export type AiValidationResult =
  | { readonly ok: true; readonly value: AiReading }
  | { readonly ok: false; readonly errors: readonly string[] };

const REQUIRED_STRING_FIELDS = [
  'headline',
  'summary',
  'opportunity',
  'caution',
  'reflection',
] as const;

/** Longest acceptable value for any single generated field. */
const MAX_FIELD_LENGTH = 2000;

/**
 * Patterns indicating the model invented astronomical detail.
 *
 * Degrees, orbs and illumination percentages are all computed upstream and
 * appear in the `fact` strings. Their appearance in *generated* prose means the
 * model produced a number rather than restating one.
 */
const FABRICATED_ASTRONOMY_PATTERNS: readonly { pattern: RegExp; description: string }[] = [
  { pattern: /\d+\s*°/u, description: 'a degree figure' },
  { pattern: /\borb\s+of\b/iu, description: 'an orb claim' },
  {
    pattern: /\b\d+(?:\.\d+)?\s*%\s*(?:illuminat|full|lit)/iu,
    description: 'an illumination figure',
  },
  { pattern: /\b\d+(?:\.\d+)?\s*degrees\b/iu, description: 'a degree figure' },
];

/**
 * Phrases that overclaim.
 *
 * Certainty language and high-stakes direction are prohibited in user-facing
 * output regardless of provenance.
 */
const OVERCLAIM_PATTERNS: readonly { pattern: RegExp; description: string }[] = [
  { pattern: /\bwill definitely\b/iu, description: 'a certainty claim' },
  { pattern: /\b(?:is|are) guaranteed\b/iu, description: 'a certainty claim' },
  { pattern: /\bwill certainly\b/iu, description: 'a certainty claim' },
  { pattern: /\byou should invest\b/iu, description: 'financial advice' },
  { pattern: /\b(?:buy|sell)\s+(?:stocks?|shares?|crypto)/iu, description: 'financial advice' },
  { pattern: /\bstop taking\b/iu, description: 'medical advice' },
  { pattern: /\b(?:see|consult) a doctor because\b/iu, description: 'medical advice' },
  {
    pattern: /\byour relationship will (?:fail|end)\b/iu,
    description: 'a prediction about a relationship',
  },
  { pattern: /\bscientifically proven\b/iu, description: 'a false claim of scientific support' },
  { pattern: /\bproves that\b/iu, description: 'a false claim of proof' },
];

/**
 * Screen generated prose for unsupported claims.
 *
 * Exported so the same screen can be applied to hand-written content in tests —
 * the rules are about what users may be shown, not about who wrote it.
 */
export function findUnsupportedClaims(text: string): string[] {
  const problems: string[] = [];

  for (const { pattern, description } of FABRICATED_ASTRONOMY_PATTERNS) {
    if (pattern.test(text)) problems.push(`contains ${description} not present in the source data`);
  }
  for (const { pattern, description } of OVERCLAIM_PATTERNS) {
    if (pattern.test(text)) problems.push(`contains ${description}`);
  }

  return problems;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a model response.
 *
 * Structural validation first, then the claim screen. Anything that fails is
 * rejected outright; there is no partial acceptance, because a response that
 * fabricated one figure cannot be trusted on the others.
 */
export function validateAiReading(raw: unknown): AiValidationResult {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: ['response is not an object'] };
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = raw[field];
    if (typeof value !== 'string') {
      errors.push(`${field} is missing or not a string`);
    } else if (value.trim().length === 0) {
      errors.push(`${field} is empty`);
    } else if (value.length > MAX_FIELD_LENGTH) {
      errors.push(`${field} exceeds ${MAX_FIELD_LENGTH} characters`);
    }
  }

  const categoryNotes = raw['categoryNotes'];
  if (!isRecord(categoryNotes)) {
    errors.push('categoryNotes is missing or not an object');
  } else {
    for (const [category, note] of Object.entries(categoryNotes)) {
      if (typeof note !== 'string') {
        errors.push(`categoryNotes.${category} is not a string`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Screen every generated string, including the category notes.
  const generated = [
    ...REQUIRED_STRING_FIELDS.map((field) => String(raw[field])),
    ...Object.values(isRecord(categoryNotes) ? categoryNotes : {}).map(String),
  ].join('\n');

  const claims = findUnsupportedClaims(generated);
  if (claims.length > 0) {
    return { ok: false, errors: claims.map((claim) => `generated text ${claim}`) };
  }

  return {
    ok: true,
    value: {
      headline: String(raw['headline']),
      summary: String(raw['summary']),
      opportunity: String(raw['opportunity']),
      caution: String(raw['caution']),
      reflection: String(raw['reflection']),
      categoryNotes: Object.fromEntries(
        Object.entries(isRecord(categoryNotes) ? categoryNotes : {}).map(([key, value]) => [
          key,
          String(value),
        ]),
      ),
    },
  };
}

/**
 * Derive an `AiReading`-shaped object from the deterministic reading.
 *
 * Used when AI is disabled or its response was rejected, so callers can render
 * one shape regardless of which path produced the text.
 */
export function deterministicFallbackReading(reading: DailyReading): AiReading {
  const supportive = reading.transits.find((transit) => transit.tone === 'supportive');
  const challenging = reading.transits.find((transit) => transit.tone === 'challenging');

  return {
    headline: reading.headline,
    summary: reading.summary,
    opportunity:
      supportive?.interpretation ??
      'No strongly supportive contact is active today; tradition would read this as an ordinary day rather than a favourable or difficult one.',
    caution: challenging?.interpretation ?? 'No strongly challenging contact is active today.',
    reflection: reading.moonPhase.interpretation,
    categoryNotes: Object.fromEntries(
      reading.categories.map((category) => [category.category, category.explanation]),
    ),
  };
}

/** Convenience: use the validated model reading, or fall back deterministically. */
export function resolveReading(
  reading: DailyReading,
  aiResponse: unknown,
): {
  value: AiReading;
  source: 'ai' | 'deterministic';
  errors: readonly string[];
} {
  const validated = validateAiReading(aiResponse);
  if (validated.ok) {
    return { value: validated.value, source: 'ai', errors: [] };
  }
  return {
    value: deterministicFallbackReading(reading),
    source: 'deterministic',
    errors: validated.errors,
  };
}

export type { DailyContext };
