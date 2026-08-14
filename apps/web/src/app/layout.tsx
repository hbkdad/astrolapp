import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Astrolapp — personal cosmic calendar',
    template: '%s · Astrolapp',
  },
  description:
    'Calculated astrology, lunar cycles and numerology. Every reading traces back to a verifiable astronomical position.',
};

const NAV_LINKS = [
  { href: '/horoscope', label: 'Horoscopes' },
  { href: '/moon-phase/today', label: 'Moon' },
  { href: '/today', label: 'Today' },
  { href: '/chart', label: 'My Chart' },
  { href: '/profile', label: 'Profile' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {/* Keyboard users must be able to skip the nav. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brass focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>

        <header className="border-b border-ink-line">
          <nav
            aria-label="Primary"
            className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4"
          >
            <Link href="/" className="font-serif text-lg tracking-wide text-parchment">
              Astrolapp
            </Link>
            <ul className="flex gap-x-5 text-sm">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-parchment-muted underline-offset-4 hover:text-parchment hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main id="main" className="mx-auto max-w-5xl px-4 py-8">
          {children}
        </main>

        <footer className="mx-auto max-w-5xl px-4 py-10">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-ink-line pt-6 text-xs">
            {[
              { href: '/horoscope', label: 'Horoscopes' },
              { href: '/moon-phase/today', label: 'Moon phase' },
              { href: '/numerology/life-path/1', label: 'Numerology' },
              { href: '/privacy', label: 'Privacy' },
              { href: '/terms', label: 'Terms' },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-parchment-muted underline-offset-4 hover:text-parchment hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs leading-relaxed text-parchment-faint">
            Astrology and numerology are interpretive traditions, not established science. The
            astronomical positions behind every reading are calculated and verifiable; the meanings
            drawn from them are traditional interpretations. Scores are product heuristics, not
            measurements. Nothing here is medical, financial, legal or safety advice.
          </p>
        </footer>
      </body>
    </html>
  );
}
