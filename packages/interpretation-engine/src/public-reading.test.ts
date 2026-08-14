import { describe, expect, it } from 'vitest';
import { ZODIAC_SIGNS, defaultEphemerisProvider as provider } from '@astrolapp/astro-engine';
import {
  computeAllSolarSignContexts,
  computeSolarSignContext,
  referenceInstantFor,
  solarHouseOf,
} from '@astrolapp/context-engine';
import { buildPublicHoroscope } from './public-reading.js';
import { findUnsupportedClaims } from './ai.js';
import { SOLAR_HOUSE_THEMES } from './content/solar-houses.js';

const DATE = new Date('2026-08-14T09:41:00Z');

describe('solar houses', () => {
  it('puts the reader own sign in the first house', () => {
    for (let index = 0; index < 12; index += 1) {
      expect(solarHouseOf(index, index)).toBe(1);
    }
  });

  it('counts whole signs forward, wrapping the zodiac', () => {
    // Aries reader (index 0): Taurus is the 2nd, Pisces the 12th.
    expect(solarHouseOf(1, 0)).toBe(2);
    expect(solarHouseOf(11, 0)).toBe(12);
    // Pisces reader (index 11): Aries is the 2nd.
    expect(solarHouseOf(0, 11)).toBe(2);
    expect(solarHouseOf(11, 11)).toBe(1);
  });

  it('always returns a house in 1..12', () => {
    for (let body = 0; body < 12; body += 1) {
      for (let reader = 0; reader < 12; reader += 1) {
        const house = solarHouseOf(body, reader);
        expect(house).toBeGreaterThanOrEqual(1);
        expect(house).toBeLessThanOrEqual(12);
      }
    }
  });

  it('describes all twelve houses', () => {
    expect(SOLAR_HOUSE_THEMES).toHaveLength(12);
    for (const [index, theme] of SOLAR_HOUSE_THEMES.entries()) {
      expect(theme.house).toBe(index + 1);
      expect(theme.description.length).toBeGreaterThan(60);
    }
  });
});

describe('solar sign context', () => {
  it('is computed at a fixed instant so a page is stable within its day', () => {
    const morning = computeSolarSignContext(provider, 'leo', new Date('2026-08-14T01:00:00Z'));
    const evening = computeSolarSignContext(provider, 'leo', new Date('2026-08-14T23:00:00Z'));
    expect(morning.instant).toBe(evening.instant);
    expect(morning).toEqual(evening);
    expect(referenceInstantFor(DATE).toISOString()).toBe('2026-08-14T12:00:00.000Z');
  });

  it('places every body in a solar house', () => {
    const context = computeSolarSignContext(provider, 'gemini', DATE);
    expect(context.placements).toHaveLength(10);
    for (const placement of context.placements) {
      expect(placement.solarHouse).toBeGreaterThanOrEqual(1);
      expect(placement.solarHouse).toBeLessThanOrEqual(12);
    }
  });

  it('reports the same sky positions to every sign', () => {
    const contexts = computeAllSolarSignContexts(provider, DATE);
    const reference = contexts[0]!;
    for (const context of contexts) {
      // The sky is shared; only the house framing differs.
      expect(context.placements.map((p) => p.longitude)).toEqual(
        reference.placements.map((p) => p.longitude),
      );
      expect(context.moon.phaseAngle).toBeCloseTo(reference.moon.phaseAngle, 9);
    }
  });

  it('excludes the Moon from the sky aspect list', () => {
    const context = computeSolarSignContext(provider, 'aries', DATE);
    for (const skyAspect of context.skyAspects) {
      expect(skyAspect.from).not.toBe('moon');
      expect(skyAspect.to).not.toBe('moon');
    }
  });

  it('orders sky aspects by tightness', () => {
    const { skyAspects } = computeSolarSignContext(provider, 'aries', DATE);
    for (let index = 1; index < skyAspects.length; index += 1) {
      expect(skyAspects[index]!.aspect.orb).toBeGreaterThanOrEqual(
        skyAspects[index - 1]!.aspect.orb,
      );
    }
  });
});

describe('public horoscope', () => {
  const horoscopes = ZODIAC_SIGNS.map((sign) =>
    buildPublicHoroscope(computeSolarSignContext(provider, sign, DATE)),
  );

  /**
   * The whole justification for twelve public pages: they must genuinely
   * differ. If the solar-house framing collapsed, this is the test that would
   * catch twelve near-identical pages — which is exactly the thin content the
   * brief prohibits.
   */
  it('produces twelve materially different readings', () => {
    const summaries = new Set(horoscopes.map((h) => h.summary));
    expect(summaries.size).toBe(12);

    const headlines = new Set(horoscopes.map((h) => h.headline));
    expect(headlines.size).toBeGreaterThan(1);

    // Each sign's own highlight text must differ from every other sign's.
    const highlightBlocks = new Set(
      horoscopes.map((h) => h.highlights.map((x) => x.interpretation).join('|')),
    );
    expect(highlightBlocks.size).toBe(12);
  });

  it('assigns each sign a different solar house for the same body', () => {
    const sunHouses = horoscopes.map(
      (h) => h.highlights.find((x) => x.key.startsWith('solar.sun.'))?.solarHouse,
    );
    expect(new Set(sunHouses).size).toBe(12);
  });

  it('keeps fact and interpretation separate everywhere', () => {
    for (const horoscope of horoscopes) {
      const items = [...horoscope.highlights, horoscope.moon, ...horoscope.skyAspects];
      for (const item of items) {
        expect(item.fact.length).toBeGreaterThan(0);
        expect(item.interpretation.length).toBeGreaterThan(0);
        expect(item.fact).not.toBe(item.interpretation);
      }
    }
  });

  /** Facts must be checkable, so they must contain real computed quantities. */
  it('states verifiable positions in the fact', () => {
    for (const horoscope of horoscopes) {
      for (const highlight of horoscope.highlights) {
        expect(highlight.fact).toMatch(/\d+°/u);
        expect(highlight.fact).toContain('solar house');
      }
    }
  });

  it('frames every interpretation as tradition', () => {
    for (const horoscope of horoscopes) {
      const items = [...horoscope.highlights, horoscope.moon, ...horoscope.skyAspects];
      for (const item of items) {
        expect(item.interpretation.toLowerCase()).toMatch(
          /tradition|traditionally|astrology|associated with|described as/,
        );
      }
    }
  });

  it('says plainly that sky aspects apply to everyone', () => {
    for (const horoscope of horoscopes) {
      for (const aspect of horoscope.skyAspects) {
        expect(aspect.fact).toContain('every sign');
      }
    }
  });

  const DATES = [
    new Date('2026-01-15T12:00:00Z'),
    new Date('2026-05-02T12:00:00Z'),
    new Date('2026-08-14T12:00:00Z'),
    new Date('2026-12-01T12:00:00Z'),
  ];

  /**
   * The claim screen exists to catch a language model MINTING numbers. It is
   * therefore applied to the interpretive prose, which must never contain a
   * figure at all.
   *
   * The summary is deliberately excluded: it is fact-bearing by design, and
   * stating a real computed illumination is the product's whole argument. Its
   * numbers are checked for CORRECTNESS in the next test instead, which is a
   * stronger guarantee than pattern-matching their absence.
   */
  it('keeps interpretive prose free of invented figures, across every sign and date', () => {
    for (const date of DATES) {
      for (const sign of ZODIAC_SIGNS) {
        const horoscope = buildPublicHoroscope(computeSolarSignContext(provider, sign, date));
        const interpretiveProse = [
          ...horoscope.highlights.map((h) => h.interpretation),
          horoscope.moon.interpretation,
          ...horoscope.skyAspects.map((a) => a.interpretation),
        ];
        for (const text of interpretiveProse) {
          expect(findUnsupportedClaims(text), `${sign} on ${date.toISOString()}: ${text}`).toEqual(
            [],
          );
        }
      }
    }
  });

  /**
   * Every figure the summary states must match what was actually computed.
   * Printing a real-looking number is worthless if the number is wrong.
   */
  it('states figures in the summary that match the computed context', () => {
    for (const date of DATES) {
      for (const sign of ZODIAC_SIGNS) {
        const context = computeSolarSignContext(provider, sign, date);
        const horoscope = buildPublicHoroscope(context);

        const illumination = horoscope.summary.match(/(\d+)% lit/u);
        expect(illumination, `no illumination figure for ${sign}`).not.toBeNull();
        expect(Number(illumination?.[1])).toBe(Math.round(context.moon.illumination * 100));

        // The named Moon sign and solar house must be the computed ones.
        expect(horoscope.summary).toContain(
          context.moon.position.sign.charAt(0).toUpperCase() + context.moon.position.sign.slice(1),
        );
        expect(horoscope.moonSolarHouse).toBe(context.moonSolarHouse);

        // Retrogrades listed must be exactly those computed.
        for (const body of context.retrogrades) {
          expect(horoscope.retrogrades).toContain(body.charAt(0).toUpperCase() + body.slice(1));
        }
        expect(horoscope.retrogrades).toHaveLength(context.retrogrades.length);
      }
    }
  });

  it('carries the disclaimer and the sign classification', () => {
    for (const horoscope of horoscopes) {
      expect(horoscope.disclaimer).toContain('not established science');
      expect(['fire', 'earth', 'air', 'water']).toContain(horoscope.element);
      expect(['cardinal', 'fixed', 'mutable']).toContain(horoscope.modality);
    }
  });

  it('is deterministic', () => {
    const first = buildPublicHoroscope(computeSolarSignContext(provider, 'virgo', DATE));
    const second = buildPublicHoroscope(computeSolarSignContext(provider, 'virgo', DATE));
    expect(first).toEqual(second);
  });
});
