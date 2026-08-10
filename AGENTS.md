# AGENTS.md

Guidance for AI agents and humans working in this repository. Keep this file
short. Detailed procedures belong in `docs/`, not here.

## What this project is

A platform that computes astronomical, astrological and numerological values and
turns them into personalised readings. The computation is the product; the
readings are a presentation of it.

## Architecture boundaries — do not cross these

Three layers, in strict order. Data flows one way.

| Layer                       | Contains                                                    | Rule                                                                      |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| **A. Astronomical fact**    | Ephemeris positions, phase angles, sidereal time, obliquity | Comes only from an `EphemerisProvider`. Never estimated, never generated. |
| **B. Interpretation rules** | Aspect meanings, numerology meanings, scores                | Deterministic, keyed off Layer A. Contains no astronomy.                  |
| **C. Natural language**     | AI-written prose                                            | Consumes validated Layer B output. Produces no numbers.                   |

Hard rules:

- **An AI model must never produce a planetary position, phase, aspect, orb,
  house placement or numerology value.** Those come from the engines. If a model
  emits one, that is a defect regardless of whether the value is plausible.
- **No ephemeris library may be imported outside `packages/astro-engine/src/ephemeris/`.**
  Everything else goes through the `EphemerisProvider` interface.
- **Calculation code contains no interpretation text.** `aspects.ts` does not
  know what a square means. Return structured data and key interpretation off it.
- **Scores are heuristics, not measurements.** See `docs/ADR/0003`.

## Conventions

- Package manager: **pnpm**. Node >= 20.11.
- TypeScript strict, including `noUncheckedIndexedAccess`. `any` is banned; if a
  case genuinely needs it, justify it in a comment.
- All ecliptic longitudes are degrees in `[0, 360)`, tropical, **true ecliptic of
  date** — never J2000. All angle wrapping goes through `@astrolapp/shared`.
- Every stored calculation records the engine versions that produced it
  (`ENGINE_VERSIONS`). Changing a numeric output means bumping the version.
- Never commit secrets. Configuration goes in `.env`, documented in `.env.example`.

## Commands

```bash
pnpm install
pnpm verify      # lint + typecheck + test + build. Run before declaring done.
pnpm test        # vitest
pnpm typecheck
pnpm lint
pnpm build
```

## Definition of done

A change is done when `pnpm verify` passes, edge cases are tested, docs are
updated, `docs/PROJECT_STATUS.md` reflects reality, and no secret is committed.
Generated code that has not been run is not done.

## Prohibited shortcuts

- Do not loosen a test tolerance to make a failing calculation pass. A widening
  tolerance is evidence of a regression. Find the cause.
- Do not generate calculation fixtures from this codebase's own output — that
  proves self-consistency, not correctness. Use published reference values.
- Do not present astrology or numerology as scientifically established. Write
  "astrology traditionally interprets…", never "this will happen". Never frame a
  reading as medical, financial, legal or safety advice.
- Do not rewrite working systems without cause, and do not discard unrelated
  user changes.
