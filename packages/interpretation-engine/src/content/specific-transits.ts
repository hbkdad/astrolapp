/**
 * Hand-written interpretations for notable transits.
 *
 * These override the composed reading for combinations where the generic
 * composition would lose something recognised in practice — a Saturn return
 * deserves better than "structure meets structure through a merging".
 *
 * The registry is intentionally small. Composition covers everything else, so a
 * missing entry degrades to a reasonable reading rather than to nothing, and
 * `Interpretation.source` reports which path produced the text.
 */

import type { InterpretationEntry } from '../types.js';

export const SPECIFIC_TRANSIT_ENTRIES: Record<string, InterpretationEntry> = {
  'transit.saturn.conjunction.saturn': {
    key: 'transit.saturn.conjunction.saturn',
    title: 'Saturn Return',
    body: 'Saturn has returned to the degree it occupied at birth, which happens roughly every 29 years. Tradition treats this as one of the most significant transits in a chart, associated with taking stock: commitments made earlier are reassessed, and structures that were not built on solid ground are said to show it. It is generally described as demanding rather than pleasant, and as clarifying.',
    tone: 'challenging',
    categories: ['career', 'personalGrowth'],
  },
  'transit.uranus.opposition.uranus': {
    key: 'transit.uranus.opposition.uranus',
    title: 'Uranus Opposition',
    body: "Uranus stands opposite its natal position, which occurs around the early forties. Traditionally associated with a restlessness about the shape of one's life and a pull toward independence — the configuration behind the popular idea of a midlife reappraisal.",
    tone: 'challenging',
    categories: ['personalGrowth', 'creativity'],
  },
  'transit.jupiter.conjunction.sun': {
    key: 'transit.jupiter.conjunction.sun',
    title: 'Jupiter conjunct natal Sun',
    body: 'Jupiter meets the natal Sun roughly once every twelve years. Traditionally read as one of the more favourable transits: associated with confidence, visibility and a widened sense of what is possible. Tradition also cautions that Jupiter tends toward overextension as readily as toward growth.',
    tone: 'supportive',
    categories: ['career', 'personalGrowth', 'finance'],
  },
  'transit.saturn.conjunction.sun': {
    key: 'transit.saturn.conjunction.sun',
    title: 'Saturn conjunct natal Sun',
    body: 'Saturn meets the natal Sun roughly every 29 years. Traditionally associated with a sober stretch that asks for realism and effort, and with responsibilities becoming harder to postpone. Often described as heavy at the time and useful in retrospect.',
    tone: 'challenging',
    categories: ['career', 'personalGrowth'],
  },
  'transit.saturn.conjunction.moon': {
    key: 'transit.saturn.conjunction.moon',
    title: 'Saturn conjunct natal Moon',
    body: 'Saturn meets the natal Moon. Traditionally associated with a more serious emotional tone and with attention turning to what genuinely provides security. Frequently described as a quiet, inward period rather than an eventful one.',
    tone: 'challenging',
    categories: ['love', 'personalGrowth'],
  },
  'transit.pluto.conjunction.sun': {
    key: 'transit.pluto.conjunction.sun',
    title: 'Pluto conjunct natal Sun',
    body: 'Pluto meets the natal Sun — a rare, slow contact lasting a year or more. Tradition associates it with deep reorientation of identity and with a sense that returning to an earlier version of oneself is no longer available.',
    tone: 'challenging',
    categories: ['personalGrowth', 'career'],
  },
  'transit.jupiter.conjunction.midheaven': {
    key: 'transit.jupiter.conjunction.midheaven',
    title: 'Jupiter conjunct natal Midheaven',
    body: 'Jupiter reaches the highest point of the chart. Traditionally associated with professional visibility and opportunity, and with recognition for work already done rather than reward arriving unearned.',
    tone: 'supportive',
    categories: ['career', 'finance'],
  },
  'transit.venus.conjunction.venus': {
    key: 'transit.venus.conjunction.venus',
    title: 'Venus Return',
    body: 'Venus has returned to its natal degree, which happens roughly once a year. Traditionally read as a light, pleasant marker associated with affection, taste and a renewed sense of what one values.',
    tone: 'supportive',
    categories: ['love', 'creativity'],
  },
};
