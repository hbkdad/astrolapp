import 'server-only';
import {
  computeNatalChart,
  defaultEphemerisProvider,
  resolveLocalTimeToInstant,
  HouseSystemUndefinedError,
  type NatalChart,
  type ResolvedInstant,
} from '@astrolapp/astro-engine';
import { PythagoreanNumerology } from '@astrolapp/numerology-engine';
import { computeDailyContext, type DailyContext } from '@astrolapp/context-engine';
import { buildDailyReading, type DailyReading } from '@astrolapp/interpretation-engine';
import type { StoredBirthProfile } from './profile.js';

/**
 * Bridge from a stored profile to computed results.
 *
 * All calculation happens on the server. The browser receives finished values,
 * never an ephemeris — which keeps the client bundle small and, more
 * importantly, keeps a single verified implementation as the only source of
 * astronomical fact.
 */

export interface ComputedProfile {
  readonly chart: NatalChart;
  readonly context: DailyContext;
  readonly reading: DailyReading;
  readonly resolvedInstant: ResolvedInstant;
  /**
   * Set when the birth time is unknown. Houses and angles are then computed
   * from noon as a placeholder and MUST NOT be displayed — see
   * `birthTimeUnknown` handling in the UI.
   */
  readonly birthTimeUnknown: boolean;
  /** Set when Placidus was unavailable and a fallback system was used. */
  readonly houseSystemFallback: string | null;
}

export function computeForProfile(profile: StoredBirthProfile, date: Date): ComputedProfile {
  const [year, month, day] = profile.birthDate.split('-').map(Number);
  const birthTimeUnknown = profile.birthTime === null;

  // With no birth time, noon local is used so the planetary positions are as
  // close as possible on average — the Moon moves ~13°/day, so noon halves the
  // worst-case error compared with midnight. The angles remain meaningless and
  // the UI suppresses them.
  const [hour, minute] = birthTimeUnknown
    ? [12, 0]
    : (profile.birthTime as string).split(':').map(Number);

  const resolvedInstant = resolveLocalTimeToInstant(
    {
      year: year ?? 1970,
      month: month ?? 1,
      day: day ?? 1,
      hour: hour ?? 12,
      minute: minute ?? 0,
    },
    profile.timeZone,
  );

  const coordinates = { latitude: profile.latitude, longitude: profile.longitude };

  let houseSystemFallback: string | null = null;
  let chart: NatalChart;
  try {
    chart = computeNatalChart(defaultEphemerisProvider, {
      instant: resolvedInstant.instant,
      coordinates,
      houseSystem: profile.houseSystem,
    });
  } catch (error) {
    // Placidus has no solution inside the polar circles. Falling back to whole
    // sign is correct and must be disclosed, not hidden.
    if (error instanceof HouseSystemUndefinedError) {
      houseSystemFallback = 'whole-sign';
      chart = computeNatalChart(defaultEphemerisProvider, {
        instant: resolvedInstant.instant,
        coordinates,
        houseSystem: 'whole-sign',
      });
    } else {
      throw error;
    }
  }

  const context = computeDailyContext(defaultEphemerisProvider, {
    chart,
    date,
    numerology:
      profile.fullName.length > 0
        ? {
            system: new PythagoreanNumerology(),
            birthDate: { year: year ?? 1970, month: month ?? 1, day: day ?? 1 },
            fullName: profile.fullName,
          }
        : undefined,
  });

  return {
    chart,
    context,
    reading: buildDailyReading(context),
    resolvedInstant,
    birthTimeUnknown,
    houseSystemFallback,
  };
}
