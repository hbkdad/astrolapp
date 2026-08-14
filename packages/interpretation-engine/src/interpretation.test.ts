import { describe, expect, it } from 'vitest';
import {
  computeNatalChart,
  computeTransits,
  defaultEphemerisProvider as provider,
  resolveLocalTimeToInstant,
} from '@astrolapp/astro-engine';
import { PythagoreanNumerology } from '@astrolapp/numerology-engine';
import { computeDailyContext } from '@astrolapp/context-engine';
import { interpretMoonPhase, interpretNumerologyValue, interpretTransit } from './interpret.js';
import { buildDailyReading, describeConfidence, describeScore } from './reading.js';

const birth = resolveLocalTimeToInstant(
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30 },
  'Europe/London',
).instant;

const chart = computeNatalChart(provider, {
  instant: birth,
  coordinates: { latitude: 51.5074, longitude: -0.1278 },
});

const date = new Date('2026-08-09T12:00:00Z');
const context = computeDailyContext(provider, {
  chart,
  date,
  numerology: {
    system: new PythagoreanNumerology(),
    birthDate: { year: 1990, month: 5, day: 15 },
    fullName: 'John Smith',
  },
});

describe('fact and interpretation separation', () => {
  /**
   * The core structural guarantee: what was computed and what is tradition are
   * different fields, and the fact field never asserts meaning.
   */
  it('keeps fact and interpretation in separate non-empty fields', () => {
    for (const event of computeTransits(provider, chart, date)) {
      const interpretation = interpretTransit(event);
      expect(interpretation.fact.length).toBeGreaterThan(0);
      expect(interpretation.interpretation.length).toBeGreaterThan(0);
      expect(interpretation.fact).not.toBe(interpretation.interpretation);
    }
  });

  it('states only checkable quantities in the fact', () => {
    const event = computeTransits(provider, chart, date)[0]!;
    const { fact } = interpretTransit(event);

    expect(fact).toContain(event.aspect.orb.toFixed(2));
    expect(fact).toContain('natal');
    // Interpretive vocabulary must not leak into the factual sentence.
    for (const word of ['traditionally', 'suggests', 'means', 'favourable', 'lucky']) {
      expect(fact.toLowerCase()).not.toContain(word);
    }
  });

  it('frames every interpretation as tradition rather than assertion', () => {
    for (const event of computeTransits(provider, chart, date)) {
      const { interpretation } = interpretTransit(event);
      expect(interpretation.toLowerCase()).toMatch(
        /tradition|traditionally|astrology|is read|is described|associated with/,
      );
    }
  });

  it('reports the orb and phase actually computed', () => {
    for (const event of computeTransits(provider, chart, date)) {
      const { fact } = interpretTransit(event);
      if (event.aspect.phase === 'applying') expect(fact).toContain('applying');
      if (event.aspect.phase === 'separating') expect(fact).toContain('separating');
      if (event.retrograde) expect(fact).toContain('retrograde');
    }
  });
});

describe('interpretation resolution', () => {
  it('prefers a hand-written entry when one exists', () => {
    const saturnReturn = computeTransits(provider, chart, date).find(
      (event) => event.transitingBody === 'saturn' && event.natalTarget === 'saturn',
    );
    // Construct one explicitly rather than relying on the sky on a given day.
    const synthetic = {
      ...(saturnReturn ?? computeTransits(provider, chart, date)[0]!),
      transitingBody: 'saturn' as const,
      natalTarget: 'saturn' as const,
      aspect: {
        ...computeTransits(provider, chart, date)[0]!.aspect,
        type: 'conjunction' as const,
      },
    };
    const interpretation = interpretTransit(synthetic);
    expect(interpretation.source).toBe('specific');
    expect(interpretation.title).toBe('Saturn Return');
  });

  it('composes a reading when no specific entry exists', () => {
    const synthetic = {
      ...computeTransits(provider, chart, date)[0]!,
      transitingBody: 'mercury' as const,
      natalTarget: 'neptune' as const,
    };
    const interpretation = interpretTransit(synthetic);
    expect(interpretation.source).toBe('composed');
    expect(interpretation.interpretation).toContain('Mercury');
    expect(interpretation.interpretation).toContain('Neptune');
  });

  it('always returns an interpretation for every possible transit', () => {
    // Composition is the guaranteed fallback: nothing may resolve to nothing.
    for (const event of computeTransits(provider, chart, date)) {
      expect(() => interpretTransit(event)).not.toThrow();
      expect(interpretTransit(event).interpretation.length).toBeGreaterThan(20);
    }
  });

  it('notes when a contact is close to exact', () => {
    const events = computeTransits(provider, chart, date);
    for (const event of events) {
      const { interpretation } = interpretTransit(event);
      if (event.aspect.orb <= 1) {
        expect(interpretation).toContain('close to exact');
      }
    }
  });

  it('interprets moon phases and numerology values', () => {
    const moon = interpretMoonPhase(context.moon);
    expect(moon.key).toBe(`moon.phase.${context.moon.phase}`);
    expect(moon.fact).toContain('illuminated');

    const lifePath = interpretNumerologyValue('life-path', context.numerology!.profile.lifePath);
    expect(lifePath.key).toBe(`numerology.life-path.${context.numerology!.profile.lifePath.value}`);
    // The derivation must travel with the number.
    expect(lifePath.fact).toContain('Derivation');
  });
});

describe('deterministic daily reading', () => {
  const reading = buildDailyReading(context);

  it('produces a complete reading without any AI involvement', () => {
    expect(reading.headline.length).toBeGreaterThan(0);
    expect(reading.summary.length).toBeGreaterThan(0);
    expect(reading.categories).toHaveLength(7);
    expect(reading.moonPhase.interpretation.length).toBeGreaterThan(0);
    expect(reading.numerology).toHaveLength(4);
  });

  it('carries the disclaimer', () => {
    expect(reading.disclaimer).toContain('not established science');
    expect(reading.disclaimer).toContain('heuristics');
  });

  /** Meaning must never depend on colour alone — an accessibility requirement. */
  it('gives every score a text equivalent', () => {
    for (const category of reading.categories) {
      expect(category.band.length).toBeGreaterThan(0);
      expect(category.confidenceLabel.length).toBeGreaterThan(0);
      expect(category.explanation.length).toBeGreaterThan(0);
    }
    expect(reading.overallBand.length).toBeGreaterThan(0);
  });

  it('explains a neutral category as inactivity rather than balance', () => {
    const quiet = buildDailyReading(computeDailyContext(provider, { chart, date, maxTransits: 0 }));
    const untouched = quiet.categories.find((category) => category.confidence === 0);
    if (untouched !== undefined) {
      expect(untouched.explanation).toContain('No transits');
    }
  });

  it('bands scores monotonically', () => {
    expect(describeScore(90)).toBe('strongly supported');
    expect(describeScore(65)).toBe('supported');
    expect(describeScore(50)).toBe('mixed');
    expect(describeScore(30)).toBe('demanding');
    expect(describeScore(10)).toBe('strongly demanding');
    expect(describeConfidence(0)).toBe('no relevant activity');
  });

  it('is deterministic for the same context', () => {
    expect(buildDailyReading(context)).toEqual(buildDailyReading(context));
  });

  it('carries reproducibility metadata through to the reading', () => {
    expect(reading.metadata.ephemerisProvider).toBe('astronomy-engine');
    expect(reading.metadata.scoreModelVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
