/**
 * Content safety.
 *
 * The product's claims rules are not left to reviewer discipline — they are
 * enforced here, mechanically, across every piece of user-facing text the
 * system can emit: hand-written content, composed interpretations, and
 * AI output alike.
 *
 * A failure in this file means the product is about to tell a user something it
 * has no business telling them.
 */

import { describe, expect, it } from 'vitest';
import {
  computeNatalChart,
  computeTransits,
  defaultEphemerisProvider as provider,
  resolveLocalTimeToInstant,
  ZODIAC_SIGNS,
  MOON_PHASES,
} from '@astrolapp/astro-engine';
import { PythagoreanNumerology } from '@astrolapp/numerology-engine';
import { computeDailyContext } from '@astrolapp/context-engine';
import { findUnsupportedClaims } from './ai.js';
import { MOON_PHASE_ENTRIES, moonSignEntry } from './content/moon.js';
import { SPECIFIC_TRANSIT_ENTRIES } from './content/specific-transits.js';
import {
  lifePathEntry,
  personalDayEntry,
  personalMonthEntry,
  personalYearEntry,
} from './content/numerology.js';
import { ASPECT_THEMES, NATAL_TARGET_THEMES, TRANSITING_BODY_THEMES } from './content/themes.js';
import { interpretTransit } from './interpret.js';
import { buildDailyReading, READING_DISCLAIMER } from './reading.js';

const birth = resolveLocalTimeToInstant(
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30 },
  'Europe/London',
).instant;
const chart = computeNatalChart(provider, {
  instant: birth,
  coordinates: { latitude: 51.5074, longitude: -0.1278 },
});

/** Every hand-written string the content library can surface. */
function allAuthoredContent(): { label: string; text: string }[] {
  const entries: { label: string; text: string }[] = [];

  for (const [phase, entry] of Object.entries(MOON_PHASE_ENTRIES)) {
    entries.push({ label: `moon phase ${phase}`, text: `${entry.title} ${entry.body}` });
  }
  for (const sign of ZODIAC_SIGNS) {
    const entry = moonSignEntry(sign);
    entries.push({ label: `moon sign ${sign}`, text: `${entry.title} ${entry.body}` });
  }
  for (const [key, entry] of Object.entries(SPECIFIC_TRANSIT_ENTRIES)) {
    entries.push({ label: `specific ${key}`, text: `${entry.title} ${entry.body}` });
  }
  for (const value of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]) {
    for (const [kind, build] of [
      ['life-path', lifePathEntry],
      ['personal-year', personalYearEntry],
      ['personal-month', personalMonthEntry],
      ['personal-day', personalDayEntry],
    ] as const) {
      const entry = build(value);
      entries.push({ label: `${kind} ${value}`, text: `${entry.title} ${entry.body}` });
    }
  }
  for (const [body, theme] of Object.entries(TRANSITING_BODY_THEMES)) {
    entries.push({ label: `body theme ${body}`, text: `${theme.principle} ${theme.action}` });
  }
  for (const [target, theme] of Object.entries(NATAL_TARGET_THEMES)) {
    entries.push({ label: `target theme ${target}`, text: `${theme.principle} ${theme.action}` });
  }
  for (const [aspect, theme] of Object.entries(ASPECT_THEMES)) {
    entries.push({ label: `aspect theme ${aspect}`, text: theme.quality });
  }

  return entries;
}

describe('authored content', () => {
  it('contains no prohibited claims anywhere', () => {
    for (const { label, text } of allAuthoredContent()) {
      expect(findUnsupportedClaims(text), `in ${label}: "${text.slice(0, 90)}..."`).toEqual([]);
    }
  });

  /**
   * Absolute language is the specific failure mode to avoid: astrology copy
   * drifts easily from "is traditionally associated with" into "you will".
   */
  it('avoids second-person predictive phrasing', () => {
    const predictive = /\byou will\b|\bthis will happen\b|\bexpect to receive\b/iu;
    for (const { label, text } of allAuthoredContent()) {
      expect(predictive.test(text), `in ${label}`).toBe(false);
    }
  });

  it('covers every moon phase and every zodiac sign', () => {
    for (const phase of MOON_PHASES) {
      expect(MOON_PHASE_ENTRIES[phase].body.length).toBeGreaterThan(40);
    }
    for (const sign of ZODIAC_SIGNS) {
      expect(moonSignEntry(sign).body.length).toBeGreaterThan(40);
    }
  });

  it('covers the single digits and the master numbers', () => {
    for (const value of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]) {
      expect(lifePathEntry(value).body).not.toContain('unlisted');
      expect(personalYearEntry(value).body).not.toContain('unlisted');
    }
  });

  it('keys every specific entry to its own map key', () => {
    for (const [key, entry] of Object.entries(SPECIFIC_TRANSIT_ENTRIES)) {
      expect(entry.key).toBe(key);
      expect(key.startsWith('transit.')).toBe(true);
    }
  });
});

describe('generated output', () => {
  const dates = [
    new Date('2026-01-15T12:00:00Z'),
    new Date('2026-04-01T12:00:00Z'),
    new Date('2026-08-09T12:00:00Z'),
    new Date('2026-11-20T12:00:00Z'),
  ];

  /**
   * Sweeping several dates exercises many different transit combinations, and
   * therefore many different composed sentences, rather than only the handful
   * active on one arbitrary day.
   */
  it('produces no prohibited claims across a spread of dates', () => {
    for (const date of dates) {
      const context = computeDailyContext(provider, {
        chart,
        date,
        numerology: {
          system: new PythagoreanNumerology(),
          birthDate: { year: 1990, month: 5, day: 15 },
          fullName: 'John Smith',
        },
      });
      const reading = buildDailyReading(context);

      const surfaces = [
        reading.headline,
        reading.summary,
        reading.overallBand,
        ...reading.categories.map((category) => `${category.band} ${category.explanation}`),
        ...reading.transits.map((item) => item.interpretation),
        reading.moonPhase.interpretation,
        reading.moonSign.interpretation,
        ...reading.numerology.map((item) => item.interpretation),
      ];

      for (const surface of surfaces) {
        expect(findUnsupportedClaims(surface), `on ${date.toISOString()}: "${surface}"`).toEqual(
          [],
        );
      }
    }
  });

  /**
   * Fact strings legitimately contain degree figures — they are the computed
   * values. The claim screen exists for GENERATED prose, so this documents the
   * boundary rather than accidentally forbidding real data.
   */
  it('allows degree figures in facts, which are computed values', () => {
    const event = computeTransits(provider, chart, dates[2]!)[0]!;
    const { fact } = interpretTransit(event);
    expect(fact).toMatch(/\d+°/u);
    expect(findUnsupportedClaims(fact).length).toBeGreaterThan(0);
  });

  it('always attaches the disclaimer', () => {
    for (const date of dates) {
      const reading = buildDailyReading(computeDailyContext(provider, { chart, date }));
      expect(reading.disclaimer).toBe(READING_DISCLAIMER);
    }
  });
});

describe('claim detection itself', () => {
  it('flags fabricated astronomy', () => {
    expect(findUnsupportedClaims('Mars sits at 12° Leo today.').length).toBeGreaterThan(0);
    expect(findUnsupportedClaims('with an orb of 3 degrees').length).toBeGreaterThan(0);
    expect(findUnsupportedClaims('the Moon is 87% illuminated').length).toBeGreaterThan(0);
  });

  it('flags certainty and high-stakes advice', () => {
    expect(findUnsupportedClaims('This will definitely happen.').length).toBeGreaterThan(0);
    expect(findUnsupportedClaims('You should invest in property now.').length).toBeGreaterThan(0);
    expect(findUnsupportedClaims('Stop taking your medication.').length).toBeGreaterThan(0);
    expect(findUnsupportedClaims('Your relationship will fail.').length).toBeGreaterThan(0);
    expect(findUnsupportedClaims('Astrology is scientifically proven.').length).toBeGreaterThan(0);
  });

  it('passes ordinary interpretive language', () => {
    expect(
      findUnsupportedClaims(
        'Astrology traditionally reads this contact as a period that rewards patience.',
      ),
    ).toEqual([]);
  });
});
