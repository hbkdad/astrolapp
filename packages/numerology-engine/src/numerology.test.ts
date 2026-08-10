import { describe, expect, it } from 'vitest';
import { normalizeName } from './normalization.js';
import { digitSum, reduceNumber } from './reduction.js';
import { PythagoreanNumerology, isVowel, letterValue } from './pythagorean.js';
import { DEFAULT_NUMEROLOGY_CONFIG } from './types.js';

const system = new PythagoreanNumerology();

describe('normalizeName', () => {
  it('uppercases and splits on whitespace', () => {
    expect(normalizeName('John Smith').words).toEqual(['JOHN', 'SMITH']);
    expect(normalizeName('  john   smith  ').words).toEqual(['JOHN', 'SMITH']);
  });

  it('strips diacritics rather than dropping the letter', () => {
    expect(normalizeName('José').letters).toBe('JOSE');
    expect(normalizeName('Ångström').letters).toBe('ANGSTROM');
    expect(normalizeName('Renée Dupré').words).toEqual(['RENEE', 'DUPRE']);
    expect(normalizeName('Zoë').letters).toBe('ZOE');
  });

  it('treats hyphens and apostrophes as word separators', () => {
    expect(normalizeName('Ana-María').words).toEqual(['ANA', 'MARIA']);
    expect(normalizeName("O'Brien").words).toEqual(['O', 'BRIEN']);
    expect(normalizeName('Jean-Luc Picard').words).toEqual(['JEAN', 'LUC', 'PICARD']);
  });

  it('handles the curly apostrophe as well as the straight one', () => {
    expect(normalizeName('O’Brien').words).toEqual(['O', 'BRIEN']);
  });

  /**
   * A name in a non-Latin script must not silently reduce to a confident
   * number derived from an empty string.
   */
  it('reports characters it could not map', () => {
    const result = normalizeName('李明');
    expect(result.letters).toBe('');
    expect(result.unsupportedCharacters.length).toBeGreaterThan(0);
  });

  it('reports digits and symbols as unsupported', () => {
    const result = normalizeName('John Smith 3rd ★');
    expect(result.unsupportedCharacters).toContain('3');
    expect(result.unsupportedCharacters).toContain('★');
    expect(result.letters).toBe('JOHNSMITHRD');
  });

  it('preserves the original input', () => {
    expect(normalizeName('José').original).toBe('José');
  });

  it('handles the empty string without throwing', () => {
    expect(normalizeName('').words).toEqual([]);
  });

  it('rejects a non-string input', () => {
    // @ts-expect-error deliberately invalid input
    expect(() => normalizeName(null)).toThrow(TypeError);
  });
});

describe('letterValue', () => {
  it('follows the Pythagorean 1-9 cycle', () => {
    expect(letterValue('A')).toBe(1);
    expect(letterValue('I')).toBe(9);
    expect(letterValue('J')).toBe(1);
    expect(letterValue('R')).toBe(9);
    expect(letterValue('S')).toBe(1);
    expect(letterValue('Z')).toBe(8);
  });

  it('rejects anything outside A-Z', () => {
    expect(() => letterValue('a')).toThrow(RangeError);
    expect(() => letterValue('1')).toThrow(RangeError);
  });
});

describe('digit reduction', () => {
  it('sums digits', () => {
    expect(digitSum(0)).toBe(0);
    expect(digitSum(9)).toBe(9);
    expect(digitSum(1987)).toBe(25);
  });

  it('reduces to a single digit', () => {
    expect(reduceNumber(1987).value).toBe(7);
    expect(reduceNumber(9).value).toBe(9);
    expect(reduceNumber(10).value).toBe(1);
  });

  it('stops on master numbers', () => {
    expect(reduceNumber(29).value).toBe(11);
    expect(reduceNumber(29).isMasterNumber).toBe(true);
    expect(reduceNumber(2000).value).toBe(2);
    expect(reduceNumber(499).value).toBe(22);
    expect(reduceNumber(499).isMasterNumber).toBe(true);
  });

  it('preserves a master number supplied directly', () => {
    expect(reduceNumber(11).value).toBe(11);
    expect(reduceNumber(22).value).toBe(22);
    expect(reduceNumber(33).value).toBe(33);
  });

  it('reduces past master numbers when they are disabled', () => {
    expect(reduceNumber(29, []).value).toBe(2);
    expect(reduceNumber(11, []).value).toBe(2);
  });

  it('records every intermediate step', () => {
    expect(reduceNumber(1987).steps).toEqual([1987, 25, 7]);
  });

  it('rejects negative and fractional input', () => {
    expect(() => reduceNumber(-1)).toThrow(RangeError);
    expect(() => reduceNumber(1.5)).toThrow(RangeError);
  });
});

describe('Y handling', () => {
  const contextual = DEFAULT_NUMEROLOGY_CONFIG;

  it('treats Y as a vowel after a consonant', () => {
    expect(isVowel('MARY', 3, contextual)).toBe(true);
    expect(isVowel('BRYAN', 2, contextual)).toBe(true);
  });

  it('treats a word-initial Y as a consonant', () => {
    expect(isVowel('YOLANDA', 0, contextual)).toBe(false);
  });

  it('treats Y after a vowel as a consonant', () => {
    expect(isVowel('MOYA', 2, contextual)).toBe(false);
  });

  it('honours the fixed classification options', () => {
    expect(isVowel('YOLANDA', 0, { ...contextual, yHandling: 'always-vowel' })).toBe(true);
    expect(isVowel('MARY', 3, { ...contextual, yHandling: 'always-consonant' })).toBe(false);
  });

  it('changes the soul urge when the rule changes', () => {
    const alwaysVowel = new PythagoreanNumerology({ yHandling: 'always-vowel' });
    const alwaysConsonant = new PythagoreanNumerology({ yHandling: 'always-consonant' });
    expect(alwaysVowel.calculateSoulUrge('Mary Young').value).not.toBe(
      alwaysConsonant.calculateSoulUrge('Mary Young').value,
    );
  });
});

describe('Life Path', () => {
  /**
   * Worked by hand: 1990-05-15.
   * Month 5 -> 5. Day 15 -> 6. Year 1990 -> 19 -> 10 -> 1. Sum 5+6+1 = 12 -> 3.
   */
  it('matches a hand-worked example', () => {
    const result = system.calculateLifePath({ year: 1990, month: 5, day: 15 });
    expect(result.value).toBe(3);
    expect(result.isMasterNumber).toBe(false);
  });

  /**
   * 2000-11-29. Month 11 is a master and is preserved. Day 29 -> 11, also a
   * master. Year 2000 -> 2. Sum 11+11+2 = 24 -> 6.
   */
  it('preserves master numbers in the components', () => {
    const result = system.calculateLifePath({ year: 2000, month: 11, day: 29 });
    expect(result.value).toBe(6);
  });

  /**
   * 1989-11-02. Month 11 is preserved as a master. Day 2. Year 1989 -> 27 -> 9.
   * Sum 11 + 2 + 9 = 22, itself a master, so the Life Path is 22 rather than 4.
   */
  it('can yield a master number as the final value', () => {
    const result = system.calculateLifePath({ year: 1989, month: 11, day: 2 });
    expect(result.value).toBe(22);
    expect(result.isMasterNumber).toBe(true);
  });

  /**
   * Component master preservation only changes the outcome when the resulting
   * sum is itself a master number.
   *
   * Digit reduction preserves value modulo 9, and 11 = 2, 22 = 4, 33 = 6 in that
   * arithmetic — so stopping at a master mid-way cannot change the final single
   * digit. It changes the answer only when the total lands exactly on 11, 22 or
   * 33 in one configuration and reduces past it in the other. For 1989-11-02:
   * preserved gives 11+2+9 = 22; not preserved gives 2+2+9 = 13 -> 4.
   */
  it('changes the answer only when the sum itself lands on a master number', () => {
    const noMasters = new PythagoreanNumerology({ preserveMastersInComponents: false });
    const date = { year: 1989, month: 11, day: 2 };

    expect(system.calculateLifePath(date).value).toBe(22);
    expect(noMasters.calculateLifePath(date).value).toBe(4);
  });

  it('agrees between the two configurations when the sum is not a master', () => {
    const noMasters = new PythagoreanNumerology({ preserveMastersInComponents: false });
    const date = { year: 2000, month: 11, day: 29 };
    // 11+11+2 = 24 -> 6, and 2+2+2 = 6. Congruent modulo 9, so identical.
    expect(system.calculateLifePath(date).value).toBe(6);
    expect(noMasters.calculateLifePath(date).value).toBe(6);
  });

  it('explains its own method in the trace', () => {
    const result = system.calculateLifePath({ year: 1990, month: 5, day: 15 });
    expect(result.trace[0]!.detail).toContain('Component reduction');
    expect(result.trace.map((step) => step.label)).toContain('Year');
  });

  it('rejects impossible dates', () => {
    expect(() => system.calculateLifePath({ year: 1990, month: 13, day: 1 })).toThrow(RangeError);
    expect(() => system.calculateLifePath({ year: 1990, month: 1, day: 32 })).toThrow(RangeError);
    expect(() => system.calculateLifePath({ year: 1990, month: 1, day: 1.5 })).toThrow(RangeError);
  });
});

describe('name-derived numbers', () => {
  /**
   * Worked by hand for "JOHN SMITH".
   * J1 O6 H8 N5 = 20. S1 M4 I9 T2 H8 = 24. Total 44 -> 8.
   */
  it('matches a hand-worked expression number', () => {
    const result = system.calculateExpression('John Smith');
    expect(result.trace[0]!.value).toBe(44);
    expect(result.value).toBe(8);
  });

  /** Vowels of JOHN SMITH: O6, I9 = 15 -> 6. */
  it('matches a hand-worked soul urge', () => {
    const result = system.calculateSoulUrge('John Smith');
    expect(result.trace[0]!.value).toBe(15);
    expect(result.value).toBe(6);
  });

  /** Consonants of JOHN SMITH: J1 H8 N5 S1 M4 T2 H8 = 29 -> 11, a master. */
  it('matches a hand-worked personality number and keeps the master', () => {
    const result = system.calculatePersonality('John Smith');
    expect(result.trace[0]!.value).toBe(29);
    expect(result.value).toBe(11);
    expect(result.isMasterNumber).toBe(true);
  });

  it('keeps soul urge and personality summing to the expression before reduction', () => {
    const expression = system.calculateExpression('John Smith').trace[0]!.value;
    const soulUrge = system.calculateSoulUrge('John Smith').trace[0]!.value;
    const personality = system.calculatePersonality('John Smith').trace[0]!.value;
    expect(soulUrge + personality).toBe(expression);
  });

  it('gives accented and unaccented spellings the same value', () => {
    expect(system.calculateExpression('José').value).toBe(system.calculateExpression('Jose').value);
  });

  it('returns zero with an explanation for an unmappable name', () => {
    const result = system.calculateExpression('李明');
    expect(result.value).toBe(0);
    expect(result.trace.some((step) => step.label === 'Unsupported characters')).toBe(true);
  });

  it('is insensitive to input casing and extra spacing', () => {
    expect(system.calculateExpression('  jOhN   sMiTh ').value).toBe(
      system.calculateExpression('John Smith').value,
    );
  });
});

describe('profile and cycles', () => {
  const birthDate = { year: 1990, month: 5, day: 15 };

  it('assembles a full profile with version stamps', () => {
    const profile = system.calculateProfile(birthDate, 'John Smith');
    expect(profile.lifePath.value).toBe(3);
    expect(profile.expression.value).toBe(8);
    expect(profile.birthday.value).toBe(6);
    expect(profile.systemId).toBe('pythagorean');
    expect(profile.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  /** Maturity: Life Path 3 + Expression 8 = 11, a master number. */
  it('computes maturity from life path and expression', () => {
    const maturity = system.calculateMaturity(birthDate, 'John Smith');
    expect(maturity.value).toBe(11);
    expect(maturity.isMasterNumber).toBe(true);
  });

  /**
   * The Personal Year turns on the birthday, not on 1 January. For a 15 May
   * birthday, a date in March still belongs to the previous cycle year.
   */
  it('runs the personal year from the birthday', () => {
    const beforeBirthday = system.calculatePersonalCycles(birthDate, {
      year: 2024,
      month: 3,
      day: 1,
    });
    const afterBirthday = system.calculatePersonalCycles(birthDate, {
      year: 2024,
      month: 6,
      day: 1,
    });

    expect(beforeBirthday.personalYear.trace[0]!.value).toBe(2023);
    expect(afterBirthday.personalYear.trace[0]!.value).toBe(2024);
    expect(beforeBirthday.personalYear.value).not.toBe(afterBirthday.personalYear.value);
  });

  it('treats the birthday itself as the start of the new cycle', () => {
    const onBirthday = system.calculatePersonalCycles(birthDate, { year: 2024, month: 5, day: 15 });
    expect(onBirthday.personalYear.trace[0]!.value).toBe(2024);
  });

  it('keeps every cycle value in a valid range', () => {
    for (let month = 1; month <= 12; month += 1) {
      const cycles = system.calculatePersonalCycles(birthDate, { year: 2024, month, day: 15 });
      for (const value of [cycles.personalYear, cycles.personalMonth, cycles.personalDay]) {
        expect(value.value).toBeGreaterThanOrEqual(1);
        expect(value.value).toBeLessThanOrEqual(33);
      }
    }
  });

  it('provides a trace for every value it reports', () => {
    const cycles = system.calculatePersonalCycles(birthDate, { year: 2024, month: 6, day: 1 });
    expect(cycles.personalYear.trace.length).toBeGreaterThan(0);
    expect(cycles.personalMonth.trace.length).toBeGreaterThan(0);
    expect(cycles.personalDay.trace.length).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(system.calculateProfile(birthDate, 'John Smith')).toEqual(
      system.calculateProfile(birthDate, 'John Smith'),
    );
  });
});
