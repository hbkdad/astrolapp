import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PythagoreanNumerology } from '@astrolapp/numerology-engine';
import { NUMBER_THEMES, lifePathEntry } from '@astrolapp/interpretation-engine';
import { Breadcrumbs, JsonLd, breadcrumbJsonLd, canonical } from '@/lib/seo';

/**
 * Life Path reference pages.
 *
 * Static: the meaning of a Life Path number does not change. The value these
 * add over the many existing pages on the subject is that the METHOD is shown —
 * a worked example with every reduction step, so a reader can reproduce the
 * number rather than take it on trust.
 */
export const dynamic = 'force-static';

const LIFE_PATH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33] as const;

export function generateStaticParams() {
  return LIFE_PATH_NUMBERS.map((number) => ({ number: String(number) }));
}

function parseNumber(raw: string): number | null {
  const value = Number(raw);
  return (LIFE_PATH_NUMBERS as readonly number[]).includes(value) ? value : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>;
}): Promise<Metadata> {
  const { number } = await params;
  const value = parseNumber(number);
  if (value === null) return {};

  const theme = NUMBER_THEMES[value];
  return {
    title: `Life Path ${value} — meaning and how it is calculated`,
    description:
      `Life Path ${value} is traditionally associated with ${theme?.theme ?? 'its own themes'}. ` +
      `Includes the full Pythagorean calculation, step by step, so you can check the number yourself.`,
    alternates: { canonical: canonical(`/numerology/life-path/${value}`) },
  };
}

export default async function LifePathPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const value = parseNumber(number);
  if (value === null) notFound();

  const entry = lifePathEntry(value);
  const isMaster = value === 11 || value === 22 || value === 33;

  // A worked example whose Life Path really is this number, found by search so
  // the demonstration is never wrong.
  const system = new PythagoreanNumerology();
  const example = findExample(system, value);

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Numerology', path: '/numerology/life-path/1' },
    { name: `Life Path ${value}`, path: `/numerology/life-path/${value}` },
  ];

  return (
    <article>
      <JsonLd json={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />

      <header>
        <p className="eyebrow">Pythagorean numerology</p>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl">Life Path {value}</h1>
        {isMaster && (
          <p className="mt-3 inline-block rounded-full border border-brass/50 px-3 py-1 text-xs text-brass">
            Master number — not reduced further
          </p>
        )}
        <p className="mt-4 max-w-2xl leading-relaxed text-parchment-muted">{entry.body}</p>
      </header>

      <section aria-labelledby="method-heading" className="mt-10">
        <h2 id="method-heading" className="eyebrow">
          How the number is calculated
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-parchment-muted">
          The Life Path comes from the birth date. This engine reduces the month, day and year
          separately and then sums them — the component method. Summing every digit of the date in
          one pass gives a different answer for some dates, so the method is stated rather than
          assumed.
        </p>

        {example !== null && (
          <div className="panel mt-4">
            <p className="text-sm text-parchment">
              Worked example — someone born on{' '}
              <span className="font-mono">
                {String(example.date.day).padStart(2, '0')}/
                {String(example.date.month).padStart(2, '0')}/{example.date.year}
              </span>
              :
            </p>
            <ol className="mt-3 space-y-1.5 font-mono text-sm text-parchment-muted">
              {example.value.trace
                .filter((step) => step.label !== 'Method')
                .map((step) => (
                  <li key={`${step.label}-${step.detail}`}>
                    <span className="text-parchment-faint">{step.label}:</span> {step.detail}
                  </li>
                ))}
            </ol>
            <p className="mt-3 text-sm text-parchment">
              Life Path <span className="font-mono text-brass">{example.value.value}</span>
              {example.value.isMasterNumber && ' — a master number, so reduction stops here.'}
            </p>
          </div>
        )}
      </section>

      <nav aria-label="Other life path numbers" className="mt-12">
        <h2 className="eyebrow">Every Life Path number</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {LIFE_PATH_NUMBERS.map((other) => (
            <li key={other}>
              <Link
                href={`/numerology/life-path/${other}`}
                aria-current={other === value ? 'page' : undefined}
                className={`inline-block rounded border px-3 py-1.5 font-mono text-sm ${
                  other === value
                    ? 'border-brass text-brass'
                    : 'border-ink-line text-parchment-muted hover:border-brass hover:text-parchment'
                }`}
              >
                {other}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="panel mt-12 border-brass/30 bg-brass/5">
        <h2 className="font-serif text-xl">Your full numerology profile</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-parchment-muted">
          The Life Path is one of several values. Expression, Soul Urge, Personality and the
          Personal Year, Month and Day cycles are all computed from your name and birth date — each
          shown with its own calculation trace.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded bg-brass px-5 py-2.5 font-medium text-ink hover:bg-brass-bright"
        >
          Calculate my numbers
        </Link>
      </section>

      <p className="mt-10 max-w-2xl text-xs leading-relaxed text-parchment-faint">
        Numerology is an interpretive tradition, not established science. Traditions differ on
        reduction rules; the method used here is stated above so the result can be reproduced.
      </p>
    </article>
  );
}

/**
 * Find a real birth date whose Life Path equals the target.
 *
 * Searched rather than hardcoded so the worked example is guaranteed correct
 * for every number, including the master numbers, which are rarer.
 */
function findExample(
  system: PythagoreanNumerology,
  target: number,
): {
  date: { year: number; month: number; day: number };
  value: ReturnType<PythagoreanNumerology['calculateLifePath']>;
} | null {
  for (let year = 1985; year <= 1999; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 28; day += 1) {
        const date = { year, month, day };
        const value = system.calculateLifePath(date);
        if (value.value === target) return { date, value };
      }
    }
  }
  return null;
}
