/**
 * Chart angles and house cusps.
 *
 * Pure spherical trigonometry. The only astronomical inputs are sidereal time
 * and obliquity, both supplied by the ephemeris provider so that houses and
 * planets are always expressed in the same frame.
 */

import { normalizeDegrees, toDegrees, toRadians } from '@astrolapp/shared';
import { longitudeToZodiac, signStartLongitude, type ZodiacPosition } from './zodiac.js';

export const HOUSE_SYSTEMS = ['placidus', 'whole-sign', 'equal'] as const;
export type HouseSystem = (typeof HOUSE_SYSTEMS)[number];

export interface GeoCoordinates {
  /** Degrees north of the equator; negative for the southern hemisphere. */
  readonly latitude: number;
  /** Degrees east of Greenwich; negative for the western hemisphere. */
  readonly longitude: number;
}

/** The four cardinal points of a chart, as ecliptic longitudes. */
export interface ChartAngles {
  readonly ascendant: number;
  readonly midheaven: number;
  readonly descendant: number;
  readonly imumCoeli: number;
  /** Right ascension of the midheaven, degrees. Retained for reproducibility. */
  readonly rightAscensionMidheaven: number;
  /** True obliquity used, degrees. Retained for reproducibility. */
  readonly obliquity: number;
}

export interface HouseCusp {
  /** House number, 1..12. */
  readonly house: number;
  /** Ecliptic longitude of the cusp, [0, 360). */
  readonly longitude: number;
  readonly position: ZodiacPosition;
}

export interface HouseCusps {
  readonly system: HouseSystem;
  /** Twelve cusps in house order, index 0 being the first house. */
  readonly cusps: readonly HouseCusp[];
  readonly angles: ChartAngles;
}

/**
 * Raised when Placidus cannot be computed for the requested location.
 *
 * Placidus divides a body's diurnal semi-arc, and above roughly 66 degrees of
 * latitude parts of the ecliptic never rise or set, so the division has no
 * solution. Callers should fall back to a system that is defined everywhere —
 * Whole Sign or Equal — rather than treating this as a transient failure.
 */
export class HouseSystemUndefinedError extends Error {
  constructor(
    readonly system: HouseSystem,
    readonly latitude: number,
    message: string,
  ) {
    super(message);
    this.name = 'HouseSystemUndefinedError';
  }
}

/**
 * Ecliptic longitude of the point on the ecliptic with the given right
 * ascension. Inverts `tan(RA) = tan(longitude) * cos(obliquity)` with correct
 * quadrant handling; dividing by `cos(obliquity)` is safe because obliquity is
 * ~23 degrees and never approaches 90.
 */
function eclipticLongitudeFromRightAscension(
  rightAscensionRad: number,
  obliquityRad: number,
): number {
  return normalizeDegrees(
    toDegrees(
      Math.atan2(Math.sin(rightAscensionRad) / Math.cos(obliquityRad), Math.cos(rightAscensionRad)),
    ),
  );
}

/**
 * Compute the ascendant, midheaven and their opposites.
 *
 * The ascendant is the ecliptic degree rising on the eastern horizon; the
 * midheaven is the ecliptic degree on the upper meridian. Both follow from the
 * local sidereal time and the observer's latitude.
 */
export function computeChartAngles(
  greenwichSiderealTimeDegrees: number,
  obliquityDegrees: number,
  coordinates: GeoCoordinates,
): ChartAngles {
  const rightAscensionMidheaven = normalizeDegrees(
    greenwichSiderealTimeDegrees + coordinates.longitude,
  );
  const ramc = toRadians(rightAscensionMidheaven);
  const obliquity = toRadians(obliquityDegrees);
  const latitude = toRadians(coordinates.latitude);

  const midheaven = normalizeDegrees(
    toDegrees(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(obliquity))),
  );

  const ascendant = normalizeDegrees(
    toDegrees(
      Math.atan2(
        Math.cos(ramc),
        -(Math.sin(ramc) * Math.cos(obliquity) + Math.tan(latitude) * Math.sin(obliquity)),
      ),
    ),
  );

  return {
    ascendant,
    midheaven,
    descendant: normalizeDegrees(ascendant + 180),
    imumCoeli: normalizeDegrees(midheaven + 180),
    rightAscensionMidheaven,
    obliquity: obliquityDegrees,
  };
}

/** Which of the four intermediate Placidus cusps is being solved. */
interface PlacidusCuspSpec {
  readonly house: number;
  /** Fraction of the semi-arc, 1/3 or 2/3. */
  readonly fraction: number;
  /** Diurnal cusps are measured forward from the MC, nocturnal back from the IC. */
  readonly hemisphere: 'diurnal' | 'nocturnal';
}

const PLACIDUS_SPECS: readonly PlacidusCuspSpec[] = [
  { house: 11, fraction: 1 / 3, hemisphere: 'diurnal' },
  { house: 12, fraction: 2 / 3, hemisphere: 'diurnal' },
  { house: 2, fraction: 2 / 3, hemisphere: 'nocturnal' },
  { house: 3, fraction: 1 / 3, hemisphere: 'nocturnal' },
];

const PLACIDUS_MAX_ITERATIONS = 100;
const PLACIDUS_CONVERGENCE_DEGREES = 1e-9;

/**
 * Solve one intermediate Placidus cusp by fixed-point iteration.
 *
 * A Placidus cusp is where a body has completed a set fraction of its semi-arc,
 * but the semi-arc depends on the body's declination, which depends on where the
 * cusp is. The relation is implicit, so it is iterated to convergence:
 *
 *   RA -> longitude -> declination -> ascensional difference -> RA
 *
 * The iteration is a contraction at usable latitudes and settles in well under
 * ten passes; the iteration cap only guards against pathological inputs.
 */
function solvePlacidusCusp(
  spec: PlacidusCuspSpec,
  rightAscensionMidheavenDeg: number,
  obliquityRad: number,
  latitudeRad: number,
): number {
  const baseOffset = spec.hemisphere === 'diurnal' ? spec.fraction * 90 : 180 - spec.fraction * 90;

  let rightAscension = normalizeDegrees(rightAscensionMidheavenDeg + baseOffset);

  for (let iteration = 0; iteration < PLACIDUS_MAX_ITERATIONS; iteration += 1) {
    const longitude = eclipticLongitudeFromRightAscension(toRadians(rightAscension), obliquityRad);
    const declination = Math.asin(Math.sin(obliquityRad) * Math.sin(toRadians(longitude)));

    // Ascensional difference: how far sunrise for this declination shifts from
    // the 6-hour mark. Undefined where the point is circumpolar.
    const ascensionalDifferenceSin = Math.tan(latitudeRad) * Math.tan(declination);
    if (Math.abs(ascensionalDifferenceSin) > 1) {
      throw new HouseSystemUndefinedError(
        'placidus',
        toDegrees(latitudeRad),
        `Placidus house ${spec.house} is undefined at latitude ${toDegrees(latitudeRad).toFixed(4)}: ` +
          `the relevant ecliptic degree is circumpolar. Fall back to whole-sign or equal houses.`,
      );
    }
    const ascensionalDifference = toDegrees(Math.asin(ascensionalDifferenceSin));

    const offset =
      spec.hemisphere === 'diurnal'
        ? spec.fraction * (90 + ascensionalDifference)
        : 180 - spec.fraction * (90 - ascensionalDifference);

    const next = normalizeDegrees(rightAscensionMidheavenDeg + offset);
    const delta = Math.abs(normalizeDegrees(next - rightAscension + 180) - 180);
    rightAscension = next;

    if (delta < PLACIDUS_CONVERGENCE_DEGREES) break;
  }

  return eclipticLongitudeFromRightAscension(toRadians(rightAscension), obliquityRad);
}

/**
 * Compute the twelve house cusps.
 *
 * Note that only Placidus places the midheaven on the tenth cusp. Under Whole
 * Sign and Equal houses the MC floats and may land in the ninth, tenth or
 * eleventh house — that is correct behaviour, not a bug, and it is why the
 * angles are returned separately from the cusps.
 */
export function computeHouseCusps(
  system: HouseSystem,
  greenwichSiderealTimeDegrees: number,
  obliquityDegrees: number,
  coordinates: GeoCoordinates,
): HouseCusps {
  const angles = computeChartAngles(greenwichSiderealTimeDegrees, obliquityDegrees, coordinates);
  const longitudes = computeCuspLongitudes(system, angles, obliquityDegrees, coordinates);

  return {
    system,
    angles,
    cusps: longitudes.map((longitude, index) => ({
      house: index + 1,
      longitude,
      position: longitudeToZodiac(longitude),
    })),
  };
}

function computeCuspLongitudes(
  system: HouseSystem,
  angles: ChartAngles,
  obliquityDegrees: number,
  coordinates: GeoCoordinates,
): number[] {
  switch (system) {
    case 'whole-sign': {
      const start = signStartLongitude(longitudeToZodiac(angles.ascendant).sign);
      return Array.from({ length: 12 }, (_, index) => normalizeDegrees(start + index * 30));
    }

    case 'equal': {
      return Array.from({ length: 12 }, (_, index) =>
        normalizeDegrees(angles.ascendant + index * 30),
      );
    }

    case 'placidus': {
      const obliquityRad = toRadians(obliquityDegrees);
      const latitudeRad = toRadians(coordinates.latitude);

      const intermediate = new Map<number, number>();
      for (const spec of PLACIDUS_SPECS) {
        intermediate.set(
          spec.house,
          solvePlacidusCusp(spec, angles.rightAscensionMidheaven, obliquityRad, latitudeRad),
        );
      }

      const cuspFor = (house: number): number => {
        const value = intermediate.get(house);
        if (value === undefined) throw new Error(`Missing Placidus cusp ${house}`);
        return value;
      };

      // Houses 4-9 are exactly opposite houses 10-3.
      return [
        angles.ascendant,
        cuspFor(2),
        cuspFor(3),
        angles.imumCoeli,
        normalizeDegrees(cuspFor(11) + 180),
        normalizeDegrees(cuspFor(12) + 180),
        angles.descendant,
        normalizeDegrees(cuspFor(2) + 180),
        normalizeDegrees(cuspFor(3) + 180),
        angles.midheaven,
        cuspFor(11),
        cuspFor(12),
      ];
    }

    default: {
      const exhaustive: never = system;
      throw new RangeError(`Unsupported house system: ${String(exhaustive)}`);
    }
  }
}

/**
 * Which house a longitude falls in, 1..12.
 *
 * Houses are unequal under Placidus, so this walks the cusps and measures the
 * forward arc from each cusp rather than dividing by 30. Comparing forward arcs
 * keeps the 0/360 boundary from splitting a house in two.
 */
export function houseOfLongitude(longitude: number, cusps: readonly HouseCusp[]): number {
  if (cusps.length !== 12) {
    throw new RangeError(`Expected 12 cusps, received ${cusps.length}`);
  }

  const target = normalizeDegrees(longitude);

  for (let index = 0; index < 12; index += 1) {
    const current = cusps[index];
    const next = cusps[(index + 1) % 12];
    if (current === undefined || next === undefined) continue;

    const spanToNext = normalizeDegrees(next.longitude - current.longitude);
    const spanToTarget = normalizeDegrees(target - current.longitude);

    // A zero-width span would mean duplicate cusps; treating it as non-matching
    // avoids assigning every longitude to a degenerate house.
    if (spanToNext > 0 && spanToTarget < spanToNext) {
      return current.house;
    }
  }

  // Unreachable for well-formed cusps, which partition the full circle.
  throw new Error(`Could not place longitude ${longitude} in any house`);
}
