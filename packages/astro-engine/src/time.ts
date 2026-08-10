/**
 * Local civil time to UTC instant resolution.
 *
 * A birth chart is computed from an absolute instant, but users supply a wall
 * clock reading and a place. Getting this wrong by one hour moves the ascendant
 * by roughly 15 degrees — a whole sign — so the conversion is explicit, uses the
 * IANA database via Intl rather than fixed offsets, and reports when the input
 * was ambiguous instead of quietly picking one answer.
 */

/** A wall-clock reading with no timezone attached. */
export interface LocalDateTime {
  readonly year: number;
  /** 1..12. Calendar month, not the zero-based JavaScript convention. */
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second?: number;
}

/**
 * How a local time mapped onto the UTC timeline.
 *
 * - `unique`: the normal case.
 * - `ambiguous`: the reading occurs twice, during a daylight-saving fall-back.
 *   The earlier instant (still on daylight time) is returned by convention.
 * - `nonexistent`: the reading is inside a spring-forward gap and never
 *   occurred. The instant just after the transition is returned.
 *
 * The last two must be surfaced to the user rather than silently resolved: a
 * birth certificate reading of 01:30 on a fall-back night is genuinely
 * uncertain, and the chart should say so.
 */
export type TimeResolutionKind = 'unique' | 'ambiguous' | 'nonexistent';

export interface ResolvedInstant {
  readonly instant: Date;
  readonly kind: TimeResolutionKind;
  /** UTC offset actually applied, in minutes east of Greenwich. */
  readonly offsetMinutes: number;
  /** The IANA zone used, echoed back for storage alongside the chart. */
  readonly timeZone: string;
}

const MILLISECONDS_PER_MINUTE = 60_000;
const DAY_IN_MILLISECONDS = 86_400_000;

/**
 * UTC offset in effect in `timeZone` at a given instant, in milliseconds.
 *
 * Works by formatting the instant as local wall time in the target zone, then
 * reinterpreting those components as if they were UTC. The gap between that and
 * the true instant is the offset.
 */
function offsetMillisecondsAt(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(instant);
  const lookup: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      lookup[part.type] = Number(part.value);
    }
  }

  const year = lookup.year;
  const month = lookup.month;
  const day = lookup.day;
  const hour = lookup.hour;
  const minute = lookup.minute;
  const second = lookup.second;

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new Error(`Could not read local time parts for time zone '${timeZone}'`);
  }

  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  // Milliseconds are not part of the formatted output, so compare on whole seconds.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Validate an IANA zone name early, with a clearer message than Intl's. */
export function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new RangeError(`Unknown IANA time zone: '${timeZone}'`);
  }
}

/**
 * Resolve a local civil reading to a UTC instant.
 *
 * The offset depends on the instant, and the instant depends on the offset, so
 * this evaluates the offset at a first guess and then re-evaluates at the
 * corrected instant. Where the two disagree the reading sits on a transition,
 * which is detected and reported rather than hidden.
 */
export function resolveLocalTimeToInstant(local: LocalDateTime, timeZone: string): ResolvedInstant {
  assertValidTimeZone(timeZone);

  const naiveUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second ?? 0,
  );

  // Probe a day either side so that both the pre- and post-transition offsets
  // are considered. Probing only at the naive instant is not enough: during a
  // fall-back both probes return the same offset and the overlap goes unseen.
  const candidateOffsets = new Set(
    [-DAY_IN_MILLISECONDS, 0, DAY_IN_MILLISECONDS].map((shift) =>
      offsetMillisecondsAt(new Date(naiveUtc + shift), timeZone),
    ),
  );

  // An offset is a real solution only if the instant it implies is itself
  // governed by that same offset. Counting the solutions classifies the input:
  // two means the reading happened twice, none means it never happened.
  const solutions: { instant: number; offset: number }[] = [];
  for (const offset of candidateOffsets) {
    const instant = naiveUtc - offset;
    if (offsetMillisecondsAt(new Date(instant), timeZone) === offset) {
      solutions.push({ instant, offset });
    }
  }
  solutions.sort((left, right) => left.instant - right.instant);

  // The earliest solution, if any. For an overlap this is the instant still on
  // the pre-transition (usually daylight) offset, which is the convention here.
  const earliest = solutions.at(0);

  let kind: TimeResolutionKind;
  let chosen: { instant: number; offset: number };

  if (earliest === undefined) {
    // Spring-forward gap: the wall time never occurred. Convention: apply the
    // pre-transition offset, which lands just after the clocks jumped.
    kind = 'nonexistent';
    const offset = offsetMillisecondsAt(new Date(naiveUtc), timeZone);
    chosen = { instant: naiveUtc - offset, offset };
  } else {
    kind = solutions.length > 1 ? 'ambiguous' : 'unique';
    chosen = earliest;
  }

  return {
    instant: new Date(chosen.instant),
    kind,
    offsetMinutes: chosen.offset / MILLISECONDS_PER_MINUTE,
    timeZone,
  };
}
