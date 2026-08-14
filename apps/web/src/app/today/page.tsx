import type { Metadata } from 'next';
import Link from 'next/link';
import { readProfile } from '@/lib/profile';
import { computeForProfile } from '@/lib/engine';
import { ScoreBar } from '@/components/ScoreBar';
import { InterpretationCard } from '@/components/InterpretationCard';

// Personal pages render one visitor's own chart. `noindex` keeps them out
// of search results even if a link leaks; robots.ts disallows them too.
export const metadata: Metadata = { title: 'Today', robots: { index: false, follow: false } };

// Positions change continuously, so this page is always computed fresh.
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const profile = await readProfile();
  if (profile === null) {
    return (
      <div className="max-w-lg">
        <h1 className="font-serif text-3xl">Today</h1>
        <p className="mt-4 text-parchment-muted">
          Add your birth details to see a personalised reading.
        </p>
        <Link
          href="/profile"
          className="mt-6 inline-block rounded bg-brass px-5 py-2.5 font-medium text-ink hover:bg-brass-bright"
        >
          Create a birth profile
        </Link>
      </div>
    );
  }

  const now = new Date();
  const { reading, context, resolvedInstant, birthTimeUnknown, houseSystemFallback } =
    computeForProfile(profile, now);

  return (
    <div>
      <header>
        <p className="eyebrow">
          {now.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-snug sm:text-4xl">{reading.headline}</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-parchment-muted">{reading.summary}</p>
      </header>

      {/* Data-quality warnings must be prominent, not buried. */}
      {(birthTimeUnknown || resolvedInstant.kind !== 'unique' || houseSystemFallback !== null) && (
        <div className="panel mt-6 border-brass/40 bg-brass/5">
          <h2 className="text-sm font-medium text-brass">About this calculation</h2>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-parchment-muted">
            {birthTimeUnknown && (
              <li>
                No birth time was given, so the Ascendant, Midheaven and house placements cannot be
                calculated and are not shown. Planetary positions are computed from noon and the
                Moon may be up to about 6° out.
              </li>
            )}
            {resolvedInstant.kind === 'ambiguous' && (
              <li>
                That local time occurred twice on the day the clocks went back. The earlier of the
                two instants was used; the alternative would move the Ascendant by roughly 15°.
              </li>
            )}
            {resolvedInstant.kind === 'nonexistent' && (
              <li>
                That local time did not occur — the clocks jumped forward past it. The instant just
                after the transition was used. Please double-check the birth time.
              </li>
            )}
            {houseSystemFallback !== null && (
              <li>
                Placidus houses are undefined at this latitude, so {houseSystemFallback} houses were
                used instead.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="eyebrow">
            Areas of life
          </h2>
          <div className="panel mt-3 divide-y divide-ink-line">
            {reading.categories.map((category) => (
              <ScoreBar
                key={category.category}
                label={category.category}
                score={category.score}
                band={category.band}
                confidenceLabel={category.confidenceLabel}
                explanation={category.explanation}
              />
            ))}
          </div>
        </section>

        <div className="space-y-8">
          <section aria-labelledby="overall-heading">
            <h2 id="overall-heading" className="eyebrow">
              Overall
            </h2>
            <div className="panel mt-3">
              <p className="font-mono text-4xl text-parchment">{reading.overall.toFixed(0)}</p>
              <p className="mt-1 text-sm text-parchment-muted">
                out of 100 · {reading.overallBand}
              </p>
              <p className="mt-4 text-xs leading-relaxed text-parchment-faint">
                A confidence-weighted average of the areas above. This is a product heuristic, not a
                measurement.
              </p>
            </div>
          </section>

          <section aria-labelledby="moon-heading">
            <h2 id="moon-heading" className="eyebrow">
              Moon
            </h2>
            <div className="panel mt-3">
              <p className="font-serif text-xl">{reading.moonPhase.title}</p>
              <p className="mt-1 text-sm text-parchment-muted">
                in <span className="capitalize">{context.moon.position.sign}</span> ·{' '}
                {(context.moon.illumination * 100).toFixed(0)}% illuminated
              </p>
              <p className="mt-4 text-sm leading-relaxed text-parchment">
                {reading.moonPhase.interpretation}
              </p>
              <ul className="mt-4 space-y-1 font-mono text-xs text-parchment-faint">
                {reading.upcomingLunations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </section>

          {reading.numerology.length > 0 && (
            <section aria-labelledby="numerology-heading">
              <h2 id="numerology-heading" className="eyebrow">
                Numerology
              </h2>
              <dl className="panel mt-3 space-y-3">
                {reading.numerology.map((entry) => (
                  <div key={entry.key} className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-parchment-muted">
                      {entry.title.replace(/\s\d+$/, '')}
                    </dt>
                    <dd className="font-mono text-lg text-parchment">
                      {entry.title.match(/\d+$/)?.[0] ?? ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>

      <section aria-labelledby="transits-heading" className="mt-12">
        <h2 id="transits-heading" className="eyebrow">
          Active transits
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-parchment-muted">
          Each card shows the calculated position first, then how astrology traditionally reads it.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {reading.transits.slice(0, 6).map((interpretation, index) => (
            <InterpretationCard
              key={`${interpretation.key}-${index}`}
              interpretation={interpretation}
            />
          ))}
        </div>
        {reading.transits.length === 0 && (
          <p className="panel mt-4 text-sm text-parchment-muted">
            No transit is currently within orb of a significant natal point. Quiet days are normal.
          </p>
        )}
      </section>

      <p className="mt-10 font-mono text-[10px] leading-relaxed text-parchment-faint">
        Engine {reading.metadata.astroEngineVersion} · scores {reading.metadata.scoreModelVersion} ·
        ephemeris {reading.metadata.ephemerisProvider} {reading.metadata.ephemerisVersion}
      </p>
    </div>
  );
}
