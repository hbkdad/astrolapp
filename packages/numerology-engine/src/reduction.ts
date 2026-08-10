/**
 * Digit reduction, the operation underneath every numerology value.
 */

import type { MasterNumber, TraceStep } from './types.js';

/** Sum of the decimal digits of a non-negative integer. */
export function digitSum(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`digitSum expects a non-negative integer, received ${value}`);
  }
  let total = 0;
  let remaining = value;
  while (remaining > 0) {
    total += remaining % 10;
    remaining = Math.floor(remaining / 10);
  }
  return value === 0 ? 0 : total;
}

export interface ReductionResult {
  readonly value: number;
  readonly isMasterNumber: boolean;
  /** Every intermediate value, starting with the input. */
  readonly steps: readonly number[];
}

/**
 * Reduce to a single digit, stopping early on a master number.
 *
 * The master-number check happens before the single-digit check on each pass,
 * which is what makes 29 -> 11 stop at 11 rather than continuing to 2. Passing
 * an empty `masterNumbers` disables that behaviour entirely.
 */
export function reduceNumber(
  value: number,
  masterNumbers: readonly MasterNumber[] = [11, 22, 33],
): ReductionResult {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`reduceNumber expects a non-negative integer, received ${value}`);
  }

  const steps: number[] = [value];
  let current = value;

  const isMaster = (candidate: number): boolean =>
    masterNumbers.includes(candidate as MasterNumber);

  if (isMaster(current)) {
    return { value: current, isMasterNumber: true, steps };
  }

  while (current > 9) {
    current = digitSum(current);
    steps.push(current);
    if (isMaster(current)) {
      return { value: current, isMasterNumber: true, steps };
    }
  }

  return { value: current, isMasterNumber: false, steps };
}

/** Render a reduction as a readable trace step, e.g. `1987 -> 25 -> 7`. */
export function reductionTrace(label: string, result: ReductionResult): TraceStep {
  return {
    label,
    detail: result.steps.join(' → '),
    value: result.value,
  };
}
