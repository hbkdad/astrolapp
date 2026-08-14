/**
 * The combined personal context engine.
 *
 * This is the join point of the whole product: natal chart, current sky,
 * lunar state, personal lunar contacts and numerology cycles are normalised
 * into ONE structured object.
 *
 * It produces DATA, never prose. Everything downstream — deterministic
 * templates, AI language, dashboards, notifications — reads this object and
 * nothing else. That is what keeps the AI layer from inventing astronomy: by
 * the time prose is written, every number has already been computed and
 * verified here.
 */

import { ENGINE_VERSIONS } from '@astrolapp/shared';
import {
  DEFAULT_CHART_BODIES,
  computeLunarState,
  computeTransits,
  computeUpcomingLunations,
  type BodyPosition,
  type EphemerisProvider,
  type LunarState,
  type NatalChart,
  type TransitEvent,
  type UpcomingLunations,
} from '@astrolapp/astro-engine';
import type {
  BirthDateInput,
  NumerologyProfile,
  NumerologySystem,
  PersonalCycles,
} from '@astrolapp/numerology-engine';
import {
  computeValenceTotals,
  scoreCategories,
  transitKey,
  type Category,
  type CategoryScore,
} from './categories.js';

export interface NumerologyInput {
  readonly system: NumerologySystem;
  readonly birthDate: BirthDateInput;
  readonly fullName: string;
}

export interface PersonalContextOptions {
  readonly chart: NatalChart;
  readonly date: Date;
  /** Omit to build a context without numerology. */
  readonly numerology?: NumerologyInput;
  /** Limit to the strongest N transits. Defaults to 12. */
  readonly maxTransits?: number;
}

/** A notable event, ranked, with the key needed to interpret it. */
export interface Signal {
  readonly kind: 'transit' | 'lunar' | 'numerology';
  readonly key: string;
  readonly label: string;
  /** 0..100 heuristic prominence. */
  readonly strength: number;
  readonly detail: string;
}

export interface NumerologyContext {
  readonly profile: NumerologyProfile;
  readonly cycles: PersonalCycles;
}

export interface DailyContext {
  /** The instant this context describes. */
  readonly instant: string;
  /** Calendar date in UTC, convenient for cache keys. */
  readonly date: string;

  readonly sky: readonly BodyPosition[];
  readonly moon: LunarState;
  readonly upcomingLunations: UpcomingLunations;

  readonly transits: readonly TransitEvent[];
  /** Moon-to-natal contacts only. Short-lived and personal. */
  readonly personalLunarTransits: readonly TransitEvent[];
  /** Heuristic 0..100 prominence of today's lunar contacts. */
  readonly lunarInfluence: number;

  readonly numerology: NumerologyContext | null;

  readonly categories: Record<Category, CategoryScore>;
  readonly opportunity: number;
  readonly friction: number;
  /** 0..100 heuristic summary of the day. */
  readonly overall: number;

  readonly strongestSignals: readonly Signal[];
  /** Every interpretation key referenced, for content lookup and prefetching. */
  readonly explanationKeys: readonly string[];

  readonly metadata: {
    readonly astroEngineVersion: string;
    readonly numerologyVersion: string;
    readonly lunarVersion: string;
    readonly scoreModelVersion: string;
    readonly ephemerisProvider: string;
    readonly ephemerisVersion: string;
    readonly computedAt: string;
  };
}

const DEFAULT_MAX_TRANSITS = 12;

/**
 * Overall day score.
 *
 * A confidence-weighted mean of the category scores, so a category with no
 * relevant activity does not drag the day toward neutral. When nothing at all
 * is happening the result is exactly 50.
 */
function computeOverall(categories: Record<Category, CategoryScore>): number {
  let weighted = 0;
  let totalConfidence = 0;

  for (const score of Object.values(categories)) {
    weighted += score.score * score.confidence;
    totalConfidence += score.confidence;
  }

  if (totalConfidence === 0) return 50;
  return Math.round((weighted / totalConfidence) * 10) / 10;
}

/** Prominence of the Moon's contacts to the natal chart, 0..100. */
function computeLunarInfluence(lunarTransits: readonly TransitEvent[]): number {
  const total = lunarTransits.reduce((sum, event) => sum + event.strength / 100, 0);
  return Math.round(100 * (1 - Math.exp(-total / 1.2)) * 10) / 10;
}

function describeTransit(event: TransitEvent): string {
  const motion = event.retrograde ? ', retrograde' : '';
  const phase = event.aspect.phase === 'unknown' ? '' : `, ${event.aspect.phase}`;
  return `orb ${event.aspect.orb.toFixed(2)}°${phase}${motion}`;
}

/**
 * Build the complete personal context for one instant.
 *
 * Deterministic apart from `metadata.computedAt`: the same chart, date and
 * numerology input always produce the same scores and the same ordering.
 */
export function computeDailyContext(
  provider: EphemerisProvider,
  options: PersonalContextOptions,
): DailyContext {
  const { chart, date, numerology, maxTransits = DEFAULT_MAX_TRANSITS } = options;

  const sky = provider.getBodyPositions(DEFAULT_CHART_BODIES, date);
  const moon = computeLunarState(provider, date);
  const upcomingLunations = computeUpcomingLunations(provider, date);

  const allTransits = computeTransits(provider, chart, date);
  const transits = allTransits.slice(0, maxTransits);
  const personalLunarTransits = allTransits.filter((event) => event.transitingBody === 'moon');

  // Categories are scored from the full set, not the truncated display list, so
  // the number shown does not change when the UI asks for a shorter list.
  const categories = scoreCategories(allTransits);
  const { opportunity, friction } = computeValenceTotals(allTransits);

  const numerologyContext: NumerologyContext | null =
    numerology === undefined
      ? null
      : {
          profile: numerology.system.calculateProfile(numerology.birthDate, numerology.fullName),
          cycles: numerology.system.calculatePersonalCycles(numerology.birthDate, {
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
            day: date.getUTCDate(),
          }),
        };

  const signals: Signal[] = transits.slice(0, 5).map((event) => ({
    kind: 'transit' as const,
    key: transitKey(event),
    label: `${event.transitingBody} ${event.aspect.type} natal ${event.natalTarget}`,
    strength: event.strength,
    detail: describeTransit(event),
  }));

  signals.push({
    kind: 'lunar',
    key: `moon.phase.${moon.phase}`,
    label: `Moon ${moon.phase.replace(/-/g, ' ')} in ${moon.position.sign}`,
    strength: computeLunarInfluence(personalLunarTransits),
    detail: `${(moon.illumination * 100).toFixed(0)}% illuminated, ${moon.ageDays.toFixed(1)} days old`,
  });

  if (numerologyContext !== null) {
    signals.push({
      kind: 'numerology',
      key: `numerology.personal-day.${numerologyContext.cycles.personalDay.value}`,
      label: `Personal Day ${numerologyContext.cycles.personalDay.value}`,
      strength: 50,
      detail: `Personal Year ${numerologyContext.cycles.personalYear.value}, Personal Month ${numerologyContext.cycles.personalMonth.value}`,
    });
  }

  const explanationKeys = [
    ...new Set([
      ...allTransits.map(transitKey),
      `moon.phase.${moon.phase}`,
      `moon.sign.${moon.position.sign}`,
      ...(numerologyContext === null
        ? []
        : [
            `numerology.life-path.${numerologyContext.profile.lifePath.value}`,
            `numerology.personal-year.${numerologyContext.cycles.personalYear.value}`,
            `numerology.personal-month.${numerologyContext.cycles.personalMonth.value}`,
            `numerology.personal-day.${numerologyContext.cycles.personalDay.value}`,
          ]),
    ]),
  ];

  return {
    instant: date.toISOString(),
    date: date.toISOString().slice(0, 10),
    sky,
    moon,
    upcomingLunations,
    transits,
    personalLunarTransits,
    lunarInfluence: computeLunarInfluence(personalLunarTransits),
    numerology: numerologyContext,
    categories,
    opportunity,
    friction,
    overall: computeOverall(categories),
    strongestSignals: signals.sort((left, right) => right.strength - left.strength),
    explanationKeys,
    metadata: {
      astroEngineVersion: ENGINE_VERSIONS.astro,
      numerologyVersion: ENGINE_VERSIONS.numerology,
      lunarVersion: ENGINE_VERSIONS.lunar,
      scoreModelVersion: ENGINE_VERSIONS.scoreModel,
      ephemerisProvider: provider.id,
      ephemerisVersion: provider.version,
      computedAt: new Date().toISOString(),
    },
  };
}
