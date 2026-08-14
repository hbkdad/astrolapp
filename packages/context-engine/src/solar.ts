/**
 * Solar-sign context: the basis of public, no-birth-data horoscopes.
 *
 * A sun-sign horoscope has a genuine problem. Without a birth time or place
 * there is no Ascendant, no houses and no natal chart — so most sun-sign copy is
 * simply invented, twelve ways, daily.
 *
 * This module refuses that. It uses the traditional SOLAR HOUSE convention:
 * houses are counted in whole signs from the reader's own sign. That makes every
 * statement checkable — "Mars is at 12° Leo, the 3rd sign from Gemini, so it is
 * in your solar 3rd house" is either true or false, and anyone can verify it
 * against an ephemeris.
 *
 * Everything here is therefore real astronomy plus one stated convention:
 *
 *   - the actual positions of the planets today,
 *   - the actual Moon phase, sign and illumination,
 *   - the actual aspects between transiting bodies,
 *   - which solar house each body currently occupies for this sign.
 *
 * The twelve signs genuinely differ because the solar houses differ. Nothing is
 * generated, and nothing is padded.
 */

import { ENGINE_VERSIONS } from '@astrolapp/shared';
import {
  DEFAULT_CHART_BODIES,
  MAJOR_ASPECTS,
  ZODIAC_SIGNS,
  computeLunarState,
  computeUpcomingLunations,
  findAspect,
  longitudeToZodiac,
  type Aspect,
  type BodyId,
  type BodyPosition,
  type EphemerisProvider,
  type LunarState,
  type UpcomingLunations,
  type ZodiacSign,
} from '@astrolapp/astro-engine';

/** A transiting body located in the reader's solar houses. */
export interface SolarPlacement {
  readonly body: BodyId;
  readonly longitude: number;
  readonly sign: ZodiacSign;
  readonly degreeInSign: number;
  /** 1..12, counted in whole signs from the reader's own sign. */
  readonly solarHouse: number;
  readonly retrograde: boolean;
}

/** An aspect between two transiting bodies — the same sky for everyone. */
export interface SkyAspect {
  readonly from: BodyId;
  readonly to: BodyId;
  readonly aspect: Aspect;
}

export interface SolarSignContext {
  readonly sign: ZodiacSign;
  /** UTC calendar date this context describes. */
  readonly date: string;
  readonly instant: string;

  readonly placements: readonly SolarPlacement[];
  readonly moon: LunarState;
  /** The Moon's solar house for this sign — what makes the Moon copy differ. */
  readonly moonSolarHouse: number;
  readonly upcomingLunations: UpcomingLunations;

  /** Transiting-to-transiting aspects, tightest first. */
  readonly skyAspects: readonly SkyAspect[];

  /** Bodies currently retrograde. Real, checkable, and of public interest. */
  readonly retrogrades: readonly BodyId[];

  readonly metadata: {
    readonly astroEngineVersion: string;
    readonly lunarVersion: string;
    readonly ephemerisProvider: string;
    readonly ephemerisVersion: string;
  };
}

/**
 * Solar house of a body, 1..12.
 *
 * Whole signs counted from the reader's own sign, so the reader's sign is the
 * 1st house, the next sign the 2nd, and so on.
 */
export function solarHouseOf(bodySignIndex: number, readerSignIndex: number): number {
  return ((((bodySignIndex - readerSignIndex) % 12) + 12) % 12) + 1;
}

/**
 * Midday UTC for a calendar date.
 *
 * Public pages are cached per day, so they must be computed at a fixed instant
 * or two visitors on the same day would see different numbers. Midday is chosen
 * over midnight because it minimises the worst-case error for readers in any
 * time zone — the Moon moves about 13 degrees a day.
 */
export function referenceInstantFor(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
}

/** Build the public context for one sign on one day. */
export function computeSolarSignContext(
  provider: EphemerisProvider,
  sign: ZodiacSign,
  date: Date,
): SolarSignContext {
  const instant = referenceInstantFor(date);
  const readerSignIndex = ZODIAC_SIGNS.indexOf(sign);

  const positions = provider.getBodyPositions(DEFAULT_CHART_BODIES, instant);

  const placements: SolarPlacement[] = positions.map((position) => {
    const zodiac = longitudeToZodiac(position.longitude);
    return {
      body: position.body,
      longitude: position.longitude,
      sign: zodiac.sign,
      degreeInSign: zodiac.degreeInSign,
      solarHouse: solarHouseOf(zodiac.signIndex, readerSignIndex),
      retrograde: position.retrograde,
    };
  });

  const moon = computeLunarState(provider, instant);

  return {
    sign,
    date: instant.toISOString().slice(0, 10),
    instant: instant.toISOString(),
    placements,
    moon,
    moonSolarHouse: solarHouseOf(moon.position.signIndex, readerSignIndex),
    upcomingLunations: computeUpcomingLunations(provider, instant),
    skyAspects: computeSkyAspects(positions),
    retrogrades: positions.filter((p) => p.retrograde).map((p) => p.body),
    metadata: {
      astroEngineVersion: ENGINE_VERSIONS.astro,
      lunarVersion: ENGINE_VERSIONS.lunar,
      ephemerisProvider: provider.id,
      ephemerisVersion: provider.version,
    },
  };
}

/**
 * Aspects between transiting bodies.
 *
 * Sun-Mercury and Sun-Venus conjunctions are excluded: those two never stray far
 * from the Sun, so the aspect is a near-permanent feature of the sky rather than
 * news. Reporting it daily would be padding.
 */
function computeSkyAspects(positions: readonly BodyPosition[]): SkyAspect[] {
  const aspects: SkyAspect[] = [];

  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const from = positions[i];
      const to = positions[j];
      if (from === undefined || to === undefined) continue;

      // The Moon aspects everything every few days; it is covered separately by
      // the phase and sign, so excluding it here keeps the list meaningful.
      if (from.body === 'moon' || to.body === 'moon') continue;

      const aspect = findAspect(from.longitude, to.longitude, {
        aspects: MAJOR_ASPECTS,
        speeds: { a: from.longitudeSpeed, b: to.longitudeSpeed },
      });
      if (aspect === null) continue;

      aspects.push({ from: from.body, to: to.body, aspect });
    }
  }

  return aspects.sort((left, right) => left.aspect.orb - right.aspect.orb);
}

/** Every sign's context for a day, for building index pages. */
export function computeAllSolarSignContexts(
  provider: EphemerisProvider,
  date: Date,
): SolarSignContext[] {
  return ZODIAC_SIGNS.map((sign) => computeSolarSignContext(provider, sign, date));
}
