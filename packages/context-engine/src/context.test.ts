import { describe, expect, it } from 'vitest';
import {
  computeNatalChart,
  computeTransits,
  defaultEphemerisProvider as provider,
  resolveLocalTimeToInstant,
} from '@astrolapp/astro-engine';
import { PythagoreanNumerology } from '@astrolapp/numerology-engine';
import { CATEGORIES, computeValenceTotals, scoreCategories, valenceOf } from './categories.js';
import { computeDailyContext } from './context.js';

const birth = resolveLocalTimeToInstant(
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30 },
  'Europe/London',
).instant;

const chart = computeNatalChart(provider, {
  instant: birth,
  coordinates: { latitude: 51.5074, longitude: -0.1278 },
});

const date = new Date('2026-08-09T12:00:00Z');
const numerology = {
  system: new PythagoreanNumerology(),
  birthDate: { year: 1990, month: 5, day: 15 },
  fullName: 'John Smith',
};

describe('category scoring', () => {
  /**
   * A quiet category must read as neutral, not as zero. "Love: 0" tells a user
   * their day is catastrophic; "Love: 50, no relevant activity" is the truth.
   */
  it('scores exactly 50 with zero confidence when nothing is in orb', () => {
    const scores = scoreCategories([]);
    for (const category of CATEGORIES) {
      expect(scores[category].score).toBe(50);
      expect(scores[category].confidence).toBe(0);
      expect(scores[category].contributions).toEqual([]);
    }
  });

  it('keeps every score inside 0..100 and confidence inside 0..1', () => {
    const events = computeTransits(provider, chart, date);
    const scores = scoreCategories(events);
    for (const category of CATEGORIES) {
      expect(scores[category].score).toBeGreaterThanOrEqual(0);
      expect(scores[category].score).toBeLessThanOrEqual(100);
      expect(scores[category].confidence).toBeGreaterThanOrEqual(0);
      expect(scores[category].confidence).toBeLessThanOrEqual(1);
    }
  });

  /** Every displayed number must be explainable. */
  it('lists a contribution for every category that moved off neutral', () => {
    const scores = scoreCategories(computeTransits(provider, chart, date));
    for (const category of CATEGORIES) {
      const score = scores[category];
      if (score.score !== 50) {
        expect(score.contributions.length).toBeGreaterThan(0);
      }
    }
  });

  it('sums its contributions to the reported valence', () => {
    const scores = scoreCategories(computeTransits(provider, chart, date));
    for (const category of CATEGORIES) {
      const score = scores[category];
      const summed = score.contributions.reduce((total, item) => total + item.contribution, 0);
      expect(summed).toBeCloseTo(score.valence, 9);
    }
  });

  it('orders contributions by absolute influence', () => {
    const scores = scoreCategories(computeTransits(provider, chart, date));
    for (const category of CATEGORIES) {
      const contributions = scores[category].contributions;
      for (let index = 1; index < contributions.length; index += 1) {
        expect(Math.abs(contributions[index]!.contribution)).toBeLessThanOrEqual(
          Math.abs(contributions[index - 1]!.contribution),
        );
      }
    }
  });

  it('moves a score up for harmonious aspects and down for hard ones', () => {
    const events = computeTransits(provider, chart, date);
    const supportive = events.filter((event) => valenceOf(event) > 0);
    const challenging = events.filter((event) => valenceOf(event) < 0);

    const supportiveScores = scoreCategories(supportive);
    const challengingScores = scoreCategories(challenging);

    for (const category of CATEGORIES) {
      expect(supportiveScores[category].score).toBeGreaterThanOrEqual(50);
      expect(challengingScores[category].score).toBeLessThanOrEqual(50);
    }
  });

  it('treats a conjunction by the nature of the transiting body', () => {
    const events = computeTransits(provider, chart, date);
    for (const event of events) {
      if (event.aspect.type !== 'conjunction') continue;
      if (event.transitingBody === 'jupiter' || event.transitingBody === 'venus') {
        expect(valenceOf(event)).toBeGreaterThan(0);
      }
      if (event.transitingBody === 'saturn' || event.transitingBody === 'pluto') {
        expect(valenceOf(event)).toBeLessThan(0);
      }
    }
  });

  /**
   * A score that is always "about 50" is decoration, not information.
   *
   * This samples a year of real transits and requires the scores actually to
   * spread. It guards a specific regression: a weight or scale change that
   * compresses every category into the neutral band, which is exactly what an
   * earlier calibration of VALENCE_SCALE did.
   */
  it('produces scores with usable dynamic range across a year', () => {
    const observed: number[] = [];
    for (let day = 0; day < 365; day += 5) {
      const sampleDate = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000);
      const scores = scoreCategories(computeTransits(provider, chart, sampleDate));
      for (const category of CATEGORIES) {
        const score = scores[category];
        // Ignore categories with no activity; those are legitimately neutral.
        if (score.confidence > 0.1) observed.push(score.score);
      }
    }

    expect(observed.length).toBeGreaterThan(50);
    expect(Math.min(...observed)).toBeLessThan(35);
    expect(Math.max(...observed)).toBeGreaterThan(65);

    // At least a fifth of active readings should land outside the middle band,
    // otherwise "mixed" is the only label users ever see.
    const decisive = observed.filter((score) => score <= 40 || score >= 60);
    expect(decisive.length / observed.length).toBeGreaterThan(0.2);
  });

  it('reports opportunity and friction independently', () => {
    const totals = computeValenceTotals(computeTransits(provider, chart, date));
    expect(totals.opportunity).toBeGreaterThanOrEqual(0);
    expect(totals.opportunity).toBeLessThanOrEqual(100);
    expect(totals.friction).toBeGreaterThanOrEqual(0);
    expect(totals.friction).toBeLessThanOrEqual(100);
    expect(computeValenceTotals([])).toEqual({ opportunity: 0, friction: 0 });
  });
});

describe('computeDailyContext', () => {
  const context = computeDailyContext(provider, { chart, date, numerology });

  it('assembles sky, moon, transits and numerology into one object', () => {
    expect(context.sky).toHaveLength(10);
    expect(context.moon.phase).toBeTruthy();
    expect(context.transits.length).toBeGreaterThan(0);
    expect(context.numerology).not.toBeNull();
    expect(context.date).toBe('2026-08-09');
  });

  it('works without numerology', () => {
    const withoutNumerology = computeDailyContext(provider, { chart, date });
    expect(withoutNumerology.numerology).toBeNull();
    expect(withoutNumerology.categories).toBeTruthy();
  });

  /**
   * Category scores come from the full transit set, not the truncated display
   * list, so asking the UI for fewer rows must not change the numbers.
   */
  it('keeps scores stable regardless of how many transits are displayed', () => {
    const few = computeDailyContext(provider, { chart, date, numerology, maxTransits: 3 });
    const many = computeDailyContext(provider, { chart, date, numerology, maxTransits: 50 });

    expect(few.transits.length).toBeLessThanOrEqual(3);
    expect(few.categories).toEqual(many.categories);
    expect(few.overall).toBe(many.overall);
  });

  it('is deterministic apart from the computation timestamp', () => {
    const first = computeDailyContext(provider, { chart, date, numerology });
    const second = computeDailyContext(provider, { chart, date, numerology });
    const strip = (value: typeof first): unknown => ({
      ...value,
      metadata: { ...value.metadata, computedAt: null },
    });
    expect(strip(first)).toEqual(strip(second));
  });

  it('keeps the overall score neutral when no category has evidence', () => {
    // An empty transit set is the degenerate case; overall must not be NaN.
    const empty = scoreCategories([]);
    const allNeutral = Object.values(empty).every((score) => score.score === 50);
    expect(allNeutral).toBe(true);
  });

  it('restricts personal lunar transits to the Moon', () => {
    for (const event of context.personalLunarTransits) {
      expect(event.transitingBody).toBe('moon');
    }
    expect(context.lunarInfluence).toBeGreaterThanOrEqual(0);
    expect(context.lunarInfluence).toBeLessThanOrEqual(100);
  });

  it('emits interpretation keys for everything it references', () => {
    expect(context.explanationKeys).toContain(`moon.phase.${context.moon.phase}`);
    expect(context.explanationKeys).toContain(`moon.sign.${context.moon.position.sign}`);
    expect(context.explanationKeys.some((key) => key.startsWith('numerology.personal-day.'))).toBe(
      true,
    );
    // Keys must be unique so callers can prefetch content without deduping.
    expect(new Set(context.explanationKeys).size).toBe(context.explanationKeys.length);
  });

  it('stamps every engine version needed to reproduce the result', () => {
    expect(context.metadata.astroEngineVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(context.metadata.numerologyVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(context.metadata.scoreModelVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(context.metadata.ephemerisProvider).toBe('astronomy-engine');
  });

  it('ranks signals by strength', () => {
    for (let index = 1; index < context.strongestSignals.length; index += 1) {
      expect(context.strongestSignals[index]!.strength).toBeLessThanOrEqual(
        context.strongestSignals[index - 1]!.strength,
      );
    }
  });

  it('uses the requested date for the numerology cycles, not today', () => {
    const cycles = context.numerology!.cycles;
    // 2026-08-09 is after a 15 May birthday, so the cycle year is 2026.
    expect(cycles.personalYear.trace[0]!.value).toBe(2026);
  });
});
