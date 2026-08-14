/**
 * Public sun-sign horoscope.
 *
 * Built entirely from computed sky data plus the stated solar-house convention.
 * Nothing is generated, and no AI is involved. Every sentence below can be
 * checked against an ephemeris by a sceptical reader — which is the whole
 * argument for the product.
 *
 * The twelve signs differ because their solar houses differ, not because twelve
 * variations were written.
 */

import {
  ZODIAC_SIGNS,
  elementOf,
  formatZodiacPosition,
  longitudeToZodiac,
  modalityOf,
  type BodyId,
  type ZodiacSign,
} from '@astrolapp/astro-engine';
import type { SolarSignContext, SkyAspect, SolarPlacement } from '@astrolapp/context-engine';
import { ASPECT_THEMES, TRANSITING_BODY_THEMES } from './content/themes.js';
import { MOON_PHASE_ENTRIES, MOON_SIGN_THEMES } from './content/moon.js';
import { solarHouseTheme } from './content/solar-houses.js';
import { READING_DISCLAIMER } from './reading.js';
import type { Interpretation } from './types.js';

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Ordinal for house numbers: 1st, 2nd, 3rd, 4th… */
function ordinal(value: number): string {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? 'th'
      : value % 10 === 1
        ? 'st'
        : value % 10 === 2
          ? 'nd'
          : value % 10 === 3
            ? 'rd'
            : 'th';
  return `${value}${suffix}`;
}

export interface PublicHighlight extends Interpretation {
  /** The solar house this highlight concerns, when it has one. */
  readonly solarHouse: number | null;
}

export interface PublicHoroscope {
  readonly sign: ZodiacSign;
  readonly signLabel: string;
  readonly date: string;
  readonly element: string;
  readonly modality: string;

  readonly headline: string;
  readonly summary: string;

  /** The most notable placements for this sign today, strongest first. */
  readonly highlights: readonly PublicHighlight[];

  readonly moon: Interpretation;
  readonly moonSolarHouse: number;

  /** Sky-wide aspects, identical for every sign. Stated as such. */
  readonly skyAspects: readonly Interpretation[];
  readonly retrogrades: readonly string[];

  readonly upcoming: readonly string[];
  readonly disclaimer: string;
}

/**
 * Bodies worth leading with, in descending order of how much they say.
 *
 * The Sun and inner planets move fast enough to make a daily reading differ;
 * the outer planets sit in one solar house for years and would otherwise
 * dominate every day identically.
 */
const DAILY_LEAD_BODIES: readonly BodyId[] = ['sun', 'mercury', 'venus', 'mars'];

function placementInterpretation(placement: SolarPlacement, sign: ZodiacSign): PublicHighlight {
  const theme = solarHouseTheme(placement.solarHouse);
  const bodyTheme = TRANSITING_BODY_THEMES[placement.body];
  const body = titleCase(placement.body);
  const position = formatZodiacPosition(longitudeToZodiac(placement.longitude));

  const retrograde = placement.retrograde ? ', currently retrograde' : '';
  const signIndex = ZODIAC_SIGNS.indexOf(placement.sign) + 1;
  const readerIndex = ZODIAC_SIGNS.indexOf(sign) + 1;

  // When a body sits in the reader's own sign, spelling out the arithmetic
  // reads as "Leo is sign 5 and Leo is sign 5". State the simpler truth instead.
  const derivation =
    placement.sign === sign
      ? `That is ${titleCase(sign)} itself, and the first solar house is always your own sign.`
      : `${titleCase(placement.sign)} is sign ${signIndex} and ${titleCase(sign)} is sign ${readerIndex}, ` +
        `so counting whole signs from ${titleCase(sign)} places ${body} in the ${ordinal(placement.solarHouse)} solar house.`;

  return {
    key: `solar.${placement.body}.house.${placement.solarHouse}`,
    title: `${body} in your solar ${ordinal(placement.solarHouse)} house — ${theme.label}`,
    // Checkable: position, sign order and the counting rule are all stated.
    fact: `${body} is at ${position}${retrograde}. ${derivation}`,
    interpretation:
      `The ${ordinal(placement.solarHouse)} house traditionally governs ${theme.domain}. ` +
      `Astrology reads ${body} — ${bodyTheme.principle} — moving through it as bringing that emphasis to those matters for as long as it stays in ${titleCase(placement.sign)}.`,
    tone: 'neutral',
    source: 'composed',
    categories: theme.categories,
    solarHouse: placement.solarHouse,
  };
}

function skyAspectInterpretation(skyAspect: SkyAspect): Interpretation {
  const { from, to, aspect } = skyAspect;
  const aspectTheme = ASPECT_THEMES[aspect.type];
  const fromTheme = TRANSITING_BODY_THEMES[from];
  const toTheme = TRANSITING_BODY_THEMES[to];

  const phase = aspect.phase === 'unknown' ? '' : ` and ${aspect.phase}`;

  return {
    key: `sky.${from}.${aspect.type}.${to}`,
    title: `${titleCase(from)} ${aspectTheme.relation} ${titleCase(to)}`,
    fact:
      `${titleCase(from)} and ${titleCase(to)} are ${aspect.actualAngle.toFixed(1)}° apart, ` +
      `${aspect.orb.toFixed(2)}° from an exact ${aspect.type}${phase}. ` +
      `This is a feature of the sky itself, so it applies to every sign equally.`,
    interpretation:
      `Astrology traditionally reads ${titleCase(from)} — ${fromTheme.principle} — ` +
      `${aspectTheme.relation} ${titleCase(to)} — ${toTheme.principle} — as ${aspectTheme.quality}.`,
    tone: aspectTheme.tone,
    source: 'composed',
    categories: [],
  };
}

function moonInterpretation(context: SolarSignContext): Interpretation {
  const entry = MOON_PHASE_ENTRIES[context.moon.phase];
  const theme = solarHouseTheme(context.moonSolarHouse);
  const signLabel = titleCase(context.moon.position.sign);

  return {
    key: `moon.phase.${context.moon.phase}`,
    title: `${entry.title} in ${signLabel}`,
    fact:
      `The Moon is ${(context.moon.illumination * 100).toFixed(0)}% illuminated at ` +
      `${formatZodiacPosition(context.moon.position)}, ${context.moon.ageDays.toFixed(1)} days into ` +
      `the current lunation. For ${titleCase(context.sign)} that is the ` +
      `${ordinal(context.moonSolarHouse)} solar house.`,
    interpretation:
      `${entry.body} While the Moon is in ${signLabel} the prevailing mood is traditionally described as ` +
      `${MOON_SIGN_THEMES[context.moon.position.sign]}. It is passing through your ` +
      `${ordinal(context.moonSolarHouse)} house, which traditionally governs ${theme.domain}. ` +
      `The Moon changes sign every two to three days, so this colours the day rather than the period.`,
    tone: entry.tone,
    source: 'specific',
    categories: theme.categories,
  };
}

/**
 * Build the public horoscope for one sign on one day.
 *
 * Deterministic: the same sign and date always produce the same text, which is
 * what makes the page cacheable and what stops the content shifting under a
 * reader who reloads.
 */
export function buildPublicHoroscope(context: SolarSignContext): PublicHoroscope {
  const signLabel = titleCase(context.sign);

  const leadPlacements = DAILY_LEAD_BODIES.map((body) =>
    context.placements.find((placement) => placement.body === body),
  ).filter((placement): placement is SolarPlacement => placement !== undefined);

  const highlights = leadPlacements.map((placement) =>
    placementInterpretation(placement, context.sign),
  );

  const moon = moonInterpretation(context);

  // Only the tightest sky aspects are worth reporting; a wide orb is not news.
  const skyAspects = context.skyAspects
    .filter((skyAspect) => skyAspect.aspect.orb <= 3)
    .slice(0, 3)
    .map(skyAspectInterpretation);

  const sunPlacement = leadPlacements.find((placement) => placement.body === 'sun');
  const headline =
    sunPlacement === undefined
      ? `${signLabel} — ${moon.title}`
      : `${moon.title}, and the Sun in your solar ${ordinal(sunPlacement.solarHouse)} house`;

  const retrogradeLabels = context.retrogrades.map(titleCase);

  const summary =
    `Today the Moon is ${(context.moon.illumination * 100).toFixed(0)}% lit in ` +
    `${titleCase(context.moon.position.sign)}, and for ${signLabel} it sits in the ` +
    `${ordinal(context.moonSolarHouse)} solar house — ` +
    `${solarHouseTheme(context.moonSolarHouse).domain}. ` +
    (retrogradeLabels.length > 0
      ? `${retrogradeLabels.join(', ')} ${retrogradeLabels.length === 1 ? 'is' : 'are'} retrograde. `
      : 'No planet is retrograde today. ') +
    `Every position on this page is calculated, not written in advance.`;

  return {
    sign: context.sign,
    signLabel,
    date: context.date,
    element: elementOf(context.sign),
    modality: modalityOf(context.sign),
    headline,
    summary,
    highlights,
    moon,
    moonSolarHouse: context.moonSolarHouse,
    skyAspects,
    retrogrades: retrogradeLabels,
    upcoming: [
      `The next New Moon is at ${context.upcomingLunations.nextNewMoon.toISOString().replace('T', ' ').slice(0, 16)} UTC.`,
      `The next Full Moon is at ${context.upcomingLunations.nextFullMoon.toISOString().replace('T', ' ').slice(0, 16)} UTC.`,
    ],
    disclaimer: READING_DISCLAIMER,
  };
}
