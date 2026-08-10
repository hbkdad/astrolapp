import { describe, expect, it } from 'vitest';
import { ENGINE_VERSIONS, angularSeparation } from '@astrolapp/shared';
import { AstronomyEngineProvider } from './ephemeris/astronomy-engine-provider.js';
import { computeNatalChart, placementOf } from './natal.js';
import { houseOfLongitude } from './houses.js';
import { resolveLocalTimeToInstant } from './time.js';
import { computeTransits, findTransitWindow } from './transits.js';
import { MAJOR_ASPECTS } from './aspects.js';

const provider = new AstronomyEngineProvider();

const LONDON = { latitude: 51.5074, longitude: -0.1278 };

// A fixed reference chart: 15 May 1990, 14:30 local time in London.
const birthInstant = resolveLocalTimeToInstant(
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30 },
  'Europe/London',
).instant;

const chart = computeNatalChart(provider, {
  instant: birthInstant,
  coordinates: LONDON,
  houseSystem: 'placidus',
});

describe('natal chart', () => {
  it('places all ten default bodies', () => {
    expect(chart.placements).toHaveLength(10);
    expect(placementOf(chart, 'sun')).not.toBeNull();
    expect(placementOf(chart, 'pluto')).not.toBeNull();
    expect(placementOf(chart, 'northNode')).toBeNull();
  });

  it('puts the Sun in Taurus for a mid-May birth', () => {
    // The Sun is in Taurus from roughly 20 April to 20 May.
    expect(placementOf(chart, 'sun')?.position.sign).toBe('taurus');
  });

  it('agrees with the house lookup for every placement', () => {
    for (const placement of chart.placements) {
      expect(placement.house).toBe(houseOfLongitude(placement.longitude, chart.cusps));
      expect(placement.house).toBeGreaterThanOrEqual(1);
      expect(placement.house).toBeLessThanOrEqual(12);
    }
  });

  it('keeps each placement position consistent with its longitude', () => {
    for (const placement of chart.placements) {
      expect(placement.position.absoluteLongitude).toBeCloseTo(placement.longitude, 9);
    }
  });

  it('records every aspect it reports as genuinely within orb', () => {
    for (const { from, to, aspect } of chart.aspects) {
      const fromPlacement = placementOf(chart, from);
      const toPlacement = placementOf(chart, to);
      const separation = angularSeparation(fromPlacement!.longitude, toPlacement!.longitude);
      expect(separation).toBeCloseTo(aspect.actualAngle, 9);
      expect(aspect.orb).toBeLessThanOrEqual(aspect.maxOrb);
    }
  });

  it('reports each body pair at most once', () => {
    const seen = new Set<string>();
    for (const { from, to } of chart.aspects) {
      const key = [from, to].sort().join('-');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('never aspects a body with itself', () => {
    for (const { from, to } of chart.aspects) {
      expect(from).not.toBe(to);
    }
  });

  /** Reproducibility is the whole point of storing calculation metadata. */
  it('records everything needed to recompute the chart', () => {
    const metadata = chart.calculationMetadata;
    expect(metadata.ephemerisProvider).toBe('astronomy-engine');
    expect(metadata.astroEngineVersion).toBe(ENGINE_VERSIONS.astro);
    expect(metadata.houseSystem).toBe('placidus');
    expect(metadata.instant).toBe(birthInstant.toISOString());
    expect(metadata.coordinates).toEqual(LONDON);
    expect(metadata.bodies).toHaveLength(10);
  });

  it('produces identical results when recomputed from stored metadata', () => {
    const recomputed = computeNatalChart(provider, {
      instant: new Date(chart.calculationMetadata.instant),
      coordinates: chart.calculationMetadata.coordinates,
      houseSystem: chart.calculationMetadata.houseSystem,
      bodies: chart.calculationMetadata.bodies,
      orbs: chart.calculationMetadata.orbs,
    });

    expect(recomputed.placements).toEqual(chart.placements);
    expect(recomputed.angles).toEqual(chart.angles);
    expect(recomputed.aspects).toEqual(chart.aspects);
  });

  it('changes the ascendant substantially when the birth time shifts by an hour', () => {
    // ~15 degrees of ascendant per hour. This guards against a chart that
    // silently ignores the time component.
    const oneHourLater = computeNatalChart(provider, {
      instant: new Date(birthInstant.getTime() + 3_600_000),
      coordinates: LONDON,
    });
    const shift = angularSeparation(oneHourLater.angles.ascendant, chart.angles.ascendant);
    expect(shift).toBeGreaterThan(5);
  });

  it('supports whole-sign houses', () => {
    const wholeSign = computeNatalChart(provider, {
      instant: birthInstant,
      coordinates: LONDON,
      houseSystem: 'whole-sign',
    });
    expect(wholeSign.cusps[0]!.longitude % 30).toBeCloseTo(0, 9);
    expect(wholeSign.calculationMetadata.houseSystem).toBe('whole-sign');
  });
});

describe('transits', () => {
  const transitDate = new Date('2024-06-01T12:00:00Z');
  const events = computeTransits(provider, chart, transitDate);

  it('returns events sorted by descending strength', () => {
    for (let index = 1; index < events.length; index += 1) {
      expect(events[index]!.strength).toBeLessThanOrEqual(events[index - 1]!.strength);
    }
  });

  it('keeps every reported strength within 0..100', () => {
    for (const event of events) {
      expect(event.strength).toBeGreaterThanOrEqual(0);
      expect(event.strength).toBeLessThanOrEqual(100);
    }
  });

  /** A score nobody can decompose is a score nobody should trust. */
  it('exposes factors that reproduce the reported strength', () => {
    for (const event of events.slice(0, 10)) {
      const { transitingBodyWeight, natalTargetWeight, aspectWeight, orbStrength } =
        event.strengthFactors;
      const raw = transitingBodyWeight * natalTargetWeight * aspectWeight * orbStrength;
      // Normaliser for the default weights: 1.2 * 1.2 * 1.0.
      const expected = Math.round((raw / (1.2 * 1.2 * 1.0)) * 1000) / 10;
      expect(event.strength).toBeCloseTo(expected, 6);
    }
  });

  it('reports aspects that are genuinely within orb of the natal point', () => {
    for (const event of events) {
      const separation = angularSeparation(event.transitingLongitude, event.natalLongitude);
      expect(separation).toBeCloseTo(event.aspect.actualAngle, 9);
      expect(event.aspect.orb).toBeLessThanOrEqual(event.aspect.maxOrb);
    }
  });

  it('can target the chart angles as well as the bodies', () => {
    const targeted = computeTransits(provider, chart, transitDate, {
      targets: ['ascendant', 'midheaven'],
    });
    for (const event of targeted) {
      expect(['ascendant', 'midheaven']).toContain(event.natalTarget);
    }
  });

  it('finds no transits when every orb is zero', () => {
    expect(computeTransits(provider, chart, transitDate, { orbs: {} })).toEqual([]);
  });
});

describe('findTransitWindow', () => {
  it('locates an instant where the aspect is genuinely exact', () => {
    const natalSun = placementOf(chart, 'sun')!;
    const conjunction = MAJOR_ASPECTS.find((a) => a.type === 'conjunction')!;

    // The Sun returns to its natal degree once a year, near the birthday.
    const window = findTransitWindow(
      provider,
      'sun',
      natalSun.longitude,
      conjunction,
      new Date('2024-05-01T00:00:00Z'),
      new Date('2024-06-01T00:00:00Z'),
    );

    expect(window.exact).not.toBeNull();
    const separationAtExact = angularSeparation(
      provider.getBodyPosition('sun', window.exact!).longitude,
      natalSun.longitude,
    );
    // Bisection resolves to the minute; the Sun moves ~0.0007 deg/minute.
    expect(separationAtExact).toBeLessThan(0.01);
  });

  it('places the solar return within a few days of the birthday', () => {
    const natalSun = placementOf(chart, 'sun')!;
    const conjunction = MAJOR_ASPECTS.find((a) => a.type === 'conjunction')!;
    const window = findTransitWindow(
      provider,
      'sun',
      natalSun.longitude,
      conjunction,
      new Date('2024-05-01T00:00:00Z'),
      new Date('2024-06-01T00:00:00Z'),
    );
    expect(window.exact!.toISOString().slice(0, 7)).toBe('2024-05');
    expect(Math.abs(window.exact!.getUTCDate() - 15)).toBeLessThanOrEqual(2);
  });

  it('brackets the exact moment with orb entry and exit', () => {
    const natalSun = placementOf(chart, 'sun')!;
    const conjunction = MAJOR_ASPECTS.find((a) => a.type === 'conjunction')!;
    const window = findTransitWindow(
      provider,
      'sun',
      natalSun.longitude,
      conjunction,
      new Date('2024-04-20T00:00:00Z'),
      new Date('2024-06-10T00:00:00Z'),
    );

    expect(window.enteredOrb).not.toBeNull();
    expect(window.leftOrb).not.toBeNull();
    expect(window.enteredOrb!.getTime()).toBeLessThan(window.exact!.getTime());
    expect(window.leftOrb!.getTime()).toBeGreaterThan(window.exact!.getTime());
  });

  it('returns nulls when the aspect never perfects in the range', () => {
    const conjunction = MAJOR_ASPECTS.find((a) => a.type === 'conjunction')!;
    // Saturn moves ~0.03 deg/day, so it cannot reach a point 120 degrees away
    // within a single week.
    const saturn = provider.getBodyPosition('saturn', new Date('2024-01-01T00:00:00Z'));
    const window = findTransitWindow(
      provider,
      'saturn',
      saturn.longitude + 120,
      conjunction,
      new Date('2024-01-01T00:00:00Z'),
      new Date('2024-01-08T00:00:00Z'),
    );
    expect(window.exact).toBeNull();
  });
});
