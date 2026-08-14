# Project status

Last updated: 2026-08-14

## Honest summary

There is now a **working application**. Enter birth details and you get a
calculated natal chart, a personalised daily reading with explainable scores, and
an interactive chart wheel — all from verified astronomy, with no AI required.

The database schema is written and behaviour-verified against real PostgreSQL,
but nothing is wired to it yet. Not built: persistence wiring, auth,
subscriptions, notifications, SEO pages, compatibility and the timeline.

`pnpm verify` passes: lint, typecheck (packages **and** web), **284 tests**,
package build and Next.js production build.

```bash
pnpm dev            # run the app
pnpm demo           # print a reading to the terminal
pnpm verify         # the full gate
pnpm verify:schema  # migrations + RLS against real PostgreSQL (needs Docker)
```

## Done

### Phase 1 — Infrastructure

pnpm workspace; TypeScript strict with `noUncheckedIndexedAccess` and no `any`;
type-aware ESLint; Prettier; Vitest; split TS projects (one for typecheck/lint
including tests, one for emit); `AGENTS.md`; three ADRs.

### Phase 2 — Deterministic engines

| Component                           | Verification                                                 |
| ----------------------------------- | ------------------------------------------------------------ |
| `EphemerisProvider` abstraction     | Interface-level tests                                        |
| astronomy-engine provider           | Frame locked to published equinoxes (<0.01°)                 |
| Zodiac                              | Boundary sweep at 0 / 29.999 / 30 / 359.999 / 360 / negative |
| Aspects, configurable orbs          | Orb limits, 0/360 seam, applying/separating                  |
| Houses: Placidus, Whole Sign, Equal | Independent horizon verification, 4 cities × 4 dates         |
| Local time → UTC                    | DST gap and overlap                                          |
| Lunar engine                        | Published lunations within 2 minutes                         |
| Numerology (Pythagorean)            | Hand-worked values, Unicode edge cases                       |

### Phase 3 — Charts and transits

Natal charts with full reproducibility metadata; transit engine with
decomposable scoring; exact-time and orb-window search handling multiple
retrograde passes.

### Phase 5 — Context and interpretation

Combined context engine; category scoring with per-contribution explanations and
a dynamic-range guard; FACT/INTERPRETATION separation; complete deterministic
daily reading; AI schema validation with fabrication and overclaim screening;
mechanical content-safety enforcement across all user-facing text.

### Phase 4 — Application

- Next.js 15 App Router, Tailwind, server-rendered. **All calculation happens on
  the server** — the browser never receives an ephemeris.
- **Today**: overall score, plus seven category scores that each carry a number,
  a written band and an explanation. Moon panel, numerology, and transit cards
  showing the calculated fact and the traditional interpretation as separately
  labelled fields.
- **My Chart**: SVG wheel (signs, houses, planets, aspect lines, ASC/MC) with a
  full text-equivalent table. The drawing is `aria-hidden`; the table is the
  accessible reading, not a fallback.
- **Profile**: validated form, server-side validation regardless of client
  checks, per-field errors, `role="alert"` summary.
- Data-quality warnings are prominent: unknown birth time, DST ambiguity, and
  Placidus polar fallback are all disclosed rather than hidden.
- Verified in a real browser: form → chart → reading, no console errors, no
  horizontal overflow at 375 px.

### Phase 7 partial — Schema

Portable PostgreSQL migrations, RLS policies, version-driven cache keys and a
fail-closed entitlements model.

**Verified against real PostgreSQL 17** via `pnpm verify:schema`, which asserts
that RLS actually isolates users (including the derived cache tables), that a
client cannot escalate its own plan or forge a chart, and that constraints and
cascade deletes behave. Negative-controlled, so the checks are known to be
capable of failing. Not yet applied to a hosted Supabase project.

## Not started

- **Persistence wiring.** The schema is verified but nothing reads or writes it;
  no query layer exists. The app stores its profile in an HTTP-only cookie as an
  explicit interim.
- **Auth.** No accounts, no sessions.
- **Subscriptions.** Entitlement logic exists and is tested; no Stripe
  integration, no webhook handler.
- **Notifications**, **SEO pages**, **compatibility/synastry**, **timeline**,
  **public sun-sign horoscopes**.
- **Caching layer.** Keys are designed and tested; nothing reads or writes them.
- **E2E and visual regression tests.** The browser check above was manual.
- **CI.** No pipeline; `pnpm verify` is run by hand.

## Known gaps

1. **No Chiron, Lilith or asteroids** — absent from `astronomy-engine`. ADR 0001.
2. **Lunar nodes are mean, not true** (up to ~1.6° apart).
3. **No moonrise/moonset/azimuth.**
4. **Placidus throws inside the polar circles** — deliberate; the app catches it
   and falls back to whole-sign with a visible notice. ADR 0002.
5. **Scoring weights and affinities are editorial guesses.** `VALENCE_SCALE` was
   tuned so scores spread legibly across ~25–75 rather than collapsing into
   "mixed". That makes them _readable_, not _right_.
6. **Only ~8 hand-written transit interpretations.** Everything else composes
   from themes — acceptable but recognisably templated.
7. **The migrations run and are behaviour-verified locally**, but have not been
   applied to a hosted Supabase project. Running them for the first time found a
   real bug — `citext` was used without `CREATE EXTENSION` — now fixed.
8. **Birth data currently sits in a browser cookie.** Interim, documented at the
   top of `apps/web/src/lib/profile.ts` and disclosed in the UI.

## Decisions needing a human

- **Default house system** — Placidus is the current default. Reversible: it is
  stored per chart and selectable in the form.
- **Swiss Ephemeris commercial licence** — only if asteroids become a requirement.
- **True vs mean lunar node.**
- **Subscription pricing** — deliberately unconfigured.
- **Scoring calibration** — needs user feedback data the product does not collect.
- **How much interpretation copy to commission** versus leaving to composition.

## Suggested next step

**Auth plus persistence, together.** They are one piece of work: the schema is
written and the app already has a single seam (`apps/web/src/lib/profile.ts`)
where cookie storage becomes a database lookup. Doing this gets birth data out of
the browser and unlocks multiple profiles, saved reports and notifications.

This is the point where Supabase authorization actually matters. Everything up to
here has been local.

After that, in rough value order: public sun-sign horoscopes (SEO surface,
reuses the context engine), the timeline (`findTransitWindow` already does the
hard part), then compatibility.
