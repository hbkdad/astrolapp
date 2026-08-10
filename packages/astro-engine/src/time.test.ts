import { describe, expect, it } from 'vitest';
import { assertValidTimeZone, resolveLocalTimeToInstant } from './time.js';

describe('resolveLocalTimeToInstant', () => {
  it('converts a straightforward winter time', () => {
    const resolved = resolveLocalTimeToInstant(
      { year: 1990, month: 1, day: 15, hour: 14, minute: 30 },
      'Europe/London',
    );
    expect(resolved.instant.toISOString()).toBe('1990-01-15T14:30:00.000Z');
    expect(resolved.offsetMinutes).toBe(0);
    expect(resolved.kind).toBe('unique');
  });

  it('applies British Summer Time in summer', () => {
    const resolved = resolveLocalTimeToInstant(
      { year: 1990, month: 7, day: 15, hour: 14, minute: 30 },
      'Europe/London',
    );
    expect(resolved.instant.toISOString()).toBe('1990-07-15T13:30:00.000Z');
    expect(resolved.offsetMinutes).toBe(60);
  });

  it('applies a negative offset west of Greenwich', () => {
    const resolved = resolveLocalTimeToInstant(
      { year: 2024, month: 1, day: 15, hour: 9, minute: 0 },
      'America/New_York',
    );
    expect(resolved.instant.toISOString()).toBe('2024-01-15T14:00:00.000Z');
    expect(resolved.offsetMinutes).toBe(-300);
  });

  it('handles a half-hour offset zone', () => {
    const resolved = resolveLocalTimeToInstant(
      { year: 2024, month: 3, day: 1, hour: 12, minute: 0 },
      'Asia/Kolkata',
    );
    expect(resolved.offsetMinutes).toBe(330);
    expect(resolved.instant.toISOString()).toBe('2024-03-01T06:30:00.000Z');
  });

  /**
   * A birth recorded at 01:30 on a fall-back night happened at one of two real
   * instants roughly an hour apart. That is a genuine ~15 degree ascendant
   * ambiguity and the user has to be told, not quietly given one of the two.
   */
  it('flags an ambiguous local time during a daylight-saving fall-back', () => {
    // US clocks went back at 02:00 local on 3 November 2024.
    const resolved = resolveLocalTimeToInstant(
      { year: 2024, month: 11, day: 3, hour: 1, minute: 30 },
      'America/New_York',
    );
    expect(resolved.kind).toBe('ambiguous');
    // The earlier of the two instants is chosen, i.e. still on daylight time.
    expect(resolved.offsetMinutes).toBe(-240);
    expect(resolved.instant.toISOString()).toBe('2024-11-03T05:30:00.000Z');
  });

  it('flags a local time that never existed during a spring-forward gap', () => {
    // US clocks jumped 02:00 -> 03:00 local on 10 March 2024.
    const resolved = resolveLocalTimeToInstant(
      { year: 2024, month: 3, day: 10, hour: 2, minute: 30 },
      'America/New_York',
    );
    expect(resolved.kind).toBe('nonexistent');
  });

  it('resolves times just outside a transition as unique', () => {
    expect(
      resolveLocalTimeToInstant(
        { year: 2024, month: 3, day: 10, hour: 1, minute: 0 },
        'America/New_York',
      ).kind,
    ).toBe('unique');
    expect(
      resolveLocalTimeToInstant(
        { year: 2024, month: 3, day: 10, hour: 4, minute: 0 },
        'America/New_York',
      ).kind,
    ).toBe('unique');
  });

  it('handles a southern-hemisphere zone whose summer time spans the new year', () => {
    const resolved = resolveLocalTimeToInstant(
      { year: 2024, month: 1, day: 15, hour: 12, minute: 0 },
      'Australia/Sydney',
    );
    expect(resolved.offsetMinutes).toBe(660);
    expect(resolved.instant.toISOString()).toBe('2024-01-15T01:00:00.000Z');
  });

  it('honours historical offsets rather than assuming the modern rule', () => {
    // India moved to a single +05:30 zone long before 1950; a naive fixed-offset
    // implementation using today's rules would still pass, so this mainly guards
    // against a zone lookup that ignores the requested date entirely.
    const resolved = resolveLocalTimeToInstant(
      { year: 1950, month: 6, day: 1, hour: 12, minute: 0 },
      'Asia/Kolkata',
    );
    expect(resolved.offsetMinutes).toBe(330);
  });

  it('rejects an unknown time zone', () => {
    expect(() =>
      resolveLocalTimeToInstant(
        { year: 2024, month: 1, day: 1, hour: 0, minute: 0 },
        'Mars/Olympus',
      ),
    ).toThrow(RangeError);
    expect(() => {
      assertValidTimeZone('Not/AZone');
    }).toThrow(RangeError);
  });

  it('accepts UTC and seconds', () => {
    const resolved = resolveLocalTimeToInstant(
      { year: 2024, month: 6, day: 1, hour: 8, minute: 5, second: 30 },
      'UTC',
    );
    expect(resolved.instant.toISOString()).toBe('2024-06-01T08:05:30.000Z');
  });
});
