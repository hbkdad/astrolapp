/**
 * Fact sentences.
 *
 * Everything here is mechanically derived from verified numbers. A reader — or a
 * reviewer, or a support agent — can check any sentence this module produces
 * against the ephemeris and confirm it.
 *
 * Nothing in this file may state a meaning, a tendency or an outcome. If a
 * sentence could not be verified with an ephemeris, it does not belong here.
 */

import { formatZodiacPosition, type LunarState, type TransitEvent } from '@astrolapp/astro-engine';
import type { NumerologyValue } from '@astrolapp/numerology-engine';
import { ASPECT_THEMES } from './content/themes.js';

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Human-readable name for a natal point. */
function targetName(target: string): string {
  if (target === 'ascendant') return 'Ascendant';
  if (target === 'midheaven') return 'Midheaven';
  if (target === 'northNode') return 'North Node';
  if (target === 'southNode') return 'South Node';
  return titleCase(target);
}

/**
 * Statement of an active transit.
 *
 * Example: "Transiting Mars is square your natal Sun, 1.24° from exact and
 * applying. Mars is at 18°22' Pisces."
 */
export function transitFact(event: TransitEvent): string {
  const relation = ASPECT_THEMES[event.aspect.type].relation;
  const body = titleCase(event.transitingBody);
  const orb = event.aspect.orb.toFixed(2);

  const phase =
    event.aspect.phase === 'applying'
      ? ' and applying'
      : event.aspect.phase === 'separating'
        ? ' and separating'
        : '';

  const retrograde = event.retrograde ? ', moving retrograde' : '';

  return (
    `Transiting ${body} is ${relation} your natal ${targetName(event.natalTarget)}, ` +
    `${orb}° from exact${phase}${retrograde}. ` +
    `${body} is at ${formatZodiacPosition(event.transitingPosition)}.`
  );
}

/**
 * Statement of the Moon's current state.
 *
 * Example: "The Moon is 14% illuminated at 2°35' Cancer, 26.1 days into the
 * current lunation, 187.3° from the Sun."
 */
export function lunarFact(state: LunarState): string {
  return (
    `The Moon is ${(state.illumination * 100).toFixed(0)}% illuminated at ` +
    `${formatZodiacPosition(state.position)}, ${state.ageDays.toFixed(1)} days into the current ` +
    `lunation, ${state.phaseAngle.toFixed(1)}° from the Sun.`
  );
}

/**
 * Statement of a numerology value, including how it was derived.
 *
 * The trace is included because a numerology number is only checkable if the
 * arithmetic behind it is visible.
 */
export function numerologyFact(label: string, value: NumerologyValue): string {
  const steps = value.trace
    .filter((step) => step.detail.length > 0)
    .map((step) => `${step.label}: ${step.detail}`)
    .join('; ');

  const master = value.isMasterNumber ? ' This is a master number and is not reduced further.' : '';
  return `${label} is ${value.value}.${master} Derivation — ${steps}.`;
}

/** Statement of a lunation time. */
export function lunationFact(label: string, at: Date): string {
  return `${label} occurs at ${at.toISOString().replace('T', ' ').slice(0, 16)} UTC.`;
}
