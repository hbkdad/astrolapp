import { describe, expect, it } from 'vitest';
import {
  computeNatalChart,
  defaultEphemerisProvider as provider,
  resolveLocalTimeToInstant,
} from '@astrolapp/astro-engine';
import { PythagoreanNumerology } from '@astrolapp/numerology-engine';
import { computeDailyContext } from '@astrolapp/context-engine';
import {
  buildAiReadingInput,
  deterministicFallbackReading,
  resolveReading,
  validateAiReading,
} from './ai.js';
import { buildDailyReading } from './reading.js';

const chart = computeNatalChart(provider, {
  instant: resolveLocalTimeToInstant(
    { year: 1990, month: 5, day: 15, hour: 14, minute: 30 },
    'Europe/London',
  ).instant,
  coordinates: { latitude: 51.5074, longitude: -0.1278 },
});

const context = computeDailyContext(provider, {
  chart,
  date: new Date('2026-08-09T12:00:00Z'),
  numerology: {
    system: new PythagoreanNumerology(),
    birthDate: { year: 1990, month: 5, day: 15 },
    fullName: 'John Smith',
  },
});

const reading = buildDailyReading(context);

const validResponse = {
  headline: 'A steady day for getting things settled',
  summary: 'Traditionally this combination is read as a day that rewards patience.',
  opportunity: 'A good moment to revisit something you had set aside.',
  caution: 'Tradition would suggest not forcing a decision today.',
  reflection: 'What would it look like to let this take its own time?',
  categoryNotes: { career: 'Steady.', love: 'Warm and unhurried.' },
};

describe('model input', () => {
  it('carries prepared facts and interpretations', () => {
    const input = buildAiReadingInput(reading);
    expect(input.categories).toHaveLength(7);
    expect(input.moon.fact).toContain('illuminated');
    expect(input.instructions).toContain('Do not state any planetary');
  });

  /**
   * Rewriting a reading does not require knowing who the person is, so no
   * identifying data is sent. This is a privacy boundary, not an optimisation.
   */
  it('sends no birth date, birth time, location or name', () => {
    const serialised = JSON.stringify(buildAiReadingInput(reading));
    expect(serialised).not.toContain('John Smith');
    expect(serialised).not.toContain('1990');
    expect(serialised).not.toContain('51.5074');
    expect(serialised).not.toContain('Europe/London');
  });
});

describe('response validation', () => {
  it('accepts a well-formed response', () => {
    const result = validateAiReading(validResponse);
    expect(result.ok).toBe(true);
  });

  it('rejects non-objects and missing fields', () => {
    expect(validateAiReading(null).ok).toBe(false);
    expect(validateAiReading('a string').ok).toBe(false);
    expect(validateAiReading({ ...validResponse, headline: undefined }).ok).toBe(false);
    expect(validateAiReading({ ...validResponse, summary: '' }).ok).toBe(false);
    expect(validateAiReading({ ...validResponse, categoryNotes: 'not an object' }).ok).toBe(false);
  });

  it('rejects a field that is not a string', () => {
    const result = validateAiReading({ ...validResponse, reflection: 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('reflection');
  });

  it('rejects absurdly long fields', () => {
    const result = validateAiReading({ ...validResponse, summary: 'x'.repeat(2001) });
    expect(result.ok).toBe(false);
  });

  /**
   * The central guarantee: a model that invents a planetary position is
   * rejected. Every real figure already exists in the fact strings, so a degree
   * appearing in generated prose was manufactured.
   */
  it('rejects fabricated astronomy', () => {
    const fabricated = {
      ...validResponse,
      summary: 'Venus sits at 14° Gemini today, which softens the mood.',
    };
    const result = validateAiReading(fabricated);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('degree figure');
  });

  it('rejects a fabricated orb or illumination figure', () => {
    expect(validateAiReading({ ...validResponse, caution: 'with an orb of 2 degrees' }).ok).toBe(
      false,
    );
    expect(
      validateAiReading({ ...validResponse, reflection: 'The Moon is 63% illuminated.' }).ok,
    ).toBe(false);
  });

  it('rejects certainty and high-stakes advice', () => {
    expect(
      validateAiReading({ ...validResponse, summary: 'This will definitely resolve today.' }).ok,
    ).toBe(false);
    expect(
      validateAiReading({ ...validResponse, opportunity: 'You should invest in property.' }).ok,
    ).toBe(false);
    expect(
      validateAiReading({ ...validResponse, caution: 'Your relationship will fail.' }).ok,
    ).toBe(false);
  });

  it('screens the category notes as well as the main fields', () => {
    const result = validateAiReading({
      ...validResponse,
      categoryNotes: { finance: 'You should invest in crypto.' },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects wholesale rather than partially', () => {
    // A response that fabricated one figure is not trustworthy on the others.
    const result = validateAiReading({
      ...validResponse,
      summary: 'Mars is at 3° Aries.',
      headline: 'A perfectly fine headline',
    });
    expect(result.ok).toBe(false);
  });
});

describe('fallback behaviour', () => {
  /** The product must be fully usable with the AI layer switched off. */
  it('produces a complete reading with no model involvement', () => {
    const fallback = deterministicFallbackReading(reading);
    expect(fallback.headline.length).toBeGreaterThan(0);
    expect(fallback.summary.length).toBeGreaterThan(0);
    expect(fallback.opportunity.length).toBeGreaterThan(0);
    expect(fallback.caution.length).toBeGreaterThan(0);
    expect(fallback.reflection.length).toBeGreaterThan(0);
    expect(Object.keys(fallback.categoryNotes)).toHaveLength(7);
  });

  it('uses the model response when it validates', () => {
    const resolved = resolveReading(reading, validResponse);
    expect(resolved.source).toBe('ai');
    expect(resolved.value.headline).toBe(validResponse.headline);
    expect(resolved.errors).toEqual([]);
  });

  it('falls back and reports why when the response is rejected', () => {
    const resolved = resolveReading(reading, { ...validResponse, summary: 'Mars at 9° Leo.' });
    expect(resolved.source).toBe('deterministic');
    expect(resolved.errors.length).toBeGreaterThan(0);
    expect(resolved.value.headline).toBe(reading.headline);
  });

  it('falls back when the model returns nothing at all', () => {
    for (const response of [null, undefined, {}, '', []]) {
      const resolved = resolveReading(reading, response);
      expect(resolved.source).toBe('deterministic');
      expect(resolved.value.summary.length).toBeGreaterThan(0);
    }
  });
});
