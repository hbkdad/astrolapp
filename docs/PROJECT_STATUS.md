# Project status

Last updated: 2026-08-09

## Honest summary

The **deterministic calculation foundation is built and verified**. The
application, database, subscriptions, notifications, SEO pages and UI are **not
started**.

This ordering is deliberate and follows the brief's own development sequence:
Phase 1–2 before Phase 3+, and explicitly _not_ "reverse this sequence merely to
produce visually impressive screenshots early".

`pnpm verify` passes: lint clean, typecheck clean, **202 tests passing**, build
succeeds.

## Done

### Phase 1 — Infrastructure and standards

- pnpm workspace, TypeScript strict (`noUncheckedIndexedAccess`, no `any`)
- ESLint with type-aware strict rules, Prettier
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

### Phase 3 — partially

- Natal charts with full reproducibility metadata — **done**
- Transit engine with configurable weights and score decomposition — **done**
- Exact-time / orb-window search (handles multiple retrograde passes) — **done**

## Not started

Everything below is unbuilt. Nothing is stubbed to look finished.

- **Combined personal context engine** (Goal 10) — the category-score aggregator
- **Interpretation library** (Goal 11) — keyed content, deterministic templates
- **AI language layer** (Goal 11) — schema-validated, with deterministic fallback
- **Daily horoscope engine** (Goal 12) — public sun-sign and personalised modes
- **Database** (Goal 2) — no schema, no migrations, no PostgreSQL yet
- **Next.js application** (Goals 13–16) — dashboard, chart wheel, timeline,
  numerology and compatibility pages
- **Auth, subscriptions, entitlements, notifications** (Goals 18–20)
- **SEO pages, sitemap, structured data** (Goal 17)
- **Caching, observability, deployment, CI** (Goals 21, 25)
- **Integration, E2E and visual tests** — blocked on the application layer

## Known gaps and deferred decisions

1. **No Chiron, Lilith or asteroids.** Genuinely absent from `astronomy-engine`,
   not merely unimplemented. Requires a provider swap or supplementary data. See
   ADR 0001.
2. **Lunar nodes are mean, not true.** Meeus' mean-node polynomial. The true node
   oscillates around it by up to ~1.6°. An astrological convention choice —
   documented rather than left implicit.
3. **No moonrise/moonset/azimuth.** Straightforward to add via
   `SearchRiseSet`/`Horizon`; simply not built.
4. **Placidus throws inside the polar circles.** Deliberate. Callers must catch
   `HouseSystemUndefinedError` and fall back. See ADR 0002.
5. **Default house system is Placidus** — a placeholder product decision, not a
   researched one. Structurally easy to change; the system is stored per chart.
6. **Scoring weights are unvalidated editorial guesses.** They are plausible and
   internally consistent, and no user research backs them. See ADR 0003.
7. **Swiss Ephemeris licensing** was checked and rejected for now (AGPL/LGPL).
   If asteroid support or higher precision becomes a requirement, a commercial
   licence is a **procurement decision with a real cost**, not a code change.

## Decisions needing a human

These are product or commercial calls, not engineering ones:

- Default house system (Placidus vs Whole Sign) — affects every chart shown
- Whether to buy a Swiss Ephemeris commercial licence
- Whether the true or mean lunar node is used
- Subscription tier pricing (deliberately unconfigured)
- Scoring weight calibration

## Suggested next step

Build the **interpretation layer and combined context engine** (Goals 10–11)
before any UI. They consume the engines that now exist, and they define the exact
data contract the dashboard will render — building the dashboard first would mean
guessing that contract and reworking it.

Database schema (Goal 2) can proceed in parallel, since the entities are already
determined by the engine output types.
