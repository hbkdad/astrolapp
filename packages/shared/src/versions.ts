/**
 * Engine version stamps.
 *
 * Every stored calculation records the versions that produced it. Without this
 * a cached natal chart from last year is indistinguishable from one computed
 * under today's rules, and reports stop being reproducible.
 *
 * Bump the relevant constant whenever a change alters numeric output. Adding a
 * field is not a bump; changing a value is.
 */
export const ENGINE_VERSIONS = {
  /** Zodiac, aspect, house, natal and transit geometry. */
  astro: '1.0.0',
  /** Numerology reduction and normalization rules. */
  numerology: '1.0.0',
  /** Lunar phase classification and event search. */
  lunar: '1.0.0',
  /** Heuristic transit/category scoring weights. */
  scoreModel: '1.0.0',
} as const;

export type EngineVersions = typeof ENGINE_VERSIONS;
