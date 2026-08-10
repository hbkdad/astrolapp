/**
 * Tropical zodiac: mapping ecliptic longitude onto the twelve 30-degree signs.
 */

import { normalizeDegrees, toDegreeMinuteSecond } from '@astrolapp/shared';

/** The twelve tropical signs in zodiacal order, starting at 0 degrees Aries. */
export const ZODIAC_SIGNS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const;

export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

/** Degrees of ecliptic longitude spanned by one sign. */
export const DEGREES_PER_SIGN = 30;

export type Element = 'fire' | 'earth' | 'air' | 'water';
export type Modality = 'cardinal' | 'fixed' | 'mutable';
export type Polarity = 'positive' | 'negative';

/** Position expressed in zodiacal terms. */
export interface ZodiacPosition {
  readonly sign: ZodiacSign;
  /** 0..11, the sign's index in `ZODIAC_SIGNS`. */
  readonly signIndex: number;
  /** Degrees within the sign, [0, 30). */
  readonly degreeInSign: number;
  /** Whole degrees within the sign, 0..29. */
  readonly degrees: number;
  /** Arcminutes, 0..59. */
  readonly minutes: number;
  /** Arcseconds, 0..59. */
  readonly seconds: number;
  /** The original ecliptic longitude, normalized to [0, 360). */
  readonly absoluteLongitude: number;
}

/**
 * Convert an ecliptic longitude to its zodiacal position.
 *
 * The input is normalized first, so out-of-range and negative values are
 * handled rather than producing a negative or out-of-bounds sign index.
 */
export function longitudeToZodiac(longitude: number): ZodiacPosition {
  const absoluteLongitude = normalizeDegrees(longitude);
  const signIndex = Math.floor(absoluteLongitude / DEGREES_PER_SIGN);
  const degreeInSign = absoluteLongitude - signIndex * DEGREES_PER_SIGN;

  const sign = ZODIAC_SIGNS[signIndex];
  if (sign === undefined) {
    // Unreachable given normalizeDegrees, but a wrong sign is worse than a throw.
    throw new RangeError(
      `longitudeToZodiac produced out-of-range sign index ${signIndex} for longitude ${longitude}`,
    );
  }

  const { degrees, minutes, seconds } = toDegreeMinuteSecond(degreeInSign);

  return {
    sign,
    signIndex,
    degreeInSign,
    degrees,
    minutes,
    seconds,
    absoluteLongitude,
  };
}

/** Starting longitude of a sign, e.g. Cancer -> 90. */
export function signStartLongitude(sign: ZodiacSign): number {
  return ZODIAC_SIGNS.indexOf(sign) * DEGREES_PER_SIGN;
}

/** Classical element of a sign. */
export function elementOf(sign: ZodiacSign): Element {
  const elements: readonly Element[] = ['fire', 'earth', 'air', 'water'];
  const element = elements[ZODIAC_SIGNS.indexOf(sign) % 4];
  if (element === undefined) throw new RangeError(`Unknown sign: ${sign}`);
  return element;
}

/** Classical modality (quadruplicity) of a sign. */
export function modalityOf(sign: ZodiacSign): Modality {
  const modalities: readonly Modality[] = ['cardinal', 'fixed', 'mutable'];
  const modality = modalities[ZODIAC_SIGNS.indexOf(sign) % 3];
  if (modality === undefined) throw new RangeError(`Unknown sign: ${sign}`);
  return modality;
}

/** Classical polarity of a sign. Fire and air are positive; earth and water negative. */
export function polarityOf(sign: ZodiacSign): Polarity {
  return ZODIAC_SIGNS.indexOf(sign) % 2 === 0 ? 'positive' : 'negative';
}

/** Human-readable position, e.g. `12°34' Leo`. */
export function formatZodiacPosition(position: ZodiacPosition): string {
  const sign = position.sign;
  const label = sign.charAt(0).toUpperCase() + sign.slice(1);
  const minutes = String(position.minutes).padStart(2, '0');
  return `${position.degrees}°${minutes}' ${label}`;
}
