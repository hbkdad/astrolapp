# Project status

Last updated: 2026-08-14

## Honest summary

The **deterministic calculation and interpretation layers are built and
verified**. A complete daily reading can be produced end to end, today, with no
AI and no database. The web application, persistence, subscriptions,
notifications and SEO pages are **not started**.

`pnpm verify` passes: lint clean, typecheck clean, **263 tests passing**, build
succeeds. `pnpm demo` prints a full reading.

## Done

### Phase 1 — Infrastructure and standards

- pnpm workspace, TypeScript strict (`noUncheckedIndexedAccess`, no `any`)
- ESLint type-aware strict rules, Prettier
- Vitest with source-resolved workspace aliases
- Split TS projects: one for typecheck/lint (includes tests), one for emit
- `AGENTS.md`, architecture docs, three ADRs

### Phase 2 — Deterministic engines

| Component                                      | State | Verification                                         |
| ---------------------------------------------- | ----- | ---------------------------------------------------- |
| Ephemeris abstraction (`EphemerisProvider`)    | Done  | Interface-level tests                                |
| astronomy-engine provider                      | Done  | Frame locked to published equinoxes (<0.01°)         |
| Zodiac                                         | Done  | Boundary sweep                                       |
| Aspects (5 major + 5 minor, configurable orbs) | Done  | Orb limits, seam, applying/separating                |
| Houses: Placidus, Whole Sign, Equal            | Done  | Independent horizon verification, 4 cities × 4 dates |
| Local time → UTC resolution                    | Done  | DST gap and overlap cases                            |
| Lunar engine                                   | Done  | Published lunations within 2 minutes                 |
| Numerology (Pythagorean)                       | Done  | Hand-worked values, Unicode edge cases               |

### Phase 3 — Charts and transits

- Natal charts with full reproducibility metadata — **done**
- Transit engine with configurable weights and score decomposition — **done**
- Exact-time / orb-window search (handles multiple retrograde passes) — **done**

### Phase 5 — Context and interpretation

| Component                                        | State | Verification                             |
| ------------------------------------------------ | ----- | ---------------------------------------- |
| Combined personal context engine (Goal 10)       | Done  | Determinism, contribution sums, spread   |
| Category scoring with explanations               | Done  | Neutral-vs-empty, dynamic range over 1yr |
| Interpretation engine, FACT/INTERPRETATION split | Done  | Separation and framing asserted          |
| Deterministic daily reading (Goal 12, personal)  | Done  | Complete with AI switched off            |
| AI layer: schema validation + claim screening    | Done  | Fabrication and overclaim rejection      |
| Content safety enforcement                       | Done  | Scans all user-facing text               |

## Not started

Nothing below is stubbed to look finished.

- **Public sun-sign horoscope mode** (Goal 12) — the personalised mode exists;
  the 12-sign public variant does not
- **Compatibility / synastry** (Goal 16)
- **Timeline / event calendar** (Goal 15) — `findTransitWindow` provides the
  underlying search, but no event feed is assembled
- **Database** (Goal 2) — no schema, no migrations, no PostgreSQL
- **Next.js application** (Goals 13–14) — dashboard, chart wheel, pages
- **Auth, subscriptions, entitlements, notifications** (Goals 18–20)
- **SEO pages, sitemap, structured data** (Goal 17)
- **Caching, observability, deployment, CI** (Goals 21, 25)
- **Integration, E2E and visual tests** — blocked on the application layer

## Known gaps and deferred decisions

1. **No Chiron, Lilith or asteroids.** Genuinely absent from `astronomy-engine`.
   Requires a provider swap or supplementary data. See ADR 0001.
2. **Lunar nodes are mean, not true.** The true node oscillates around the mean
   by up to ~1.6°. An astrological convention choice, documented not implicit.
3. **No moonrise/moonset/azimuth.** Straightforward via `SearchRiseSet`; not built.
4. **Placidus throws inside the polar circles.** Deliberate. See ADR 0002.
5. **Default house system is Placidus** — a placeholder, not a researched choice.
6. **Scoring weights and affinities are editorial guesses.** Internally
   consistent and plausible; no outcome data supports them. `VALENCE_SCALE` was
   tuned for legibility, not accuracy — see below.
7. **Only ~8 hand-written transit interpretations exist.** Everything else is
   composed from themes. Composition reads acceptably but is recognisably
   templated; `Interpretation.source` makes the coverage gap measurable.
8. **Swiss Ephemeris licensing** checked and rejected for now (AGPL/LGPL).

## Decisions needing a human

Product and commercial calls, not engineering ones:

- Default house system (Placidus vs Whole Sign) — affects every chart shown
- Whether to buy a Swiss Ephemeris commercial licence
- True vs mean lunar node
- Subscription tier pricing (deliberately unconfigured)
- **Scoring calibration.** The current curve was chosen so scores spread
  legibly across 25–75 rather than collapsing into "mixed". That makes the
  numbers _readable_; it does not make them _right_. Real calibration would need
  user feedback data the product does not yet collect.
- How much hand-written interpretation copy to commission versus leaving to
  composition

## Suggested next step

Two tracks, safe to run in parallel:

1. **Database schema and persistence** (Goal 2). The entities are now fully
   determined by the engine output types — `NatalChart`, `DailyContext`,
   `NumerologyProfile` — so the schema can be written without guesswork. Cache
   keys should include the engine versions already stamped on every result.
2. **Next.js application** (Goals 13–14). The data contract the UI renders is now
   fixed and demonstrable via `pnpm demo`, so the dashboard can be built against
   a real shape rather than an imagined one.

The public sun-sign horoscope mode (Goal 12) is a smaller follow-on and mostly
reuses the existing context engine with a generic chart per sign.
