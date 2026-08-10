export { BODY_IDS, DEFAULT_CHART_BODIES } from './ephemeris/types.js';
export type { BodyId, BodyPosition, EphemerisProvider } from './ephemeris/types.js';
export {
  AstronomyEngineProvider,
  defaultEphemerisProvider,
} from './ephemeris/astronomy-engine-provider.js';

export {
  ZODIAC_SIGNS,
  DEGREES_PER_SIGN,
  longitudeToZodiac,
  signStartLongitude,
  elementOf,
  modalityOf,
  polarityOf,
  formatZodiacPosition,
} from './zodiac.js';
export type { ZodiacSign, ZodiacPosition, Element, Modality, Polarity } from './zodiac.js';

export {
  MAJOR_ASPECTS,
  MINOR_ASPECTS,
  ALL_ASPECTS,
  DEFAULT_ORBS,
  findAspect,
  findAllAspects,
} from './aspects.js';
export type { Aspect, AspectDefinition, AspectType, AspectPhase, OrbConfig } from './aspects.js';

export {
  HOUSE_SYSTEMS,
  HouseSystemUndefinedError,
  computeChartAngles,
  computeHouseCusps,
  houseOfLongitude,
} from './houses.js';
export type { HouseSystem, HouseCusp, HouseCusps, ChartAngles, GeoCoordinates } from './houses.js';

export { resolveLocalTimeToInstant, assertValidTimeZone } from './time.js';
export type { LocalDateTime, ResolvedInstant, TimeResolutionKind } from './time.js';

export { computeNatalChart, placementOf } from './natal.js';
export type {
  NatalChart,
  NatalChartOptions,
  NatalPlacement,
  NatalAspect,
  CalculationMetadata,
} from './natal.js';

export {
  MOON_PHASES,
  MEAN_SYNODIC_MONTH_DAYS,
  classifyMoonPhase,
  computePhaseAngle,
  computeLunarState,
  computeUpcomingLunations,
  findPreviousNewMoon,
  findNextPhase,
  findNextMoonSignIngress,
} from './lunar.js';
export type { MoonPhaseName, LunarState, UpcomingLunations, MoonSignIngress } from './lunar.js';

export { DEFAULT_TRANSIT_WEIGHTS, computeTransits, findTransitWindow } from './transits.js';
export type {
  TransitEvent,
  TransitOptions,
  TransitScoreWeights,
  TransitWindow,
  NatalTarget,
} from './transits.js';
