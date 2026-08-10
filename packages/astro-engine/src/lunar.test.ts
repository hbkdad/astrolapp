import { describe, expect, it } from 'vitest';
import { AstronomyEngineProvider } from './ephemeris/astronomy-engine-provider.js';
import { LUNAR_FIXTURES } from './ephemeris/fixtures.js';
import {
  MOON_PHASES,
  classifyMoonPhase,
  computeLunarState,
  computePhaseAngle,
  computeUpcomingLunations,
  findNextMoonSignIngress,
  findPreviousNewMoon,
} from './lunar.js';

const provider = new AstronomyEngineProvider();

describe('classifyMoonPhase', () => {
  it('names each canonical phase angle', () => {
    expect(classifyMoonPhase(0)).toBe('new-moon');
    expect(classifyMoonPhase(45)).toBe('waxing-crescent');
    expect(classifyMoonPhase(90)).toBe('first-quarter');
    expect(classifyMoonPhase(135)).toBe('waxing-gibbous');
    expect(classifyMoonPhase(180)).toBe('full-moon');
    expect(classifyMoonPhase(225)).toBe('waning-gibbous');
    expect(classifyMoonPhase(270)).toBe('third-quarter');
    expect(classifyMoonPhase(315)).toBe('waning-crescent');
  });

  // The New Moon band straddles the 0/360 seam, which is the one case a naive
  // interval comparison gets wrong.
  it('keeps the new moon band continuous across the seam', () => {
    expect(classifyMoonPhase(350)).toBe('new-moon');
    expect(classifyMoonPhase(359.999)).toBe('new-moon');
    expect(classifyMoonPhase(360)).toBe('new-moon');
    expect(classifyMoonPhase(10)).toBe('new-moon');
  });

  it('switches phase at the band midpoints', () => {
    expect(classifyMoonPhase(22.4)).toBe('new-moon');
    expect(classifyMoonPhase(22.6)).toBe('waxing-crescent');
    expect(classifyMoonPhase(157.4)).toBe('waxing-gibbous');
    expect(classifyMoonPhase(157.6)).toBe('full-moon');
  });

  it('returns a valid phase for every angle on the circle', () => {
    for (let angle = 0; angle < 360; angle += 0.25) {
      expect(MOON_PHASES).toContain(classifyMoonPhase(angle));
    }
  });

  it('normalizes out-of-range and negative angles', () => {
    expect(classifyMoonPhase(-90)).toBe('third-quarter');
    expect(classifyMoonPhase(450)).toBe('first-quarter');
  });
});

describe('phase angle against published lunations', () => {
  it.each(LUNAR_FIXTURES)('matches $label', ({ instant, phaseAngle }) => {
    const computed = computePhaseAngle(provider, new Date(instant));
    // Compare on the circle so a New Moon reading of 359.99 counts as 0.
    const difference = Math.min(
      Math.abs(computed - phaseAngle),
      360 - Math.abs(computed - phaseAngle),
    );
    // The Moon's elongation changes ~12.2 deg/day, so a published time rounded
    // to the minute admits roughly 0.01 degrees of slack.
    expect(difference).toBeLessThan(0.05);
  });

  it('names the phase correctly at a published Full Moon', () => {
    const state = computeLunarState(provider, new Date('2024-01-25T17:54:00Z'));
    expect(state.phase).toBe('full-moon');
    expect(state.illumination).toBeGreaterThan(0.99);
    expect(state.waxing).toBe(false);
  });

  it('names the phase correctly at a published New Moon', () => {
    const state = computeLunarState(provider, new Date('2024-01-11T11:57:00Z'));
    expect(state.phase).toBe('new-moon');
    expect(state.illumination).toBeLessThan(0.01);
  });
});

describe('lunar state', () => {
  it('reports a moon age within one synodic month', () => {
    for (let day = 0; day < 60; day += 3) {
      const date = new Date(Date.UTC(2024, 0, 1) + day * 86_400_000);
      const state = computeLunarState(provider, date);
      expect(state.ageDays).toBeGreaterThanOrEqual(0);
      expect(state.ageDays).toBeLessThan(29.6);
    }
  });

  it('reports an age near zero at a New Moon', () => {
    const state = computeLunarState(provider, new Date('2024-01-11T12:05:00Z'));
    expect(state.ageDays).toBeLessThan(0.02);
  });

  it('reports an age near half a month at a Full Moon', () => {
    const state = computeLunarState(provider, new Date('2024-01-25T17:54:00Z'));
    expect(state.ageDays).toBeGreaterThan(13.5);
    expect(state.ageDays).toBeLessThan(16);
  });

  it('places the moon in a sign consistent with its longitude', () => {
    const state = computeLunarState(provider, new Date('2024-05-01T00:00:00Z'));
    expect(state.position.absoluteLongitude).toBeCloseTo(state.moonLongitude, 9);
  });

  it('finds the previous new moon at or before the requested instant', () => {
    const date = new Date('2024-01-20T00:00:00Z');
    const previous = findPreviousNewMoon(provider, date);
    expect(previous.getTime()).toBeLessThanOrEqual(date.getTime());
    expect(Math.abs(previous.getTime() - new Date('2024-01-11T11:57:00Z').getTime())).toBeLessThan(
      2 * 60_000,
    );
  });
});

describe('upcoming lunations', () => {
  it('returns four future events in the right order relative to now', () => {
    const date = new Date('2024-03-01T00:00:00Z');
    const upcoming = computeUpcomingLunations(provider, date);
    const events: Date[] = [
      upcoming.nextNewMoon,
      upcoming.nextFirstQuarter,
      upcoming.nextFullMoon,
      upcoming.nextThirdQuarter,
    ];
    for (const event of events) {
      expect(event.getTime()).toBeGreaterThan(date.getTime());
      expect(event.getTime() - date.getTime()).toBeLessThan(45 * 86_400_000);
    }
  });

  it('finds the March 2024 full moon', () => {
    // Full Moon 25 March 2024 07:00 UTC.
    const upcoming = computeUpcomingLunations(provider, new Date('2024-03-20T00:00:00Z'));
    const difference = Math.abs(
      upcoming.nextFullMoon.getTime() - new Date('2024-03-25T07:00:00Z').getTime(),
    );
    expect(difference).toBeLessThan(5 * 60_000);
  });
});

describe('moon sign ingress', () => {
  it('finds a sign change within the next three days', () => {
    const from = new Date('2024-06-01T00:00:00Z');
    const ingress = findNextMoonSignIngress(provider, from);
    expect(ingress.enteredAt.getTime()).toBeGreaterThan(from.getTime());
    // The Moon spends ~2.3 days per sign.
    expect(ingress.enteredAt.getTime() - from.getTime()).toBeLessThan(3 * 86_400_000);
  });

  it('reports the sign the moon is actually in just after the ingress', () => {
    const ingress = findNextMoonSignIngress(provider, new Date('2024-06-01T00:00:00Z'));
    const justAfter = new Date(ingress.enteredAt.getTime() + 60_000);
    const state = computeLunarState(provider, justAfter);
    expect(state.position.sign).toBe(ingress.sign);
  });
});
