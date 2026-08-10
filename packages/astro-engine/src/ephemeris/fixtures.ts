/**
 * Reference fixtures for validating the ephemeris.
 *
 * These are published astronomical events, not values produced by this codebase.
 * That distinction matters: a fixture generated from our own output would only
 * prove the code is self-consistent, not that it is correct.
 *
 * Source: equinox, solstice and lunar phase times as published for 2024 UTC.
 * Published times are rounded to the minute, so tolerances below are sized to
 * absorb that rounding and nothing more.
 *
 * NEVER loosen a tolerance to make a failing test pass. A widening tolerance is
 * evidence of a real regression somewhere in the calculation chain.
 */

/** An instant at which the Sun reaches a known ecliptic longitude. */
export interface SolarFixture {
  readonly label: string;
  readonly instant: string;
  readonly expectedSunLongitude: number;
  /** Allowed error in degrees. The Sun moves ~0.00068 deg per minute. */
  readonly toleranceDegrees: number;
}

export const SOLAR_FIXTURES: readonly SolarFixture[] = [
  {
    label: 'March equinox 2024',
    instant: '2024-03-20T03:06:00Z',
    expectedSunLongitude: 0,
    toleranceDegrees: 0.01,
  },
  {
    label: 'June solstice 2024',
    instant: '2024-06-20T20:51:00Z',
    expectedSunLongitude: 90,
    toleranceDegrees: 0.01,
  },
  {
    label: 'September equinox 2024',
    instant: '2024-09-22T12:44:00Z',
    expectedSunLongitude: 180,
    toleranceDegrees: 0.01,
  },
  {
    label: 'December solstice 2024',
    instant: '2024-12-21T09:21:00Z',
    expectedSunLongitude: 270,
    toleranceDegrees: 0.01,
  },
];

/** An instant at which the Moon reaches a known elongation from the Sun. */
export interface LunarFixture {
  readonly label: string;
  readonly instant: string;
  /** 0 = New Moon, 180 = Full Moon. */
  readonly phaseAngle: number;
  /** Allowed error when searching for the event, in minutes. */
  readonly toleranceMinutes: number;
}

export const LUNAR_FIXTURES: readonly LunarFixture[] = [
  {
    label: 'New Moon 2024-01-11',
    instant: '2024-01-11T11:57:00Z',
    phaseAngle: 0,
    toleranceMinutes: 2,
  },
  {
    label: 'Full Moon 2024-01-25',
    instant: '2024-01-25T17:54:00Z',
    phaseAngle: 180,
    toleranceMinutes: 2,
  },
  {
    label: 'New Moon 2024-12-01',
    instant: '2024-12-01T06:21:00Z',
    phaseAngle: 0,
    toleranceMinutes: 2,
  },
  {
    label: 'Full Moon 2024-12-15',
    instant: '2024-12-15T09:02:00Z',
    phaseAngle: 180,
    toleranceMinutes: 2,
  },
];

/**
 * Known retrograde and direct intervals, used to check that the sign of the
 * numerically differentiated longitude speed is right.
 */
export interface MotionFixture {
  readonly label: string;
  readonly body: 'mercury' | 'venus' | 'mars';
  readonly instant: string;
  readonly retrograde: boolean;
}

export const MOTION_FIXTURES: readonly MotionFixture[] = [
  // Mercury retrograde periods in 2024: 1-25 Apr, 5-28 Aug, 26 Nov - 15 Dec.
  {
    label: 'Mercury mid-April 2024',
    body: 'mercury',
    instant: '2024-04-15T00:00:00Z',
    retrograde: true,
  },
  {
    label: 'Mercury mid-August 2024',
    body: 'mercury',
    instant: '2024-08-15T00:00:00Z',
    retrograde: true,
  },
  {
    label: 'Mercury mid-June 2024',
    body: 'mercury',
    instant: '2024-06-15T00:00:00Z',
    retrograde: false,
  },
  // Mars was direct throughout 2024 until its 6 Dec station.
  { label: 'Mars mid-2024', body: 'mars', instant: '2024-07-01T00:00:00Z', retrograde: false },
];
