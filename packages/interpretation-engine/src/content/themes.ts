/**
 * Compositional interpretation vocabulary.
 *
 * Writing a bespoke entry for every transit would need 10 bodies x 5 aspects x
 * 14 targets = 700 entries before covering minor aspects. Instead each body,
 * target and aspect carries a short theme, and these compose into specific
 * readings. Notable combinations can still be overridden individually — see
 * `specific-transits.ts`.
 *
 * All copy here is written as tradition ("traditionally read as"), never as
 * prediction. `content-safety.test.ts` enforces that mechanically.
 */

import type { BodyId, NatalTarget } from '@astrolapp/astro-engine';
import type { AspectType } from '@astrolapp/astro-engine';

export interface BodyTheme {
  /** Short label, e.g. "drive and assertion". */
  readonly principle: string;
  /** Verb phrase describing what this body is said to do. */
  readonly action: string;
}

export const TRANSITING_BODY_THEMES: Record<BodyId, BodyTheme> = {
  sun: { principle: 'vitality and purpose', action: 'brings attention and clarity to' },
  moon: { principle: 'mood and instinct', action: 'stirs feeling around' },
  mercury: { principle: 'thought and exchange', action: 'sharpens thinking about' },
  venus: { principle: 'affection and value', action: 'softens and draws warmth toward' },
  mars: { principle: 'drive and assertion', action: 'energises and pushes at' },
  jupiter: { principle: 'growth and perspective', action: 'expands and opens up' },
  saturn: {
    principle: 'structure and responsibility',
    action: 'tests and asks for commitment from',
  },
  uranus: { principle: 'disruption and independence', action: 'unsettles and shakes loose' },
  neptune: { principle: 'imagination and dissolution', action: 'blurs and inspires' },
  pluto: { principle: 'depth and transformation', action: 'intensifies and reworks' },
  northNode: { principle: 'direction of growth', action: 'draws attention forward toward' },
  southNode: { principle: 'inherited habit', action: 'pulls back toward the familiar in' },
};

export const NATAL_TARGET_THEMES: Record<NatalTarget, BodyTheme> = {
  sun: { principle: 'your core sense of self', action: 'who you are becoming' },
  moon: { principle: 'your emotional needs', action: 'what makes you feel secure' },
  mercury: { principle: 'how you think and speak', action: 'the way you process and share ideas' },
  venus: {
    principle: 'what you love and value',
    action: 'how you relate and what you find worthwhile',
  },
  mars: { principle: 'how you act and assert', action: 'the way you pursue what you want' },
  jupiter: { principle: 'where you seek meaning', action: 'your sense of possibility' },
  saturn: {
    principle: 'where you carry responsibility',
    action: 'the structures you are building',
  },
  uranus: { principle: 'where you need freedom', action: 'your urge to break pattern' },
  neptune: { principle: 'where you dream and idealise', action: 'your imaginative life' },
  pluto: { principle: 'where you transform', action: 'your capacity for deep change' },
  ascendant: { principle: 'how you meet the world', action: 'your outward manner and approach' },
  midheaven: { principle: 'your public direction', action: 'your work and standing' },
  northNode: {
    principle: 'your developmental direction',
    action: 'the growth you are reaching for',
  },
  southNode: { principle: 'your established patterns', action: 'what already comes easily' },
};

export interface AspectTheme {
  /** Connective phrase for the fact sentence. */
  readonly relation: string;
  /** How the contact is traditionally characterised. */
  readonly quality: string;
  readonly tone: 'supportive' | 'challenging' | 'neutral';
}

export const ASPECT_THEMES: Record<AspectType, AspectTheme> = {
  conjunction: {
    relation: 'conjunct',
    quality: 'a merging, where the two act as one and intensify each other',
    tone: 'neutral',
  },
  sextile: {
    relation: 'sextile',
    quality:
      'an easy opening that tends to reward deliberate effort rather than arriving unprompted',
    tone: 'supportive',
  },
  square: {
    relation: 'square',
    quality: 'productive friction, where progress usually asks for an adjustment',
    tone: 'challenging',
  },
  trine: {
    relation: 'trine',
    quality: 'a natural flow that tends to feel unforced',
    tone: 'supportive',
  },
  opposition: {
    relation: 'opposite',
    quality: 'a pull between two poles that asks for balance rather than a winner',
    tone: 'challenging',
  },
  semisextile: { relation: 'semisextile', quality: 'a mild, low-key contact', tone: 'neutral' },
  semisquare: {
    relation: 'semisquare',
    quality: 'a minor irritation that nags rather than blocks',
    tone: 'challenging',
  },
  quintile: {
    relation: 'quintile',
    quality: 'a creative angle associated with skill and craft',
    tone: 'supportive',
  },
  sesquiquadrate: {
    relation: 'sesquiquadrate',
    quality: 'a restless minor tension',
    tone: 'challenging',
  },
  quincunx: {
    relation: 'quincunx',
    quality: 'a mismatch between two things that do not naturally speak the same language',
    tone: 'challenging',
  },
};
