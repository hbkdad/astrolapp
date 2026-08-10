# ADR 0001 — Ephemeris provider: astronomy-engine, not Swiss Ephemeris

Status: **Accepted** · 2026-08-09

## Context

Every astrological value in the product derives from planetary positions. The
choice of ephemeris determines accuracy, deployment complexity, and — critically
— the licence under which this commercial product can ship.

The brief named Swiss Ephemeris as the preferred candidate and explicitly
instructed that its licensing be _verified rather than assumed_. It was.

## Licensing findings

The npm package `sweph` (Swiss Ephemeris bindings, v2.10.3-7) is published under:

> `(AGPL-3.0-or-later OR LGPL-3.0-or-later)`

Both options are problematic for a closed-source SaaS:

- **AGPL-3.0** carries a network copyleft clause. Offering the software's
  functionality over a network to users triggers the obligation to release the
  corresponding source of the whole work. For a hosted commercial platform this
  is effectively disqualifying.
- **LGPL-3.0** is more workable but requires that users be able to relink the
  library, which constrains how it may be bundled, and the package is a native
  addon requiring per-platform compilation.

Astrodienst sells a separate commercial licence that removes these obligations.
That is a genuine option, but it is a **procurement decision with a cost and a
contract**, not something to assume in code.

## Decision

Default to **`astronomy-engine`** (MIT, pure TypeScript, no native dependencies),
accessed exclusively through the `EphemerisProvider` interface in
`packages/astro-engine/src/ephemeris/types.ts`.

## Consequences

**Gained**

- MIT licence: no copyleft obligation, no procurement blocker.
- Pure JS: no native build step, no per-platform binaries, deploys anywhere
  including edge runtimes.
- Accuracy is far beyond what astrology requires. Verified against published
  2024 equinox, solstice and lunation times to within **one arcsecond** and
  **under a minute of time** respectively (`ephemeris.test.ts`).

**Given up**

- No Chiron, Lilith, or asteroid ephemerides. These are genuinely absent from
  the library, not merely unimplemented. Adding them requires either a provider
  swap or a supplementary data source, and `BodyId` documents this.
- Sidereal zodiac and exotic house systems would need extra work.
- The lunar nodes are computed from Meeus' **mean** node polynomial rather than
  supplied by the provider. The true node oscillates around it by up to ~1.6°.

**Reversibility**

This is the main reason for the interface. Swapping to Swiss Ephemeris — after
buying a commercial licence, or if asteroids become a requirement — means writing
one new class implementing `EphemerisProvider`. No zodiac, aspect, house, natal,
transit or lunar code changes. `ephemeris.test.ts` runs against the interface and
would validate the replacement.

## Verification note

The provider must return the **true ecliptic of date**, not J2000. This was
confirmed empirically rather than trusted: at the March 2024 equinox the computed
solar longitude is 359.99975°, within one arcsecond of zero. A J2000-referred
frame would have read ~0.335° off, because precession accumulates ~50.3″/year.
The assertion is locked in a test so a dependency upgrade cannot change the frame
silently — a failure mode that would corrupt every chart while looking correct.
