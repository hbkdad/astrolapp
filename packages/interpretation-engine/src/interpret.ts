/**
 * Interpretation resolution.
 *
 * Two paths produce text, in priority order:
 *
 *   1. `specific`  — a hand-written entry for this exact key.
 *   2. `composed`  — assembled from body, target and aspect themes.
 *
 * The composed path always succeeds, so an interpretation is never missing.
 * `Interpretation.source` records which path ran, making gaps in the content
 * library measurable instead of invisible.
 */

import type { LunarState, TransitEvent } from '@astrolapp/astro-engine';
import {
  NATAL_TARGET_AFFINITY,
  TRANSITING_BODY_AFFINITY,
  transitKey,
  type Category,
} from '@astrolapp/context-engine';
import { CATEGORIES } from '@astrolapp/context-engine';
import type { NumerologyValue } from '@astrolapp/numerology-engine';
import { SPECIFIC_TRANSIT_ENTRIES } from './content/specific-transits.js';
import { ASPECT_THEMES, NATAL_TARGET_THEMES, TRANSITING_BODY_THEMES } from './content/themes.js';
import { MOON_PHASE_ENTRIES, moonSignEntry } from './content/moon.js';
import {
  lifePathEntry,
  personalDayEntry,
  personalMonthEntry,
  personalYearEntry,
} from './content/numerology.js';
import { lunarFact, numerologyFact, transitFact } from './facts.js';
import type { Interpretation, Tone } from './types.js';

/** Minimum combined affinity for a category to be listed against an event. */
const CATEGORY_RELEVANCE_THRESHOLD = 0.12;

/** Orb inside which tradition treats a contact as at peak expression. */
const CLOSE_ORB_DEGREES = 1;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function targetName(target: string): string {
  if (target === 'ascendant') return 'Ascendant';
  if (target === 'midheaven') return 'Midheaven';
  if (target === 'northNode') return 'North Node';
  if (target === 'southNode') return 'South Node';
  return titleCase(target);
}

/** Life areas a transit relates to, from the same affinity tables that score it. */
function categoriesForTransit(event: TransitEvent): Category[] {
  const bodyAffinity = TRANSITING_BODY_AFFINITY[event.transitingBody] ?? {};
  const targetAffinity = NATAL_TARGET_AFFINITY[event.natalTarget] ?? {};

  return CATEGORIES.filter(
    (category) =>
      (bodyAffinity[category] ?? 0) * (targetAffinity[category] ?? 0) >=
      CATEGORY_RELEVANCE_THRESHOLD,
  );
}

/**
 * Interpret one transit.
 *
 * The returned `fact` and `interpretation` are deliberately separate strings.
 * Callers may present them together but must never merge them into a single
 * field, or the distinction between what was computed and what is tradition is
 * lost for everything downstream.
 */
export function interpretTransit(event: TransitEvent): Interpretation {
  const key = transitKey(event);
  const fact = transitFact(event);
  const categories = categoriesForTransit(event);

  const specific = SPECIFIC_TRANSIT_ENTRIES[key];
  if (specific !== undefined) {
    return {
      key,
      title: specific.title,
      fact,
      interpretation: specific.body + closenessNote(event),
      tone: specific.tone,
      source: 'specific',
      categories: specific.categories ?? categories,
    };
  }

  const bodyTheme = TRANSITING_BODY_THEMES[event.transitingBody];
  const targetTheme = NATAL_TARGET_THEMES[event.natalTarget];
  const aspectTheme = ASPECT_THEMES[event.aspect.type];

  const body = titleCase(event.transitingBody);
  const target = targetName(event.natalTarget);

  const interpretation =
    `Astrology traditionally reads transiting ${body} — ${bodyTheme.principle} — ` +
    `${aspectTheme.relation} your natal ${target} — ${targetTheme.principle} — ` +
    `as ${aspectTheme.quality}. In this reading, ${body} ${bodyTheme.action} ` +
    `${targetTheme.action}.` +
    closenessNote(event);

  return {
    key,
    title: `${body} ${aspectTheme.relation} natal ${target}`,
    fact,
    interpretation,
    tone: aspectTheme.tone,
    source: 'composed',
    categories,
  };
}

/** Note appended when a contact is unusually close to exact. */
function closenessNote(event: TransitEvent): string {
  if (event.aspect.orb > CLOSE_ORB_DEGREES) return '';
  return ' This contact is close to exact, which tradition treats as its point of strongest expression.';
}

export function interpretMoonPhase(state: LunarState): Interpretation {
  const entry = MOON_PHASE_ENTRIES[state.phase];
  return {
    key: entry.key,
    title: entry.title,
    fact: lunarFact(state),
    interpretation: entry.body,
    tone: entry.tone,
    source: 'specific',
    categories: entry.categories ?? [],
  };
}

export function interpretMoonSign(state: LunarState): Interpretation {
  const entry = moonSignEntry(state.position.sign);
  return {
    key: entry.key,
    title: entry.title,
    fact: lunarFact(state),
    interpretation: entry.body,
    tone: entry.tone,
    source: 'specific',
    categories: [],
  };
}

export type NumerologyValueKind = 'life-path' | 'personal-year' | 'personal-month' | 'personal-day';

const NUMEROLOGY_ENTRY_BUILDERS: Record<
  NumerologyValueKind,
  (value: number) => { key: string; title: string; body: string; tone: Tone }
> = {
  'life-path': (value) => ({ ...lifePathEntry(value) }),
  'personal-year': (value) => ({ ...personalYearEntry(value) }),
  'personal-month': (value) => ({ ...personalMonthEntry(value) }),
  'personal-day': (value) => ({ ...personalDayEntry(value) }),
};

const NUMEROLOGY_LABELS: Record<NumerologyValueKind, string> = {
  'life-path': 'Life Path',
  'personal-year': 'Personal Year',
  'personal-month': 'Personal Month',
  'personal-day': 'Personal Day',
};

export function interpretNumerologyValue(
  kind: NumerologyValueKind,
  value: NumerologyValue,
): Interpretation {
  const entry = NUMEROLOGY_ENTRY_BUILDERS[kind](value.value);
  return {
    key: entry.key,
    title: entry.title,
    fact: numerologyFact(NUMEROLOGY_LABELS[kind], value),
    interpretation: entry.body,
    tone: entry.tone,
    source: 'specific',
    categories: [],
  };
}
