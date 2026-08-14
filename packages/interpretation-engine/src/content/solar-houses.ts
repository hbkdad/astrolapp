/**
 * Solar house meanings.
 *
 * Houses are the traditional twelve areas of life. Under the solar-house
 * convention used for public horoscopes, they are counted in whole signs from
 * the reader's own sign — so the meanings below are the standard house
 * significations, applied to that frame.
 *
 * Written as tradition, never as prediction. `content-safety.test.ts` scans
 * these along with everything else.
 */

import type { Category } from '@astrolapp/context-engine';

export interface SolarHouseTheme {
  readonly house: number;
  readonly label: string;
  /** What the house traditionally governs. */
  readonly domain: string;
  /** Longer description used on public pages. */
  readonly description: string;
  readonly categories: readonly Category[];
}

export const SOLAR_HOUSE_THEMES: readonly SolarHouseTheme[] = [
  {
    house: 1,
    label: 'Self and outlook',
    domain: 'your own initiative, manner and physical energy',
    description:
      'The first house is traditionally read as the self: how you come across, what you initiate, and the energy you bring into a room. A planet here is usually described as colouring your whole approach rather than one area of life.',
    categories: ['energy', 'personalGrowth'],
  },
  {
    house: 2,
    label: 'Money and values',
    domain: 'income, possessions and what you consider worth having',
    description:
      'The second house traditionally covers earnings, belongings and the quieter question of what you actually value. It is associated with resources you hold yourself, as distinct from shared ones.',
    categories: ['finance'],
  },
  {
    house: 3,
    label: 'Communication and local life',
    domain: 'conversation, learning, siblings and short journeys',
    description:
      'The third house is associated with everyday exchange: messages, errands, study, and the people you deal with routinely. Traditionally it governs the near and the frequent rather than the distant and the rare.',
    categories: ['communication'],
  },
  {
    house: 4,
    label: 'Home and roots',
    domain: 'family, dwelling and where you feel private',
    description:
      'The fourth house traditionally concerns home, family and the foundations you were built on. It is the most private angle of the chart and is associated with what you retreat into.',
    categories: ['personalGrowth', 'love'],
  },
  {
    house: 5,
    label: 'Creativity and romance',
    domain: 'play, courtship, children and self-expression',
    description:
      'The fifth house is associated with what you do for pleasure rather than obligation: making things, flirtation, games, and children. Traditionally read as the house of enjoyment.',
    categories: ['creativity', 'love'],
  },
  {
    house: 6,
    label: 'Work and routine',
    domain: 'daily tasks, service, habits and health',
    description:
      'The sixth house traditionally covers the ordinary machinery of life: the job rather than the career, routines, maintenance, and the body treated as something to be looked after.',
    categories: ['career', 'energy'],
  },
  {
    house: 7,
    label: 'Partnership',
    domain: 'close one-to-one relationships, and open opposition',
    description:
      'The seventh house is associated with the significant other — in love, in business, and occasionally in conflict. Traditionally it governs the person across the table, whoever they are.',
    categories: ['love', 'communication'],
  },
  {
    house: 8,
    label: 'Shared resources and depth',
    domain: 'joint finances, intimacy and things that change you',
    description:
      'The eighth house traditionally concerns what is held jointly rather than alone — shared money, debts, and deep attachments. It is associated with transformation and with what is not discussed lightly.',
    categories: ['finance', 'personalGrowth'],
  },
  {
    house: 9,
    label: 'Travel and belief',
    domain: 'distant journeys, higher study, meaning and law',
    description:
      'The ninth house is associated with what widens the view: long travel, advanced study, belief, and the search for a bigger frame. Traditionally the counterpart to the third house of near and everyday.',
    categories: ['personalGrowth', 'communication'],
  },
  {
    house: 10,
    label: 'Career and standing',
    domain: 'public role, reputation and ambition',
    description:
      'The tenth house is the most public point of the chart and traditionally governs vocation, standing and what you are known for. It is associated with the career rather than the day job.',
    categories: ['career'],
  },
  {
    house: 11,
    label: 'Friends and hopes',
    domain: 'groups, networks and long-range goals',
    description:
      'The eleventh house traditionally covers friendship, community and the wider circle you belong to, along with the hopes you are working toward rather than the ones you have reached.',
    categories: ['personalGrowth', 'communication'],
  },
  {
    house: 12,
    label: 'Rest and the unseen',
    domain: 'solitude, reflection and what runs beneath the surface',
    description:
      'The twelfth house is associated with retreat, rest and what happens out of view — including the parts of your own motivation you have not yet examined. Traditionally the quietest house.',
    categories: ['personalGrowth'],
  },
];

export function solarHouseTheme(house: number): SolarHouseTheme {
  const theme = SOLAR_HOUSE_THEMES[house - 1];
  if (theme === undefined) {
    throw new RangeError(`Solar house must be 1..12, received ${house}`);
  }
  return theme;
}
