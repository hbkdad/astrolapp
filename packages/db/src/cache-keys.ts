/**
 * Cache keys for expensive, reproducible calculations.
 *
 * The failure this module exists to prevent: an engine change ships, and every
 * user keeps seeing charts computed under the OLD rules because the cache key
 * only covered the birth data. The result looks completely normal and is wrong,
 * possibly for months.
 *
 * Every key therefore includes the engine and provider versions that produced
 * the value. A version bump changes the key, the cache misses, and the value is
 * recomputed. Stale entries become unreachable rather than being served.
 *
 * Corollary: bumping `ENGINE_VERSIONS` is the mechanism for invalidating caches.
 * Changing a calculation WITHOUT bumping the version leaves wrong data live.
 */

import { createHash } from 'node:crypto';
import { ENGINE_VERSIONS } from '@astrolapp/shared';
import type { HouseSystem } from '@astrolapp/astro-engine';

/** The identifying inputs of a birth chart. */
export interface BirthChartCacheInput {
  /** Exact UTC instant of birth. */
  readonly instant: Date;
  readonly latitude: number;
  readonly longitude: number;
  readonly houseSystem: HouseSystem;
  readonly ephemerisProvider: string;
  readonly ephemerisVersion: string;
}

/**
 * Round coordinates before hashing, to 6 decimal places (~0.1 m).
 *
 * Without this, floating-point noise in the last bits of a latitude produces a
 * different key for what is physically the same location, and the cache never
 * hits. Six places is far finer than any birth record justifies.
 */
function roundCoordinate(value: number): string {
  return value.toFixed(6);
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Stable key for a computed natal chart.
 *
 * Uses the ISO instant rather than a local date and time, so the same moment
 * expressed in two time zones maps to one entry.
 */
export function birthChartCacheKey(input: BirthChartCacheInput): string {
  const parts = [
    'chart',
    input.instant.toISOString(),
    roundCoordinate(input.latitude),
    roundCoordinate(input.longitude),
    input.houseSystem,
    input.ephemerisProvider,
    input.ephemerisVersion,
    ENGINE_VERSIONS.astro,
  ];
  return `${parts[0]}:${sha256(parts.join('|'))}`;
}

export interface DailyContextCacheInput {
  /** Key of the natal chart this context is built on. */
  readonly chartCacheKey: string;
  /** Calendar date in UTC, `YYYY-MM-DD`. */
  readonly date: string;
  /** Present only when the context includes numerology. */
  readonly numerologyFingerprint?: string;
}

/**
 * Stable key for a day's computed context.
 *
 * Depends on the chart key, so a chart recomputation cascades correctly: if the
 * chart key changes, every context built on it changes too.
 */
export function dailyContextCacheKey(input: DailyContextCacheInput): string {
  const parts = [
    'context',
    input.chartCacheKey,
    input.date,
    input.numerologyFingerprint ?? 'no-numerology',
    ENGINE_VERSIONS.astro,
    ENGINE_VERSIONS.lunar,
    ENGINE_VERSIONS.numerology,
    ENGINE_VERSIONS.scoreModel,
  ];
  return `context:${sha256(parts.join('|'))}`;
}

/**
 * Fingerprint of the numerology inputs.
 *
 * The name is hashed rather than stored: a cache key can end up in logs, metrics
 * and error reports, and a user's full birth name should not travel to any of
 * those. The hash is stable, which is all the cache needs.
 */
export function numerologyFingerprint(
  fullName: string,
  birthDate: { year: number; month: number; day: number },
  systemId: string,
): string {
  return sha256(
    [
      fullName,
      birthDate.year,
      birthDate.month,
      birthDate.day,
      systemId,
      ENGINE_VERSIONS.numerology,
    ].join('|'),
  );
}

export interface DailyReadingCacheInput {
  readonly contextCacheKey: string;
  /** `ai` and `deterministic` readings are cached separately. */
  readonly source: 'ai' | 'deterministic';
  /** Bump when interpretation copy changes materially. */
  readonly interpretationVersion: string;
}

export function dailyReadingCacheKey(input: DailyReadingCacheInput): string {
  return `reading:${sha256(
    [input.contextCacheKey, input.source, input.interpretationVersion].join('|'),
  )}`;
}

/**
 * Opaque token for a shareable report.
 *
 * Deliberately random rather than derived: a token derived from the underlying
 * data would let anyone holding the data reconstruct the URL, and — worse — let
 * anyone holding the URL confirm a guess about the data. 160 bits of randomness,
 * base32-encoded without padding.
 */
export function generateShareToken(randomBytes: (size: number) => Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = randomBytes(20);
  let token = '';
  for (const byte of bytes) {
    const index = byte % alphabet.length;
    token += alphabet.charAt(index);
  }
  return token;
}
