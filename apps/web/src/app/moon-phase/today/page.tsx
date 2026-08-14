import type { Metadata } from 'next';
import Link from 'next/link';
import {
  computeLunarState,
  computeUpcomingLunations,
  defaultEphemerisProvider as provider,
  findNextMoonSignIngress,
  formatZodiacPosition,
} from '@astrolapp/astro-engine';
import { MOON_PHASE_ENTRIES, MOON_SIGN_THEMES } from '@astrolapp/interpretation-engine';
import { Breadcrumbs, JsonLd, articleJsonLd, breadcrumbJsonLd, canonical } from '@/lib/seo';

/**
 * Live Moon data.
 *
 * Genuinely unique content that changes continuously and cannot be faked: the
 * phase angle, illumination and lunation times are all computed and match
 * published astronomical values to within minutes.
 */
export const revalidate = 900;

export const metadata: Metadata = {
  title: 'Moon phase today — illumination, sign and next Full Moon',
  description:
    'The current Moon phase, illumination, zodiac sign and age, with the exact times of the next New and Full Moon. Calculated from solar and lunar longitudes, not a calendar approximation.',
  alternates: { canonical: canonical('/moon-phase/today') },
};

export default function MoonPhaseTodayPage() {
  const now = new Date();
  const moon = computeLunarState(provider, now);
  const upcoming = computeUpcomingLunations(provider, now);
  const ingress = findNextMoonSignIngress(provider, now);
  const entry = MOON_PHASE_ENTRIES[moon.phase];

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Moon phase', path: '/moon-phase/today' },
  ];

  const facts: { label: string; value: string }[] = [
    { label: 'Phase', value: entry.title },
    { label: 'Illumination', value: `${(moon.illumination * 100).toFixed(1)}%` },
    { label: 'Position', value: formatZodiacPosition(moon.position) },
    { label: 'Age', value: `${moon.ageDays.toFixed(1)} days into this lunation` },
    { label: 'Elongation from the Sun', value: `${moon.phaseAngle.toFixed(1)}°` },
    { label: 'Direction', value: moon.waxing ? 'Waxing' : 'Waning' },
  ];

  const events: { label: string; at: Date }[] = [
    { label: 'Next New Moon', at: upcoming.nextNewMoon },
    { label: 'Next First Quarter', at: upcoming.nextFirstQuarter },
    { label: 'Next Full Moon', at: upcoming.nextFullMoon },
    { label: 'Next Third Quarter', at: upcoming.nextThirdQuarter },
    { label: `Moon enters ${ingress.sign}`, at: ingress.enteredAt },
  ].sort((left, right) => left.at.getTime() - right.at.getTime());

  return (
    <article>
      <JsonLd json={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        json={articleJsonLd({
          headline: `Moon phase today: ${entry.title} at ${(moon.illumination * 100).toFixed(0)}% illumination`,
          description: `The Moon is ${entry.title.toLowerCase()} in ${moon.position.sign}.`,
          path: '/moon-phase/today',
          datePublished: now.toISOString(),
          dateModified: now.toISOString(),
        })}
      />
      <Breadcrumbs crumbs={crumbs} />

      <header>
        <p className="eyebrow">{now.toISOString().slice(0, 10)}</p>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl">
          {entry.title}, <span className="capitalize">{moon.position.sign}</span>
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-parchment-muted">
          The Moon is {(moon.illumination * 100).toFixed(1)}% illuminated and{' '}
          {moon.ageDays.toFixed(1)} days into the current lunation. Phase is derived from the actual
          solar and lunar longitudes rather than a calendar approximation, which drifts by hours
          within a single month.
        </p>
      </header>

      <section aria-labelledby="facts-heading" className="mt-10">
        <h2 id="facts-heading" className="eyebrow">
          Right now
        </h2>
        <dl className="panel mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-parchment-muted">{fact.label}</dt>
              <dd className="font-mono text-sm text-parchment">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="meaning-heading" className="mt-10">
        <h2 id="meaning-heading" className="eyebrow">
          What this phase traditionally means
        </h2>
        <div className="panel mt-3">
          <p className="text-sm leading-relaxed text-parchment">{entry.body}</p>
          <p className="mt-3 text-sm leading-relaxed text-parchment">
            While the Moon travels through <span className="capitalize">{moon.position.sign}</span>,
            the prevailing mood is traditionally described as {MOON_SIGN_THEMES[moon.position.sign]}
            .
          </p>
        </div>
      </section>

      <section aria-labelledby="upcoming-heading" className="mt-10">
        <h2 id="upcoming-heading" className="eyebrow">
          What happens next
        </h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <caption className="sr-only">Upcoming lunar events, in UTC</caption>
          <thead>
            <tr className="border-b border-ink-line text-left">
              <th scope="col" className="py-2 pr-4 font-medium text-parchment-muted">
                Event
              </th>
              <th scope="col" className="py-2 font-medium text-parchment-muted">
                When (UTC)
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.label} className="border-b border-ink-line/60">
                <th
                  scope="row"
                  className="py-2 pr-4 text-left font-normal capitalize text-parchment"
                >
                  {event.label}
                </th>
                <td className="py-2 font-mono text-parchment-muted">
                  {event.at.toISOString().replace('T', ' ').slice(0, 16)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel mt-12 border-brass/30 bg-brass/5">
        <h2 className="font-serif text-xl">How the Moon relates to your own chart</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-parchment-muted">
          The Moon above is the same for everyone. Where it falls in your chart, and what it touches
          there, depends on your birth date, time and place.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded bg-brass px-5 py-2.5 font-medium text-ink hover:bg-brass-bright"
        >
          Calculate my birth chart
        </Link>
      </section>
    </article>
  );
}
