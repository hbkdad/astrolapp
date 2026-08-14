/**
 * Lunar interpretation content.
 *
 * Phase copy describes the traditional association of each phase. It never
 * asserts an outcome, and never advises on health, money, legal or safety
 * matters — `content-safety.test.ts` enforces both mechanically.
 */

import type { MoonPhaseName, ZodiacSign } from '@astrolapp/astro-engine';
import type { InterpretationEntry } from '../types.js';

export const MOON_PHASE_ENTRIES: Record<MoonPhaseName, InterpretationEntry> = {
  'new-moon': {
    key: 'moon.phase.new-moon',
    title: 'New Moon',
    body: 'The Moon and Sun share the same degree, and the Moon is dark. This point is traditionally associated with beginnings and with setting intentions — a quiet part of the cycle rather than an active one, often read as a time for planting rather than harvesting.',
    tone: 'neutral',
  },
  'waxing-crescent': {
    key: 'moon.phase.waxing-crescent',
    title: 'Waxing Crescent',
    body: 'Light is returning. Tradition associates this phase with early momentum: the stage where an intention starts to take practical shape and benefits from steady attention.',
    tone: 'supportive',
  },
  'first-quarter': {
    key: 'moon.phase.first-quarter',
    title: 'First Quarter',
    body: 'The Moon stands square the Sun, half lit and growing. This phase is traditionally read as a point of constructive tension, where early plans meet their first real resistance and often need adjusting.',
    tone: 'challenging',
  },
  'waxing-gibbous': {
    key: 'moon.phase.waxing-gibbous',
    title: 'Waxing Gibbous',
    body: 'Approaching fullness. Traditionally associated with refinement and persistence — the stage of shaping and improving something already underway.',
    tone: 'supportive',
  },
  'full-moon': {
    key: 'moon.phase.full-moon',
    title: 'Full Moon',
    body: 'The Moon stands opposite the Sun and is fully lit. Tradition associates the Full Moon with culmination and visibility: things reaching a peak, and matters that were unclear becoming easier to see. It is also traditionally read as a point of heightened feeling.',
    tone: 'neutral',
  },
  'waning-gibbous': {
    key: 'moon.phase.waning-gibbous',
    title: 'Waning Gibbous',
    body: 'Light is receding after the peak. Traditionally associated with sharing, digesting and making sense of what has happened.',
    tone: 'supportive',
  },
  'third-quarter': {
    key: 'moon.phase.third-quarter',
    title: 'Third Quarter',
    body: 'The Moon squares the Sun again, now waning. This phase is traditionally read as a turning point of release — reassessing what is worth carrying forward into the next cycle.',
    tone: 'challenging',
  },
  'waning-crescent': {
    key: 'moon.phase.waning-crescent',
    title: 'Waning Crescent',
    body: 'The last sliver before the Moon goes dark. Traditionally associated with rest, completion and withdrawal ahead of the next New Moon.',
    tone: 'neutral',
  },
};

/** Short traditional association for the Moon's sign placement. */
export const MOON_SIGN_THEMES: Record<ZodiacSign, string> = {
  aries: 'direct, quick to act, with little patience for delay',
  taurus: 'steady and sensory, favouring comfort and a slower pace',
  gemini: 'curious and talkative, with attention moving quickly',
  cancer: 'protective and inward, with feeling close to the surface',
  leo: 'warm and expressive, drawn toward being seen',
  virgo: 'precise and practical, inclined to sort and improve',
  libra: 'sociable and balancing, attentive to fairness and to others',
  scorpio: 'intense and private, drawn to what lies underneath',
  sagittarius: 'restless and expansive, wanting room and perspective',
  capricorn: 'reserved and purposeful, focused on what is useful',
  aquarius: 'detached and independent, thinking in terms of the wider picture',
  pisces: 'porous and imaginative, with boundaries less firm than usual',
};

export function moonSignEntry(sign: ZodiacSign): InterpretationEntry {
  return {
    key: `moon.sign.${sign}`,
    title: `Moon in ${sign.charAt(0).toUpperCase()}${sign.slice(1)}`,
    body: `While the Moon travels through ${sign.charAt(0).toUpperCase()}${sign.slice(1)}, the prevailing mood is traditionally described as ${MOON_SIGN_THEMES[sign]}. The Moon changes sign roughly every two and a half days, so this colours the day rather than the period.`,
    tone: 'neutral',
  };
}
