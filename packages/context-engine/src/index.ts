export {
  CATEGORIES,
  TRANSITING_BODY_AFFINITY,
  NATAL_TARGET_AFFINITY,
  ASPECT_VALENCE,
  CONJUNCTION_VALENCE,
  scoreCategories,
  computeValenceTotals,
  valenceOf,
  transitKey,
} from './categories.js';
export type { Category, CategoryScore, CategoryContribution, AffinityTable } from './categories.js';

export { computeDailyContext } from './context.js';
export type {
  DailyContext,
  PersonalContextOptions,
  NumerologyInput,
  NumerologyContext,
  Signal,
} from './context.js';

export {
  computeSolarSignContext,
  computeAllSolarSignContexts,
  solarHouseOf,
  referenceInstantFor,
} from './solar.js';
export type { SolarSignContext, SolarPlacement, SkyAspect } from './solar.js';
