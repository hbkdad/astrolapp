export type { Interpretation, InterpretationEntry, Tone } from './types.js';

export { transitFact, lunarFact, numerologyFact, lunationFact } from './facts.js';

export {
  interpretTransit,
  interpretMoonPhase,
  interpretMoonSign,
  interpretNumerologyValue,
} from './interpret.js';
export type { NumerologyValueKind } from './interpret.js';

export { TRANSITING_BODY_THEMES, NATAL_TARGET_THEMES, ASPECT_THEMES } from './content/themes.js';
export { MOON_PHASE_ENTRIES, MOON_SIGN_THEMES, moonSignEntry } from './content/moon.js';
export { SPECIFIC_TRANSIT_ENTRIES } from './content/specific-transits.js';
export {
  NUMBER_THEMES,
  lifePathEntry,
  personalYearEntry,
  personalMonthEntry,
  personalDayEntry,
} from './content/numerology.js';

export {
  buildDailyReading,
  describeScore,
  describeConfidence,
  humaniseCategory,
  READING_DISCLAIMER,
} from './reading.js';
export type { DailyReading, CategoryReading } from './reading.js';

export {
  AI_INSTRUCTIONS,
  buildAiReadingInput,
  validateAiReading,
  findUnsupportedClaims,
  deterministicFallbackReading,
  resolveReading,
} from './ai.js';
export type { AiReading, AiReadingInput, AiValidationResult } from './ai.js';
