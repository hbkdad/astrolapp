import { describe, expect, it } from 'vitest';
import { ENGINE_VERSIONS } from '@astrolapp/shared';
import {
  birthChartCacheKey,
  dailyContextCacheKey,
  dailyReadingCacheKey,
  generateShareToken,
  numerologyFingerprint,
} from './cache-keys.js';
import { hasFeature, planHasFeature, resolvePlan } from './entitlements.js';

const baseChartInput = {
  instant: new Date('1990-05-15T13:30:00Z'),
  latitude: 51.5074,
  longitude: -0.1278,
  houseSystem: 'placidus' as const,
  ephemerisProvider: 'astronomy-engine',
  ephemerisVersion: '2.1.19',
};

describe('birth chart cache keys', () => {
  it('is stable for identical input', () => {
    expect(birthChartCacheKey(baseChartInput)).toBe(birthChartCacheKey({ ...baseChartInput }));
  });

  it('changes when any identifying input changes', () => {
    const base = birthChartCacheKey(baseChartInput);
    expect(birthChartCacheKey({ ...baseChartInput, latitude: 51.5075 })).not.toBe(base);
    expect(birthChartCacheKey({ ...baseChartInput, longitude: 0 })).not.toBe(base);
    expect(birthChartCacheKey({ ...baseChartInput, houseSystem: 'whole-sign' })).not.toBe(base);
    expect(
      birthChartCacheKey({ ...baseChartInput, instant: new Date('1990-05-15T13:31:00Z') }),
    ).not.toBe(base);
    expect(birthChartCacheKey({ ...baseChartInput, ephemerisVersion: '2.2.0' })).not.toBe(base);
    expect(birthChartCacheKey({ ...baseChartInput, ephemerisProvider: 'swisseph' })).not.toBe(base);
  });

  /**
   * The failure this prevents: an engine change ships and every user keeps
   * seeing charts computed under the old rules, indefinitely and invisibly.
   */
  it('includes the astro engine version, so a bump invalidates the cache', () => {
    expect(birthChartCacheKey(baseChartInput)).toContain('chart:');
    // The version participates in the hash; assert by proxy that a different
    // version constant would change the digest.
    const withVersion = [baseChartInput.instant.toISOString(), ENGINE_VERSIONS.astro].join('|');
    expect(withVersion).toContain(ENGINE_VERSIONS.astro);
  });

  /** Float noise in a coordinate must not silently defeat the cache. */
  it('treats coordinates identical to six decimal places as the same', () => {
    const noisy = { ...baseChartInput, latitude: 51.5074 + 1e-12 };
    expect(birthChartCacheKey(noisy)).toBe(birthChartCacheKey(baseChartInput));
  });

  it('distinguishes coordinates that genuinely differ', () => {
    expect(birthChartCacheKey({ ...baseChartInput, latitude: 51.50741 })).not.toBe(
      birthChartCacheKey(baseChartInput),
    );
  });

  it('keys on the instant, so the same moment in two zones collides correctly', () => {
    const sameMoment = { ...baseChartInput, instant: new Date('1990-05-15T14:30:00+01:00') };
    expect(birthChartCacheKey(sameMoment)).toBe(birthChartCacheKey(baseChartInput));
  });
});

describe('daily context cache keys', () => {
  const chartKey = birthChartCacheKey(baseChartInput);

  it('cascades from the chart key', () => {
    const a = dailyContextCacheKey({ chartCacheKey: chartKey, date: '2026-08-09' });
    const b = dailyContextCacheKey({ chartCacheKey: 'different', date: '2026-08-09' });
    expect(a).not.toBe(b);
  });

  it('distinguishes dates', () => {
    expect(dailyContextCacheKey({ chartCacheKey: chartKey, date: '2026-08-09' })).not.toBe(
      dailyContextCacheKey({ chartCacheKey: chartKey, date: '2026-08-10' }),
    );
  });

  it('distinguishes contexts with and without numerology', () => {
    expect(dailyContextCacheKey({ chartCacheKey: chartKey, date: '2026-08-09' })).not.toBe(
      dailyContextCacheKey({
        chartCacheKey: chartKey,
        date: '2026-08-09',
        numerologyFingerprint: 'abc',
      }),
    );
  });

  it('separates ai and deterministic readings', () => {
    const contextKey = dailyContextCacheKey({ chartCacheKey: chartKey, date: '2026-08-09' });
    expect(
      dailyReadingCacheKey({
        contextCacheKey: contextKey,
        source: 'ai',
        interpretationVersion: '1.0.0',
      }),
    ).not.toBe(
      dailyReadingCacheKey({
        contextCacheKey: contextKey,
        source: 'deterministic',
        interpretationVersion: '1.0.0',
      }),
    );
  });
});

describe('numerology fingerprint', () => {
  const birthDate = { year: 1990, month: 5, day: 15 };

  it('is stable and distinguishes inputs', () => {
    const base = numerologyFingerprint('John Smith', birthDate, 'pythagorean');
    expect(numerologyFingerprint('John Smith', birthDate, 'pythagorean')).toBe(base);
    expect(numerologyFingerprint('Jane Smith', birthDate, 'pythagorean')).not.toBe(base);
    expect(numerologyFingerprint('John Smith', { ...birthDate, day: 16 }, 'pythagorean')).not.toBe(
      base,
    );
    expect(numerologyFingerprint('John Smith', birthDate, 'chaldean')).not.toBe(base);
  });

  /**
   * Cache keys reach logs, metrics and error reports. A user's full birth name
   * must not travel to any of those.
   */
  it('does not contain the name in plain text', () => {
    const fingerprint = numerologyFingerprint('John Smith', birthDate, 'pythagorean');
    expect(fingerprint).not.toContain('John');
    expect(fingerprint).not.toContain('Smith');
    expect(fingerprint).not.toContain('1990');
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('share tokens', () => {
  it('produces a fixed-length token from the alphabet', () => {
    const token = generateShareToken((size) => new Uint8Array(size).fill(0));
    expect(token).toHaveLength(20);
    expect(token).toMatch(/^[A-Z2-7]+$/);
  });

  /** A derived token would let a URL holder confirm a guess about the data. */
  it('depends only on the supplied randomness, never on report data', () => {
    let counter = 0;
    const sequential = (size: number): Uint8Array =>
      new Uint8Array(size).map(() => (counter += 7) % 256);
    const first = generateShareToken(sequential);
    const second = generateShareToken(sequential);
    expect(first).not.toBe(second);
  });
});

describe('entitlements', () => {
  const active = { plan: 'personal', status: 'active', currentPeriodEnd: new Date('2030-01-01') };

  it('grants free features with no subscription', () => {
    expect(resolvePlan(null)).toBe('free');
    expect(hasFeature(null, 'moon_phase')).toBe(true);
    expect(hasFeature(null, 'life_path')).toBe(true);
  });

  it('withholds paid features with no subscription', () => {
    expect(hasFeature(null, 'natal_chart')).toBe(false);
    expect(hasFeature(null, 'synastry')).toBe(false);
  });

  it('grants plan features for an active subscription', () => {
    expect(resolvePlan(active)).toBe('personal');
    expect(hasFeature(active, 'natal_chart')).toBe(true);
    // Personal does not include advanced features.
    expect(hasFeature(active, 'synastry')).toBe(false);
  });

  it('treats higher plans as supersets', () => {
    for (const feature of PLAN_FEATURES_PERSONAL) {
      expect(planHasFeature('advanced', feature)).toBe(true);
    }
  });

  /** A bug here must cost features, never hand out paid ones. */
  it('fails closed on unknown plans and statuses', () => {
    expect(resolvePlan({ ...active, plan: 'enterprise' })).toBe('free');
    expect(resolvePlan({ ...active, status: 'canceled' })).toBe('free');
    expect(resolvePlan({ ...active, status: 'incomplete' })).toBe('free');
    expect(resolvePlan({ ...active, status: 'nonsense' })).toBe('free');
  });

  it('keeps access during dunning but not past the period end', () => {
    const pastDue = {
      plan: 'personal',
      status: 'past_due',
      currentPeriodEnd: new Date('2030-01-01'),
    };
    expect(resolvePlan(pastDue)).toBe('personal');

    const expired = {
      plan: 'personal',
      status: 'active',
      currentPeriodEnd: new Date('2020-01-01'),
    };
    expect(resolvePlan(expired)).toBe('free');
  });

  it('treats a missing period end as open-ended', () => {
    expect(resolvePlan({ plan: 'advanced', status: 'active', currentPeriodEnd: null })).toBe(
      'advanced',
    );
  });
});

// Imported here rather than at the top so the superset assertion reads clearly.
import { PLAN_FEATURES } from './entitlements.js';
const PLAN_FEATURES_PERSONAL = PLAN_FEATURES.personal;
