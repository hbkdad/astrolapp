import Link from 'next/link';
import { readProfile } from '@/lib/profile';

export default async function HomePage() {
  const profile = await readProfile();

  return (
    <div>
      <section className="py-10">
        <p className="eyebrow">Personal cosmic calendar</p>
        <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">
          Astrology you can check.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-parchment-muted">
          Every reading here separates what was{' '}
          <em className="text-steel not-italic">calculated</em> from what is{' '}
          <em className="text-brass not-italic">interpreted</em>. Planetary positions come from a
          verified ephemeris. Meanings are labelled as tradition. Scores show their working.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={profile === null ? '/profile' : '/today'}
            className="rounded bg-brass px-5 py-2.5 font-medium text-ink hover:bg-brass-bright"
          >
            {profile === null ? 'Create a birth profile' : 'Open today'}
          </Link>
          {profile !== null && (
            <Link
              href="/chart"
              className="rounded border border-ink-line px-5 py-2.5 font-medium hover:border-brass"
            >
              View my chart
            </Link>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: 'Verified positions',
            body: 'Longitudes are checked against published equinox and lunation times to within an arcsecond. The coordinate frame is locked by tests.',
          },
          {
            title: 'Explainable scores',
            body: 'Every category score lists the transits that produced it and how much each contributed. No number appears without its working.',
          },
          {
            title: 'Honest framing',
            body: 'Astrology is presented as an interpretive tradition. No prediction, and nothing framed as medical, financial or legal advice.',
          },
        ].map((card) => (
          <article key={card.title} className="panel">
            <h2 className="font-serif text-lg">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-parchment-muted">{card.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
