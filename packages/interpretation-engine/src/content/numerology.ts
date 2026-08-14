/**
 * Numerology interpretation content.
 *
 * Covers 1-9 plus the master numbers 11, 22 and 33. Every entry is written as a
 * traditional association, not as a statement about the person or a prediction.
 */

import type { InterpretationEntry } from '../types.js';

/** Core traditional association of each number. */
export const NUMBER_THEMES: Record<number, { title: string; theme: string }> = {
  1: { title: 'One', theme: 'independence, initiative and starting things' },
  2: { title: 'Two', theme: 'cooperation, sensitivity and partnership' },
  3: { title: 'Three', theme: 'expression, creativity and communication' },
  4: { title: 'Four', theme: 'structure, discipline and steady work' },
  5: { title: 'Five', theme: 'change, freedom and variety of experience' },
  6: { title: 'Six', theme: 'responsibility, care and matters of home' },
  7: { title: 'Seven', theme: 'reflection, analysis and inner life' },
  8: { title: 'Eight', theme: 'ambition, material effort and authority' },
  9: { title: 'Nine', theme: 'completion, perspective and letting go' },
  11: { title: 'Eleven', theme: 'heightened intuition and inspiration, an intensified Two' },
  22: {
    title: 'Twenty-Two',
    theme: 'large-scale building and practical vision, an intensified Four',
  },
  33: { title: 'Thirty-Three', theme: 'guidance and service to others, an intensified Six' },
};

function themeFor(value: number): { title: string; theme: string } {
  return NUMBER_THEMES[value] ?? { title: String(value), theme: 'an unlisted association' };
}

export function lifePathEntry(value: number): InterpretationEntry {
  const { title, theme } = themeFor(value);
  return {
    key: `numerology.life-path.${value}`,
    title: `Life Path ${value}`,
    body: `In Pythagorean numerology the Life Path is derived from the birth date and is traditionally taken as the broadest of the numerology values. Life Path ${value} — ${title} — is associated with ${theme}. Within this system it describes an orientation rather than a fixed trait, and it is one input among several.`,
    tone: 'neutral',
  };
}

export function personalYearEntry(value: number): InterpretationEntry {
  const { theme } = themeFor(value);
  return {
    key: `numerology.personal-year.${value}`,
    title: `Personal Year ${value}`,
    body: `The Personal Year runs from birthday to birthday rather than from January. A ${value} year is traditionally associated with ${theme}, and is read as the background theme against which the shorter cycles play out.`,
    tone: 'neutral',
  };
}

export function personalMonthEntry(value: number): InterpretationEntry {
  const { theme } = themeFor(value);
  return {
    key: `numerology.personal-month.${value}`,
    title: `Personal Month ${value}`,
    body: `Within the current Personal Year, a ${value} month is traditionally associated with ${theme}.`,
    tone: 'neutral',
  };
}

export function personalDayEntry(value: number): InterpretationEntry {
  const { theme } = themeFor(value);
  return {
    key: `numerology.personal-day.${value}`,
    title: `Personal Day ${value}`,
    body: `A ${value} day is traditionally associated with ${theme}. It is the shortest of the numerology cycles and is read as a light daily colouring.`,
    tone: 'neutral',
  };
}
