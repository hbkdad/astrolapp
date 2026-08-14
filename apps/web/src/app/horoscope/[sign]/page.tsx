import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ZODIAC_SIGNS, defaultEphemerisProvider, type ZodiacSign } from '@astrolapp/astro-engine';
import { computeSolarSignContext } from '@astrolapp/context-engine';
import { buildPublicHoroscope } from '@astrolapp/interpretation-engine';
import { Breadcrumbs, JsonLd, articleJsonLd, breadcrumbJsonLd, canonical } from '@/lib/seo';

/**
 * Public daily horoscope.
 *
 * Statically generated for all twelve signs and revalidated hourly. The reading
 * is computed at midday UTC for the date, so it is identical for every visitor
 * on a given day and does not shift under a reader who reloads.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return ZODIAC_SIGNS.map((sign) => ({ sign }));
}

function isZodiacSign(value: string): value is ZodiacSign {
  return (ZODIAC_SIGNS as readonly string[]).includes(value);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sign: string }>;
}): Promise<Metadata> {
  const { sign } = await params;
  if (!isZodiacSign(sign)) return {};

  const label = titleCase(sign);
  const horoscope = buildPublicHoroscope(
    computeSolarSignContext(defaultEphemerisProvider, sign, new Date()),
  );

  return {
    title: `${label} horoscope for today — ${horoscope.date}`,
    description:
      `Today's ${label} reading, built from calculated planetary positions rather than written in advance. ` +
      `Moon ${(horoscope.moon.title || '').toLowerCase()}, and every figure shown can be checked against an ephemeris.`,
    alternates: { canonical: canonical(`/horoscope/${sign}`) },
    openGraph: {
      type: 'article',
      title: `${label} horoscope — ${horoscope.date}`,
      description: horoscope.summary,
      url: canonical(`/horoscope/${sign}`),
    },
  };
}

export default async function SignHoroscopePage({ params }: { params: Promise<{ sign: string }> }) {
  const { sign } = await params;
  if (!isZodiacSign(sign)) notFound();

  const context = computeSolarSignContext(defaultEphemerisProvider, sign, new Date());
  const horoscope = buildPublicHoroscope(context);
  const label = horoscope.signLabel;
  const path = `/horoscope/${sign}`;

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Horoscopes', path: '/horoscope' },
    { name: label, path },
  ];

  return (
    <article>
      <JsonLd json={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        json={articleJsonLd({
          headline: `${label} horoscope for ${horoscope.date}`,
          description: horoscope.summary,
          path,
          datePublished: context.instant,
          dateModified: context.instant,
        })}
      />

      <Breadcrumbs crumbs={crumbs} />

      <header>
        <p className="eyebrow">
          {label} · {horoscope.element} · {horoscope.modality} · {horoscope.date}
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-snug sm:text-4xl">
          {label} horoscope for today
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-parchment-muted">{horoscope.summary}</p>
      </header>

      <section aria-labelledby="today-heading" className="mt-10">
        <h2 id="today-heading" className="eyebrow">
          Where the planets are for {label} today
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-parchment-muted">
          Houses here are counted in whole signs from {label} — the traditional solar-house
          convention. That is why the twelve signs read differently: the sky is the same, the
          framing is not.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {horoscope.highlights.map((highlight) => (
            <article key={highlight.key} className="panel">
              <h3 className="font-serif text-lg">{highlight.title}</h3>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="eyebrow text-steel">Calculated</dt>
                  <dd className="mt-1 font-mono text-sm leading-relaxed text-parchment-muted">
                    {highlight.fact}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow text-brass">Traditional interpretation</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-parchment">
                    {highlight.interpretation}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="moon-heading" className="mt-10">
        <h2 id="moon-heading" className="eyebrow">
          The Moon
        </h2>
        <div className="panel mt-3">
          <h3 className="font-serif text-lg">{horoscope.moon.title}</h3>
          <p className="mt-3 font-mono text-sm leading-relaxed text-parchment-muted">
            {horoscope.moon.fact}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-parchment">
            {horoscope.moon.interpretation}
          </p>
          <ul className="mt-4 space-y-1 font-mono text-xs text-parchment-faint">
            {horoscope.upcoming.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

      {horoscope.skyAspects.length > 0 && (
        <section aria-labelledby="sky-heading" className="mt-10">
          <h2 id="sky-heading" className="eyebrow">
            The sky today — the same for every sign
          </h2>
          <div className="mt-3 space-y-3">
            {horoscope.skyAspects.map((aspect) => (
              <div key={aspect.key} className="panel">
                <h3 className="font-serif">{aspect.title}</h3>
                <p className="mt-2 font-mono text-xs leading-relaxed text-parchment-muted">
                  {aspect.fact}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-parchment">
                  {aspect.interpretation}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel mt-12 border-brass/30 bg-brass/5">
        <h2 className="font-serif text-xl">This is the generic version</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-parchment-muted">
          A sun-sign reading knows one thing about you. With your birth date, time and place, the
          same engines compute your actual chart — real houses, the Ascendant, and transits to your
          own planets rather than to a whole sign.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded bg-brass px-5 py-2.5 font-medium text-ink hover:bg-brass-bright"
        >
          Calculate my birth chart
        </Link>
      </section>

      <nav aria-label="Other signs" className="mt-12">
        <h2 className="eyebrow">Every sign</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {ZODIAC_SIGNS.map((other) => (
            <li key={other}>
              <Link
                href={`/horoscope/${other}`}
                aria-current={other === sign ? 'page' : undefined}
                className={`inline-block rounded border px-3 py-1.5 text-sm capitalize ${
                  other === sign
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

      <p className="mt-10 text-xs leading-relaxed text-parchment-faint">
        Computed with {context.metadata.ephemerisProvider} {context.metadata.ephemerisVersion} at{' '}
        {context.instant.replace('T', ' ').slice(0, 16)} UTC.
      </p>
    </article>
  );
}
