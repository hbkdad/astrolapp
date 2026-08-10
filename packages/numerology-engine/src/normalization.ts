/**
 * Name normalization.
 *
 * Names arrive with accents, apostrophes, hyphens, non-Latin scripts and
 * inconsistent spacing. Every one of those has to resolve to a defined
 * behaviour, because silently dropping a character changes a user's Expression
 * number without telling them why.
 *
 * Rules, in order:
 *   1. Unicode NFD decomposition, then removal of combining marks — so "José"
 *      becomes "JOSE" and "Ana-María" becomes "ANA MARIA".
 *   2. Hyphens, apostrophes and other punctuation become word separators, so
 *      "O'Brien" is treated as two words for the purpose of the Y rule.
 *   3. Anything remaining outside A-Z is dropped, and reported.
 *
 * Rule 3 is why `unsupportedCharacters` exists: a name in a non-Latin script
 * reduces to nothing, and the caller must be able to detect that and refuse
 * rather than present a confident number derived from an empty string.
 */

/** A name broken into normalized words plus a record of what was discarded. */
export interface NormalizedName {
  /** Uppercase A-Z words, in order. */
  readonly words: readonly string[];
  /** All words joined, for whole-name sums. */
  readonly letters: string;
  /** Distinct characters dropped because they have no A-Z equivalent. */
  readonly unsupportedCharacters: readonly string[];
  /** The input exactly as supplied. */
  readonly original: string;
}

/** Characters treated as word separators rather than dropped silently. */
const SEPARATOR_PATTERN = /[\s\-'’.,_/\\]+/u;

/**
 * Normalize a name for numerological calculation.
 *
 * Throws on a non-string input, but an empty result is returned rather than
 * thrown — an all-unsupported name is a legitimate state the caller should
 * handle by asking the user for a Latin-script transliteration.
 */
export function normalizeName(input: string): NormalizedName {
  if (typeof input !== 'string') {
    throw new TypeError('normalizeName expects a string');
  }

  const decomposed = input
    .normalize('NFD')
    // Strip combining diacritical marks left behind by decomposition.
    .replace(/\p{Diacritic}/gu, '');

  const unsupported = new Set<string>();
  const words: string[] = [];

  for (const rawWord of decomposed.split(SEPARATOR_PATTERN)) {
    if (rawWord.length === 0) continue;

    let word = '';
    for (const character of rawWord) {
      const upper = character.toUpperCase();
      if (upper >= 'A' && upper <= 'Z' && upper.length === 1) {
        word += upper;
      } else {
        unsupported.add(character);
      }
    }
    if (word.length > 0) words.push(word);
  }

  return {
    words,
    letters: words.join(''),
    unsupportedCharacters: [...unsupported],
    original: input,
  };
}
