import type { Metadata } from 'next';
import { Breadcrumbs, JsonLd, breadcrumbJsonLd, canonical } from '@/lib/seo';

/**
 * Terms of use.
 *
 * IMPORTANT: not legal advice, and not reviewed by a solicitor. The clauses
 * that actually matter commercially — liability, refunds, governing law and the
 * statutory cancellation right for digital subscriptions — are marked below and
 * must be settled with a lawyer before taking payment.
 *
 * The sections describing what the product IS and what it claims are accurate,
 * and those are the ones that keep the astrology framing honest.
 */

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms of use for Astrolapp, including what the readings are and are not.',
  alternates: { canonical: canonical('/terms') },
};

const LAST_UPDATED = '14 August 2026';

export default function TermsPage() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Terms', path: '/terms' },
  ];

  return (
    <article className="max-w-2xl">
      <JsonLd json={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 className="font-serif text-3xl">Terms of use</h1>
      <p className="mt-2 text-xs text-parchment-faint">Last updated {LAST_UPDATED}</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-parchment-muted">
        <section className="panel border-brass/40 bg-brass/5">
          <h2 className="font-serif text-xl text-parchment">What this service is</h2>
          <p className="mt-3">
            Astrolapp calculates astronomical positions and derives astrological and numerological
            readings from them. The astronomy is computed and verifiable. The meanings drawn from it
            belong to interpretive traditions and are presented as such.
          </p>
          <p className="mt-3 font-medium text-parchment">
            Astrology and numerology are not established science, and nothing here is a prediction.
            Scores such as &ldquo;Career 84&rdquo; are product heuristics — weighted editorial
            judgements — not measurements of anything.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-parchment">Not advice</h2>
          <p className="mt-3">
            Nothing on this service is medical, psychological, financial, legal or safety advice,
            and it must not be used as a substitute for any of them. Do not make decisions about
            your health, money, legal position or personal safety on the basis of a reading. If you
            need help in any of those areas, consult a qualified professional.
          </p>
          <p className="mt-3">
            If you are in crisis or thinking about harming yourself, please contact your local
            emergency services or a crisis line rather than relying on anything here.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-parchment">Accuracy</h2>
          <p className="mt-3">
            We take the calculations seriously and test them against published astronomical
            reference values. Even so, the service is provided as-is: charts depend on the birth
            details you supply, and an incorrect birth time will produce an incorrect chart without
            any way for us to detect it.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-parchment">Your account and data</h2>
          <p className="mt-3">
            You are responsible for the accuracy of the birth details you enter and for any details
            you enter about other people. Only add someone else&rsquo;s birth information if you
            have their agreement. How we handle personal data is set out in our{' '}
            <a href="/privacy" className="text-brass underline underline-offset-4">
              privacy policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-parchment">Acceptable use</h2>
          <p className="mt-3">
            Do not scrape the service, resell readings as your own, or use it to harass, profile or
            make decisions about other people without their knowledge.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-parchment">Subscriptions</h2>
          <p className="mt-3">
            {/* PLACEHOLDER — settle with a lawyer before taking payment. In the UK/EU
                consumers have a 14-day cancellation right for digital services unless
                they expressly waive it, and that waiver has to be captured at checkout. */}
            Paid plans are not yet available. Pricing, billing, renewal and cancellation terms will
            be published here before any payment is taken.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-parchment">Liability</h2>
          <p className="mt-3">
            {/* PLACEHOLDER — jurisdiction-specific. Consumer law limits how far liability
                can be excluded, and an over-broad clause can be unenforceable in full. */}
            Liability terms and governing law to be confirmed before public launch.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-parchment">Changes</h2>
          <p className="mt-3">
            These terms may change as the service develops. Material changes will be reflected in
            the date at the top of this page.
          </p>
        </section>
      </div>
    </article>
  );
}
