import type { Metadata } from 'next';
import Link from 'next/link';
import { ZODIAC_SIGNS, defaultEphemerisProvider, elementOf } from '@astrolapp/astro-engine';
import { computeSolarSignContext } from '@astrolapp/context-engine';
import { buildPublicHoroscope } from '@astrolapp/interpretation-engine';
import { Breadcrumbs, JsonLd, breadcrumbJsonLd, canonical } from '@/lib/seo';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Daily horoscopes, calculated not written',
  description:
    'Daily readings for all twelve signs, built from the real positions of the Sun, Moon and planets. Every figure can be checked against an ephemeris.',
  alternates: { canonical: canonical('/horoscope') },
};

const DATE_RANGES: Record<string, string> = {
  aries: '21 Mar – 19 Apr',
  taurus: '20 Apr – 20 May',
  gemini: '21 May – 20 Jun',
  cancer: '21 Jun – 22 Jul',
  leo: '23 Jul – 22 Aug',
  virgo: '23 Aug – 22 Sep',
  libra: '23 Sep – 22 Oct',
  scorpio: '23 Oct – 21 Nov',
  sagittarius: '22 Nov – 21 Dec',
  capricorn: '22 Dec – 19 Jan',
  aquarius: '20 Jan – 18 Feb',
  pisces: '19 Feb – 20 Mar',
};

export default function HoroscopeIndexPage() {
  const now = new Date();
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Horoscopes', path: '/horoscope' },
  ];

  // One shared context supplies the sky facts common to every sign.
  const shared = computeSolarSignContext(defaultEphemerisProvider, 'aries', now);

  return (
    <div>
      <JsonLd json={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />

      <header>
        <p className="eyebrow">{shared.date}</p>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl">Today&rsquo;s horoscopes</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-parchment-muted">
          Most sun-sign columns are written in advance, twelve ways. These are computed from the
          actual sky at midday UTC today, using the traditional solar-house convention — so the
          reading for each sign differs because its house framing genuinely differs, not because
          twelve variations were drafted.
        </p>
      </header>

      <section aria-labelledby="sky-heading" className="panel mt-8">
        <h2 id="sky-heading" className="font-serif text-lg">
          The sky right now
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="eyebrow">Moon</dt>
            <dd className="mt-1 text-sm text-parchment">
              {shared.moon.phase.replace(/-/g, ' ')} in{' '}
              <span className="capitalize">{shared.moon.position.sign}</span>,{' '}
              {(shared.moon.illumination * 100).toFixed(0)}% lit
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Retrograde</dt>
            <dd className="mt-1 text-sm capitalize text-parchment">
              {shared.retrogrades.length > 0 ? shared.retrogrades.join(', ') : 'None today'}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Next Full Moon</dt>
            <dd className="mt-1 font-mono text-sm text-parchment">
              {shared.upcomingLunations.nextFullMoon.toISOString().slice(0, 10)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="signs-heading" className="mt-10">
        <h2 id="signs-heading" className="eyebrow">
          Choose your sign
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ZODIAC_SIGNS.map((sign) => {
            const horoscope = buildPublicHoroscope(
              computeSolarSignContext(defaultEphemerisProvider, sign, now),
            );
            return (
              <li key={sign}>
                <Link
                  href={`/horoscope/${sign}`}
                  className="block h-full rounded-lg border border-ink-line bg-ink-soft p-5 transition-colors hover:border-brass"
                >
                  <h3 className="font-serif text-lg capitalize text-parchment">{sign}</h3>
                  <p className="mt-0.5 text-xs text-parchment-faint">
                    {DATE_RANGES[sign]} · {elementOf(sign)}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-parchment-muted">
                    Moon in your {horoscope.moonSolarHouse}
                    {horoscope.moonSolarHouse === 1
                      ? 'st'
                      : horoscope.moonSolarHouse === 2
                        ? 'nd'
                        : horoscope.moonSolarHouse === 3
                          ? 'rd'
                          : 'th'}{' '}
                    solar house.
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-10 max-w-2xl text-xs leading-relaxed text-parchment-faint">
        Astrology is an interpretive tradition, not established science. The positions behind these
        readings are calculated and verifiable; the meanings drawn from them are traditional
        interpretations.
      </p>
    </div>
  );
}
