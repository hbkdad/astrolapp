/**
 * Pythagorean numerology.
 *
 * The letter-to-number mapping is the standard A=1..I=9, J=1..R=9, S=1..Z=8
 * cycle. Where this system makes a choice that other traditions make
 * differently — component-wise Life Path reduction, master-number preservation,
 * the treatment of Y — the choice is documented at the point it is made.
 */

import { ENGINE_VERSIONS } from '@astrolapp/shared';
import { normalizeName } from './normalization.js';
import { reduceNumber, reductionTrace } from './reduction.js';
import {
  DEFAULT_NUMEROLOGY_CONFIG,
  type BirthDateInput,
  type NumerologyConfig,
  type NumerologyProfile,
  type NumerologySystem,
  type NumerologyValue,
  type PersonalCycles,
  type TraceStep,
} from './types.js';

/** Base vowels. Y is decided separately, per `YHandling`. */
const BASE_VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

/**
 * Pythagorean letter value: position in the alphabet, wrapped to 1..9.
 */
export function letterValue(letter: string): number {
  const code = letter.charCodeAt(0) - 'A'.charCodeAt(0);
  if (code < 0 || code > 25) {
    throw new RangeError(`letterValue expects an uppercase A-Z letter, received '${letter}'`);
  }
  return (code % 9) + 1;
}

/**
 * Decide whether the letter at `index` in `word` counts as a vowel.
 *
 * The contextual rule: Y is a vowel when it is not word-initial and the letter
 * before it is not itself a vowel. This makes MARY and BRYAN treat Y as a
 * vowel, and YOLANDA and MOYA treat it as a consonant.
 */
export function isVowel(word: string, index: number, config: NumerologyConfig): boolean {
  const letter = word[index];
  if (letter === undefined) return false;
  if (BASE_VOWELS.has(letter)) return true;
  if (letter !== 'Y') return false;

  switch (config.yHandling) {
    case 'always-vowel':
      return true;
    case 'always-consonant':
      return false;
    case 'contextual': {
      if (index === 0) return false;
      const previous = word[index - 1];
      return previous !== undefined && !BASE_VOWELS.has(previous);
    }
    default: {
      const exhaustive: never = config.yHandling;
      throw new RangeError(`Unknown Y handling: ${String(exhaustive)}`);
    }
  }
}

type LetterFilter = 'all' | 'vowels' | 'consonants';

/** Sum selected letters of a name, returning the total and a readable trace. */
function sumName(
  fullName: string,
  filter: LetterFilter,
  config: NumerologyConfig,
): { total: number; detail: string; unsupported: readonly string[] } {
  const normalized = normalizeName(fullName);
  const parts: string[] = [];
  let total = 0;

  for (const word of normalized.words) {
    for (let index = 0; index < word.length; index += 1) {
      const letter = word[index];
      if (letter === undefined) continue;

      const vowel = isVowel(word, index, config);
      if (filter === 'vowels' && !vowel) continue;
      if (filter === 'consonants' && vowel) continue;

      const value = letterValue(letter);
      total += value;
      parts.push(`${letter}=${value}`);
    }
  }

  return {
    total,
    detail: parts.length === 0 ? '(no qualifying letters)' : parts.join(' + '),
    unsupported: normalized.unsupportedCharacters,
  };
}

/**
 * Build a name-derived value.
 *
 * A name that normalizes to no usable letters yields zero with an explanatory
 * trace rather than a thrown error, so a profile can still be produced and the
 * UI can prompt for a Latin-script spelling.
 */
function nameValue(
  fullName: string,
  filter: LetterFilter,
  label: string,
  config: NumerologyConfig,
): NumerologyValue {
  const { total, detail, unsupported } = sumName(fullName, filter, config);
  const trace: TraceStep[] = [{ label: `${label} letter values`, detail, value: total }];

  if (unsupported.length > 0) {
    trace.push({
      label: 'Unsupported characters',
      detail: `Ignored: ${unsupported.join(' ')}`,
      value: 0,
    });
  }

  if (total === 0) {
    return { value: 0, isMasterNumber: false, trace };
  }

  const reduced = reduceNumber(total, config.masterNumbers);
  trace.push(reductionTrace('Reduce', reduced));
  return { value: reduced.value, isMasterNumber: reduced.isMasterNumber, trace };
}

function assertValidBirthDate(date: BirthDateInput): void {
  const { year, month, day } = date;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new RangeError('Birth date components must be integers');
  }
  if (month < 1 || month > 12) throw new RangeError(`Month out of range: ${month}`);
  if (day < 1 || day > 31) throw new RangeError(`Day out of range: ${day}`);
  if (year < 1) throw new RangeError(`Year out of range: ${year}`);
}

export class PythagoreanNumerology implements NumerologySystem {
  readonly id = 'pythagorean';
  readonly config: NumerologyConfig;

  constructor(config: Partial<NumerologyConfig> = {}) {
    this.config = { ...DEFAULT_NUMEROLOGY_CONFIG, ...config };
  }

  /** Master numbers to apply at intermediate steps, per configuration. */
  private get componentMasters(): NumerologyConfig['masterNumbers'] {
    return this.config.preserveMastersInComponents ? this.config.masterNumbers : [];
  }

  /**
   * Life Path by component reduction.
   *
   * Month, day and year are each reduced first, then summed and reduced again.
   * The alternative — summing all digits of the date in one pass — gives a
   * different answer for some dates, so the method is named in the trace to
   * make the difference visible rather than mysterious.
   */
  calculateLifePath(birthDate: BirthDateInput): NumerologyValue {
    assertValidBirthDate(birthDate);
    const masters = this.componentMasters;

    const month = reduceNumber(birthDate.month, masters);
    const day = reduceNumber(birthDate.day, masters);
    const year = reduceNumber(birthDate.year, masters);

    const total = month.value + day.value + year.value;
    const final = reduceNumber(total, this.config.masterNumbers);

    return {
      value: final.value,
      isMasterNumber: final.isMasterNumber,
      trace: [
        {
          label: 'Method',
          detail: 'Component reduction (month, day and year reduced separately)',
          value: 0,
        },
        reductionTrace('Month', month),
        reductionTrace('Day', day),
        reductionTrace('Year', year),
        {
          label: 'Sum of components',
          detail: `${month.value} + ${day.value} + ${year.value}`,
          value: total,
        },
        reductionTrace('Reduce', final),
      ],
    };
  }

  calculateExpression(fullName: string): NumerologyValue {
    return nameValue(fullName, 'all', 'All', this.config);
  }

  calculateSoulUrge(fullName: string): NumerologyValue {
    return nameValue(fullName, 'vowels', 'Vowel', this.config);
  }

  calculatePersonality(fullName: string): NumerologyValue {
    return nameValue(fullName, 'consonants', 'Consonant', this.config);
  }

  calculateBirthday(birthDate: BirthDateInput): NumerologyValue {
    assertValidBirthDate(birthDate);
    const reduced = reduceNumber(birthDate.day, this.config.masterNumbers);
    return {
      value: reduced.value,
      isMasterNumber: reduced.isMasterNumber,
      trace: [reductionTrace('Day of month', reduced)],
    };
  }

  /** Maturity: Life Path plus Expression, reduced. */
  calculateMaturity(birthDate: BirthDateInput, fullName: string): NumerologyValue {
    const lifePath = this.calculateLifePath(birthDate);
    const expression = this.calculateExpression(fullName);
    const total = lifePath.value + expression.value;
    const reduced = reduceNumber(total, this.config.masterNumbers);

    return {
      value: reduced.value,
      isMasterNumber: reduced.isMasterNumber,
      trace: [
        { label: 'Life Path', detail: String(lifePath.value), value: lifePath.value },
        { label: 'Expression', detail: String(expression.value), value: expression.value },
        { label: 'Sum', detail: `${lifePath.value} + ${expression.value}`, value: total },
        reductionTrace('Reduce', reduced),
      ],
    };
  }

  calculateProfile(birthDate: BirthDateInput, fullName: string): NumerologyProfile {
    return {
      lifePath: this.calculateLifePath(birthDate),
      expression: this.calculateExpression(fullName),
      soulUrge: this.calculateSoulUrge(fullName),
      personality: this.calculatePersonality(fullName),
      birthday: this.calculateBirthday(birthDate),
      maturity: this.calculateMaturity(birthDate, fullName),
      config: this.config,
      engineVersion: ENGINE_VERSIONS.numerology,
      systemId: this.id,
    };
  }

  /**
   * Personal Year, Month and Day.
   *
   * The Personal Year runs from the birthday, not from 1 January — a person
   * born in November is in their new Personal Year from November. `onDate` is
   * the calendar date being asked about.
   */
  calculatePersonalCycles(birthDate: BirthDateInput, onDate: BirthDateInput): PersonalCycles {
    assertValidBirthDate(birthDate);
    assertValidBirthDate(onDate);
    const masters = this.config.masterNumbers;

    // Before the birthday has come round, the previous Personal Year still runs.
    const birthdayHasPassed =
      onDate.month > birthDate.month ||
      (onDate.month === birthDate.month && onDate.day >= birthDate.day);
    const effectiveYear = birthdayHasPassed ? onDate.year : onDate.year - 1;

    const monthPart = reduceNumber(birthDate.month, this.componentMasters);
    const dayPart = reduceNumber(birthDate.day, this.componentMasters);
    const yearPart = reduceNumber(effectiveYear, this.componentMasters);

    const yearTotal = monthPart.value + dayPart.value + yearPart.value;
    const personalYear = reduceNumber(yearTotal, masters);

    const monthTotal = personalYear.value + onDate.month;
    const personalMonth = reduceNumber(monthTotal, masters);

    const dayTotal = personalMonth.value + onDate.day;
    const personalDay = reduceNumber(dayTotal, masters);

    return {
      personalYear: {
        value: personalYear.value,
        isMasterNumber: personalYear.isMasterNumber,
        trace: [
          {
            label: 'Cycle year',
            detail: birthdayHasPassed
              ? `Birthday has occurred in ${onDate.year}, so the cycle year is ${effectiveYear}`
              : `Birthday has not yet occurred in ${onDate.year}, so the cycle year is still ${effectiveYear}`,
            value: effectiveYear,
          },
          reductionTrace('Birth month', monthPart),
          reductionTrace('Birth day', dayPart),
          reductionTrace('Cycle year', yearPart),
          {
            label: 'Sum',
            detail: `${monthPart.value} + ${dayPart.value} + ${yearPart.value}`,
            value: yearTotal,
          },
          reductionTrace('Reduce', personalYear),
        ],
      },
      personalMonth: {
        value: personalMonth.value,
        isMasterNumber: personalMonth.isMasterNumber,
        trace: [
          {
            label: 'Sum',
            detail: `Personal Year ${personalYear.value} + month ${onDate.month}`,
            value: monthTotal,
          },
          reductionTrace('Reduce', personalMonth),
        ],
      },
      personalDay: {
        value: personalDay.value,
        isMasterNumber: personalDay.isMasterNumber,
        trace: [
          {
            label: 'Sum',
            detail: `Personal Month ${personalMonth.value} + day ${onDate.day}`,
            value: dayTotal,
          },
          reductionTrace('Reduce', personalDay),
        ],
      },
    };
  }
}
