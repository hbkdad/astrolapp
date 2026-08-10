# Architecture

## The one-way pipeline

```
User data (birth date/time/place, name)
        │
        ▼
┌───────────────────────────────────────────┐
│ LAYER A — ASTRONOMICAL FACT               │
│ EphemerisProvider                         │
│ positions · obliquity · sidereal time     │
│ lunation instants · illumination          │
└───────────────────────────────────────────┘
        │  verifiable against published data
        ▼
┌───────────────────────────────────────────┐
│ LAYER A′ — DERIVED GEOMETRY               │
│ zodiac · aspects · houses · natal chart   │
│ transits · lunar state                    │
└───────────────────────────────────────────┘
        │  structured data, no prose
        ▼
┌───────────────────────────────────────────┐
│ LAYER B — INTERPRETATION RULES            │
│ scoring weights · interpretation keys     │
│ deterministic templates                   │
└───────────────────────────────────────────┘
        │  validated JSON
        ▼
┌───────────────────────────────────────────┐
│ LAYER C — NATURAL LANGUAGE (optional)     │
│ AI prose from validated structured input  │
└───────────────────────────────────────────┘
```

Data flows downward only. Layer C never writes back into A or B. The product
must remain fully functional with Layer C switched off — AI is a presentation
enhancement, not a dependency.

## Packages

| Package                        | Responsibility                                                                            | Depends on                   |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------- |
| `@astrolapp/shared`            | Angle arithmetic, engine version stamps                                                   | —                            |
| `@astrolapp/astro-engine`      | Ephemeris access, zodiac, aspects, houses, time resolution, natal charts, transits, lunar | `shared`, `astronomy-engine` |
| `@astrolapp/numerology-engine` | Name normalization, reduction, Pythagorean system                                         | `shared`                     |

Planned but not yet built: `interpretation-engine`, `db`, and the Next.js app.
See `PROJECT_STATUS.md` for the honest state of each.

## Why angle arithmetic is centralised

Ecliptic longitude is modular: 359° and 1° are two degrees apart, not 358.
Wrapping bugs are the most common silent defect in astrology software, and they
produce plausible-looking wrong answers rather than crashes.

Therefore **all** wrapping goes through `@astrolapp/shared/angles`:
`normalizeDegrees`, `angularSeparation`, `signedAngularDifference`. No module
implements its own `% 360`.

`normalizeDegrees` additionally guards a floating-point edge: an input
infinitesimally below zero can round to exactly 360, which would yield sign
index 12 and crash sign lookup. It is clamped to 0 and tested.

## Key design decisions

**Ephemeris behind an interface.** Nothing outside `src/ephemeris/` imports an
astronomy library. Swapping providers is one new class. See ADR 0001.

**Everything is reproducible.** Every chart stores its provider, provider
version, engine version, house system, orb configuration, body list, instant and
coordinates. `natal.test.ts` asserts a chart recomputed from its own stored
metadata is byte-identical.

**Calculation never contains prose.** `aspects.ts` has no idea what a square
means. It returns `{ type, exactAngle, actualAngle, orb, normalizedStrength,
phase }` and interpretation is keyed off that downstream.

**Configuration over constants.** Orbs, aspect sets, scoring weights, master
numbers and Y-handling are all data, passed in and overridable. Product and
tradition changes should not require engine changes.

**Applying vs separating is computed, not reasoned.** Rather than case-analysing
which body is faster and which side of exact it sits on — easy to get subtly
wrong across the 0/360 seam — the engine projects both bodies forward a small
step and asks whether the orb shrank. That _is_ the definition. When relative
motion is negligible (near a station) it returns `unknown` rather than guessing.

## Time handling

Birth times are wall-clock readings plus a place; charts need an absolute
instant. One hour of error moves the ascendant ~15°, a whole sign.

`resolveLocalTimeToInstant` uses the IANA database via `Intl` (never fixed
offsets) and classifies the result:

- `unique` — normal.
- `ambiguous` — a daylight-saving fall-back; the reading occurred twice. The
  earlier instant is returned **and the caller must surface the ambiguity**.
- `nonexistent` — inside a spring-forward gap; the reading never occurred.

Silently resolving these would hide a real ~15° uncertainty from the user.
