/**
 * Numerology domain types.
 *
 * Numerology traditions disagree with each other on reduction rules, on how the
 * letter Y is treated, and on whether master numbers survive intermediate
 * steps. None of those choices is "correct" in any external sense, so every one
 * of them is explicit configuration rather than a constant buried in a function.
 */

/** Numbers preserved rather than reduced to a single digit. */
export type MasterNumber = 11 | 22 | 33;

/**
 * How the letter Y is classified when splitting a name into vowels and
 * consonants.
 *
 * - `contextual` (default): Y is a vowel when it is not the first letter of its
 *   word and the letter before it is not a vowel. So MARY and BRYAN take Y as a
 *   vowel, while YOLANDA and MOYA do not.
 * - `always-vowel` / `always-consonant`: fixed classification, for traditions
 *   or products that prefer a simpler rule.
 */
export type YHandling = 'contextual' | 'always-vowel' | 'always-consonant';

export interface NumerologyConfig {
  /** Which numbers escape reduction. Empty disables master numbers entirely. */
  readonly masterNumbers: readonly MasterNumber[];
  readonly yHandling: YHandling;
  /**
   * When true, master numbers are preserved at intermediate steps as well as
   * final ones — e.g. a birth year reducing to 11 stays 11 before being added
   * to the month and day. Traditions differ; this is the more common choice.
   */
  readonly preserveMastersInComponents: boolean;
}

export const DEFAULT_NUMEROLOGY_CONFIG: NumerologyConfig = {
  masterNumbers: [11, 22, 33],
  yHandling: 'contextual',
  preserveMastersInComponents: true,
};

/** One step in a calculation, so any displayed number can be justified. */
export interface TraceStep {
  readonly label: string;
  readonly detail: string;
  readonly value: number;
}

/** A numerology result together with the reasoning that produced it. */
export interface NumerologyValue {
  readonly value: number;
  readonly isMasterNumber: boolean;
  readonly trace: readonly TraceStep[];
}

export interface BirthDateInput {
  readonly year: number;
  /** 1..12. */
  readonly month: number;
  /** 1..31. */
  readonly day: number;
}

export interface NumerologyProfile {
  readonly lifePath: NumerologyValue;
  readonly expression: NumerologyValue;
  readonly soulUrge: NumerologyValue;
  readonly personality: NumerologyValue;
  readonly birthday: NumerologyValue;
  readonly maturity: NumerologyValue;
  readonly config: NumerologyConfig;
  readonly engineVersion: string;
  readonly systemId: string;
}

export interface PersonalCycles {
  readonly personalYear: NumerologyValue;
  readonly personalMonth: NumerologyValue;
  readonly personalDay: NumerologyValue;
}

/**
 * Contract every numerology tradition must satisfy.
 *
 * Pythagorean is implemented; Chaldean and others can be added as separate
 * implementations without changing any caller.
 */
export interface NumerologySystem {
  readonly id: string;
  readonly config: NumerologyConfig;

  calculateLifePath(birthDate: BirthDateInput): NumerologyValue;
  calculateExpression(fullName: string): NumerologyValue;
  calculateSoulUrge(fullName: string): NumerologyValue;
  calculatePersonality(fullName: string): NumerologyValue;
  calculateBirthday(birthDate: BirthDateInput): NumerologyValue;
  calculateMaturity(birthDate: BirthDateInput, fullName: string): NumerologyValue;
  calculateProfile(birthDate: BirthDateInput, fullName: string): NumerologyProfile;
  calculatePersonalCycles(birthDate: BirthDateInput, onDate: BirthDateInput): PersonalCycles;
}
