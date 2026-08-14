import type { Metadata } from 'next';
import Link from 'next/link';
import { formatZodiacPosition, longitudeToZodiac } from '@astrolapp/astro-engine';
import { readProfile } from '@/lib/profile';
import { computeForProfile } from '@/lib/engine';
import { ChartWheel } from '@/components/ChartWheel';

export const metadata: Metadata = { title: 'My chart' };
export const dynamic = 'force-dynamic';

export default async function ChartPage() {
  const profile = await readProfile();
  if (profile === null) {
    return (
      <div className="max-w-lg">
        <h1 className="font-serif text-3xl">My chart</h1>
        <p className="mt-4 text-parchment-muted">Add your birth details to see your natal chart.</p>
        <Link
          href="/profile"
          className="mt-6 inline-block rounded bg-brass px-5 py-2.5 font-medium text-ink hover:bg-brass-bright"
        >
          Create a birth profile
        </Link>
      </div>
    );
  }

  const { chart, birthTimeUnknown, houseSystemFallback, resolvedInstant } = computeForProfile(
    profile,
    new Date(),
  );
  const showHouses = !birthTimeUnknown;

  return (
    <div>
      <header>
        <h1 className="font-serif text-3xl">Natal chart</h1>
        <p className="mt-2 text-sm text-parchment-muted">
          {profile.placeLabel.length > 0 ? `${profile.placeLabel} · ` : ''}
          {resolvedInstant.instant.toISOString().replace('T', ' ').slice(0, 16)} UTC ·{' '}
          {houseSystemFallback ?? chart.calculationMetadata.houseSystem} houses
        </p>
      </header>

      {birthTimeUnknown && (
        <div className="panel mt-6 border-brass/40 bg-brass/5">
          <h2 className="text-sm font-medium text-brass">Houses are not shown</h2>
          <p className="mt-2 text-xs leading-relaxed text-parchment-muted">
            Without a birth time the Ascendant, Midheaven and house cusps cannot be determined —
            they move through the whole zodiac in 24 hours. Showing them anyway would be inventing
            precision that does not exist. Planetary signs below remain valid, though the Moon may
            be up to about 6° out.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <div className="panel min-w-0">
          <ChartWheel chart={chart} showHouses={showHouses} />
        </div>

        <div className="min-w-0 space-y-8">
          {showHouses && (
            <section aria-labelledby="angles-heading">
              <h2 id="angles-heading" className="eyebrow">
                Angles
              </h2>
              <dl className="panel mt-3 space-y-2 text-sm">
                {(
                  [
                    ['Ascendant', chart.angles.ascendant],
                    ['Midheaven', chart.angles.midheaven],
                    ['Descendant', chart.angles.descendant],
                    ['Imum Coeli', chart.angles.imumCoeli],
                  ] as const
                ).map(([label, longitude]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-parchment-muted">{label}</dt>
                    <dd className="font-mono text-parchment">
                      {formatZodiacPosition(longitudeToZodiac(longitude))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section aria-labelledby="aspects-heading">
            <h2 id="aspects-heading" className="eyebrow">
              Natal aspects
            </h2>
            <div className="panel mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Aspects between bodies in this chart</caption>
                <thead>
                  <tr className="border-b border-ink-line text-left">
                    <th scope="col" className="py-2 pr-3 font-medium text-parchment-muted">
                      Aspect
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium text-parchment-muted">
                      Orb
                    </th>
                    <th scope="col" className="py-2 font-medium text-parchment-muted">
                      Phase
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {chart.aspects.map(({ from, to, aspect }, index) => (
                    <tr key={`${from}-${to}-${index}`} className="border-b border-ink-line/60">
                      <th
                        scope="row"
                        className="py-2 pr-3 text-left font-normal capitalize text-parchment"
                      >
                        {from} {aspect.type} {to}
                      </th>
                      <td className="py-2 pr-3 font-mono text-parchment-muted">
                        {aspect.orb.toFixed(2)}°
                      </td>
                      <td className="py-2 text-parchment-faint">{aspect.phase}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {chart.aspects.length === 0 && (
                <p className="text-sm text-parchment-muted">No major aspects within orb.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <p className="mt-10 font-mono text-[10px] leading-relaxed text-parchment-faint">
        Computed with {chart.calculationMetadata.ephemerisProvider}{' '}
        {chart.calculationMetadata.ephemerisVersion}, engine{' '}
        {chart.calculationMetadata.astroEngineVersion}. This chart is reproducible from these
        values.
      </p>
    </div>
  );
}
