/**
 * Interpretation types.
 *
 * The central structure here is `Interpretation`, which keeps FACT and
 * INTERPRETATION in separate fields. This is not a stylistic choice — it is the
 * mechanism that stops the two blurring together anywhere downstream.
 *
 *   fact:           "Mars is square your natal Sun, 1.2° from exact, applying."
 *   interpretation: "Astrology traditionally reads this as..."
 *
 * The fact is derived mechanically from verified numbers and is checkable. The
 * interpretation is a tradition and is framed as one. A UI may present them
 * together, but it can always show which is which, and the AI layer receives
 * them already separated so it cannot restate tradition as observation.
 */

import type { Category } from '@astrolapp/context-engine';

export type Tone = 'supportive' | 'challenging' | 'neutral';

/** A piece of interpretation content, addressed by key. */
export interface InterpretationEntry {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly tone: Tone;
  readonly categories?: readonly Category[];
}

/** A fully resolved interpretation of one event. */
export interface Interpretation {
  readonly key: string;
  readonly title: string;
  /** Mechanically derived from verified numbers. Checkable. */
  readonly fact: string;
  /** Traditional reading. Always framed as interpretation, never as prediction. */
  readonly interpretation: string;
  readonly tone: Tone;
  /** Where the text came from, so gaps in the content library are visible. */
  readonly source: 'specific' | 'composed';
  readonly categories: readonly Category[];
}
