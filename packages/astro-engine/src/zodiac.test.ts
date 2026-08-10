import { describe, expect, it } from 'vitest';
import {
  DEGREES_PER_SIGN,
  ZODIAC_SIGNS,
  elementOf,
  formatZodiacPosition,
  longitudeToZodiac,
  modalityOf,
  polarityOf,
  signStartLongitude,
} from './zodiac.js';

describe('longitudeToZodiac boundaries', () => {
  it('places exact sign starts in the correct sign', () => {
    for (let index = 0; index < 12; index += 1) {
      const result = longitudeToZodiac(index * DEGREES_PER_SIGN);
      expect(result.sign).toBe(ZODIAC_SIGNS[index]);
      expect(result.signIndex).toBe(index);
      expect(result.degreeInSign).toBeCloseTo(0, 10);
    }
  });

  // The last representable moment of a sign must not spill into the next one.
  it('keeps 29.999 degrees inside the same sign', () => {
    expect(longitudeToZodiac(29.999).sign).toBe('aries');
    expect(longitudeToZodiac(59.999).sign).toBe('taurus');
    expect(longitudeToZodiac(359.999).sign).toBe('pisces');
  });

  it('moves to the next sign at exactly 30 degrees', () => {
    expect(longitudeToZodiac(30).sign).toBe('taurus');
    expect(longitudeToZodiac(29.9999999999).sign).toBe('aries');
  });

  it('wraps 360 back to 0 degrees Aries', () => {
    const result = longitudeToZodiac(360);
    expect(result.sign).toBe('aries');
    expect(result.absoluteLongitude).toBe(0);
  });

  it('handles negative longitudes', () => {
    expect(longitudeToZodiac(-1).sign).toBe('pisces');
    expect(longitudeToZodiac(-1).degreeInSign).toBeCloseTo(29, 10);
    expect(longitudeToZodiac(-30).sign).toBe('pisces');
    expect(longitudeToZodiac(-30).degreeInSign).toBeCloseTo(0, 10);
  });

  it('always produces a valid sign index across the whole circle', () => {
    for (let longitude = 0; longitude < 360; longitude += 0.25) {
      const result = longitudeToZodiac(longitude);
      expect(result.signIndex).toBeGreaterThanOrEqual(0);
      expect(result.signIndex).toBeLessThan(12);
      expect(result.degreeInSign).toBeGreaterThanOrEqual(0);
      expect(result.degreeInSign).toBeLessThan(30);
    }
  });

  it('reports degrees, minutes and seconds within range', () => {
    const result = longitudeToZodiac(123.456789);
    expect(result.sign).toBe('leo');
    expect(result.degrees).toBeLessThan(30);
    expect(result.minutes).toBeLessThan(60);
    expect(result.seconds).toBeLessThan(60);
  });
});

describe('sign attributes', () => {
  it('maps signs to their starting longitude', () => {
    expect(signStartLongitude('aries')).toBe(0);
    expect(signStartLongitude('cancer')).toBe(90);
    expect(signStartLongitude('pisces')).toBe(330);
  });

  it('assigns the classical element cycle', () => {
    expect(elementOf('aries')).toBe('fire');
    expect(elementOf('taurus')).toBe('earth');
    expect(elementOf('gemini')).toBe('air');
    expect(elementOf('cancer')).toBe('water');
    expect(elementOf('pisces')).toBe('water');
  });

  it('assigns the classical modality cycle', () => {
    expect(modalityOf('aries')).toBe('cardinal');
    expect(modalityOf('taurus')).toBe('fixed');
    expect(modalityOf('gemini')).toBe('mutable');
    expect(modalityOf('capricorn')).toBe('cardinal');
  });

  it('alternates polarity', () => {
    expect(polarityOf('aries')).toBe('positive');
    expect(polarityOf('taurus')).toBe('negative');
  });
});

describe('formatZodiacPosition', () => {
  it('pads minutes to two digits', () => {
    expect(formatZodiacPosition(longitudeToZodiac(120 + 5 + 4 / 60))).toBe("5°04' Leo");
  });
});
