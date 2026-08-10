/**
 * Natal chart assembly.
 *
 * Combines ephemeris positions, chart angles, houses and natal aspects into one
 * reproducible object. Every chart carries the versions and settings that
 * produced it, so a chart stored today can be recomputed and byte-compared
 * years from now — which is the whole point of `calculationMetadata`.
 */

import { ENGINE_VERSIONS } from '@astrolapp/shared';
import {
  DEFAULT_CHART_BODIES,
  type BodyId,
  type BodyPosition,
  type EphemerisProvider,
} from './ephemeris/types.js';
import {
  DEFAULT_ORBS,
  MAJOR_ASPECTS,
  findAspect,
  type Aspect,
  type AspectDefinition,
  type OrbConfig,
} from './aspects.js';
import {
  computeHouseCusps,
  houseOfLongitude,
  type ChartAngles,
  type GeoCoordinates,
  type HouseCusp,
  type HouseSystem,
} from './houses.js';
import { longitudeToZodiac, type ZodiacPosition } from './zodiac.js';

/** A body placed in a chart: where it is, and which house it occupies. */
export interface NatalPlacement extends BodyPosition {
  readonly position: ZodiacPosition;
  /** House number 1..12. */
  readonly house: number;
}

/** An aspect between two natal bodies. */
export interface NatalAspect {
  readonly from: BodyId;
  readonly to: BodyId;
  readonly aspect: Aspect;
}

/**
 * Everything needed to reproduce a chart exactly.
 *
 * Losing any of these fields makes a stored chart unverifiable, which is why
 * they are required rather than optional.
 */
export interface CalculationMetadata {
  readonly ephemerisProvider: string;
  readonly ephemerisVersion: string;
  readonly astroEngineVersion: string;
  readonly houseSystem: HouseSystem;
  readonly orbs: OrbConfig;
  readonly bodies: readonly BodyId[];
  /** The exact UTC instant the chart was computed for. */
  readonly instant: string;
  readonly coordinates: GeoCoordinates;
  /** When the calculation itself ran. Distinct from the chart instant. */
  readonly calculatedAt: string;
}

export interface NatalChart {
  readonly placements: readonly NatalPlacement[];
  readonly angles: ChartAngles;
  readonly cusps: readonly HouseCusp[];
  readonly aspects: readonly NatalAspect[];
  readonly calculationMetadata: CalculationMetadata;
}

export interface NatalChartOptions {
  readonly instant: Date;
  readonly coordinates: GeoCoordinates;
  readonly houseSystem?: HouseSystem;
  readonly bodies?: readonly BodyId[];
  readonly aspects?: readonly AspectDefinition[];
  readonly orbs?: OrbConfig;
}

/**
 * Compute a complete natal chart.
 *
 * Aspects are computed between every unordered pair exactly once; the pair
 * ordering follows the requested body order so results are stable across runs
 * and safe to compare in tests.
 */
export function computeNatalChart(
  provider: EphemerisProvider,
  options: NatalChartOptions,
): NatalChart {
  const {
    instant,
    coordinates,
    houseSystem = 'placidus',
    bodies = DEFAULT_CHART_BODIES,
    aspects: aspectDefinitions = MAJOR_ASPECTS,
    orbs = DEFAULT_ORBS,
  } = options;

  const positions = provider.getBodyPositions(bodies, instant);

  const houses = computeHouseCusps(
    houseSystem,
    provider.getGreenwichSiderealTimeDegrees(instant),
    provider.getObliquityDegrees(instant),
    coordinates,
  );

  const placements: NatalPlacement[] = positions.map((position) => ({
    ...position,
    position: longitudeToZodiac(position.longitude),
    house: houseOfLongitude(position.longitude, houses.cusps),
  }));

  const aspects: NatalAspect[] = [];
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const from = placements[i];
      const to = placements[j];
      if (from === undefined || to === undefined) continue;

      const aspect = findAspect(from.longitude, to.longitude, {
        aspects: aspectDefinitions,
        orbs,
        speeds: { a: from.longitudeSpeed, b: to.longitudeSpeed },
      });

      if (aspect !== null) {
        aspects.push({ from: from.body, to: to.body, aspect });
      }
    }
  }

  return {
    placements,
    angles: houses.angles,
    cusps: houses.cusps,
    aspects,
    calculationMetadata: {
      ephemerisProvider: provider.id,
      ephemerisVersion: provider.version,
      astroEngineVersion: ENGINE_VERSIONS.astro,
      houseSystem,
      orbs,
      bodies: [...bodies],
      instant: instant.toISOString(),
      coordinates,
      calculatedAt: new Date().toISOString(),
    },
  };
}

/** Look up a placement by body, or null when that body was not calculated. */
export function placementOf(chart: NatalChart, body: BodyId): NatalPlacement | null {
  return chart.placements.find((placement) => placement.body === body) ?? null;
}
