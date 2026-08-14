/**
 * Prints a complete deterministic daily reading.
 *
 * Run with: pnpm demo
 * Exists so the output can be reviewed by eye, not just asserted in tests.
 */
import {
  computeNatalChart,
  defaultEphemerisProvider as provider,
  resolveLocalTimeToInstant,
} from '@astrolapp/astro-engine';
import { PythagoreanNumerology } from '@astrolapp/numerology-engine';
import { computeDailyContext } from '@astrolapp/context-engine';
import { buildDailyReading } from '@astrolapp/interpretation-engine';

const birth = resolveLocalTimeToInstant(
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30 },
  'Europe/London',
);

const chart = computeNatalChart(provider, {
  instant: birth.instant,
  coordinates: { latitude: 51.5074, longitude: -0.1278 },
});

const context = computeDailyContext(provider, {
  chart,
  date: new Date('2026-08-09T12:00:00Z'),
  numerology: {
    system: new PythagoreanNumerology(),
    birthDate: { year: 1990, month: 5, day: 15 },
    fullName: 'John Smith',
  },
});

const reading = buildDailyReading(context);

console.log(`\n${'='.repeat(74)}\n${reading.headline.toUpperCase()}\n${'='.repeat(74)}`);
console.log(`${reading.date}   Overall ${reading.overall} (${reading.overallBand})`);
console.log(`\n${reading.summary}`);

console.log('\n-- CATEGORIES ' + '-'.repeat(60));
for (const c of reading.categories) {
  console.log(
    `  ${c.category.padEnd(15)} ${String(c.score).padStart(5)}  ${c.band.padEnd(20)} ${c.confidenceLabel}`,
  );
}

console.log('\n-- STRONGEST TRANSIT ' + '-'.repeat(53));
if (reading.strongestTransit) {
  console.log(`  ${reading.strongestTransit.title}   [source: ${reading.strongestTransit.source}]`);
  console.log(`\n  FACT:           ${reading.strongestTransit.fact}`);
  console.log(`\n  INTERPRETATION: ${reading.strongestTransit.interpretation}`);
}

console.log('\n-- MOON ' + '-'.repeat(66));
console.log(`  FACT:           ${reading.moonPhase.fact}`);
console.log(`  INTERPRETATION: ${reading.moonPhase.interpretation}`);
console.log(`  ${reading.upcomingLunations.join('\n  ')}`);

console.log('\n-- NUMEROLOGY ' + '-'.repeat(60));
for (const n of reading.numerology) console.log(`  ${n.title}`);

console.log('\n-- WHY (career) ' + '-'.repeat(58));
const career = reading.categories.find((c) => c.category === 'career');
if (career) console.log(`  ${career.explanation}`);

console.log(`\n${reading.disclaimer}\n`);
