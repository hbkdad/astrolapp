# Testing

```bash
pnpm test        # 202 tests
pnpm verify      # lint + typecheck + test + build
```

## The rule that matters most

**Never loosen a tolerance to make a failing calculation pass.** A tolerance that
has to widen is evidence of a regression. Find the cause.

**Never generate fixtures from this codebase's own output.** That proves
self-consistency, not correctness. Fixtures must come from independent published
reference values.

## Fixtures

`packages/astro-engine/src/ephemeris/fixtures.ts` holds published 2024 equinox,
solstice, lunation and retrograde-interval data with explicit tolerances. Each
tolerance is sized to absorb the rounding in the published source and nothing
more — published times are given to the minute, and the Sun moves 0.00068°/min,
so 0.01° of slack is generous.

## Verification strategies used

**Frame lock.** The single highest-impact silent failure would be the ephemeris
returning J2000 coordinates instead of ecliptic-of-date. Both are "correct"
longitudes; they differ by ~0.335° today and the gap grows. Nothing else in the
system would notice. Locked by asserting solar longitude at published equinoxes.

**Independent-path verification.** The ascendant and midheaven are computed by
our own spherical trigonometry, then checked by converting the result to
horizontal coordinates through the ephemeris library's _separate_ rotation
machinery and asserting altitude ≈ 0 (on the horizon) and azimuth ≈ 0 or 180 (on
the meridian). Across four cities in both hemispheres including the equator, on
four dates. This catches formula errors that a self-consistent test would not.

> Refraction must be disabled for this check. It lifts a body at the horizon by
> ~0.483°, which on first run looked exactly like a formula bug — a constant
> error identical to 14 decimal places across every case, which is the signature
> of a systematic offset rather than a formula error.

**Round-trip reproducibility.** A natal chart recomputed purely from its own
stored `calculationMetadata` must equal the original.

**Structural invariants.** House cusps must partition the full circle: twelve
positive forward spans summing to exactly 360°. Opposite cusps exactly 180°
apart. Every longitude assigned to exactly one house.

**Boundary sweeps.** Zodiac signs at 0 / 29.999 / 30 / 359.999 / 360 / negative.
Orb limits at exactly the limit and just beyond. Phase bands at each midpoint.

**Seam crossing.** Anything modular is tested across 0/360: aspect detection,
applying/separating classification, phase naming, and numerical differentiation
of longitude (a 0/360 straddle must not produce a ~36000°/day spike).

**Hand-worked examples.** Numerology values are checked against arithmetic worked
out in the test comments, so a reviewer can verify the expectation independently
of the implementation.

## Coverage by area

| Area             | Tests | Notes                                                   |
| ---------------- | ----- | ------------------------------------------------------- |
| Angle arithmetic | 11    | Wrapping, seam, float edges                             |
| Zodiac           | 12    | Sign boundaries                                         |
| Ephemeris        | 25    | Frame lock, fixtures, retrograde, determinism           |
| Aspects          | 17    | Orbs, applying/separating, seam                         |
| Houses           | 41    | Independent horizon verification, polar failure         |
| Time zones       | 11    | DST gap and overlap                                     |
| Lunar            | 20    | Phase bands, published lunations, age                   |
| Natal + transits | 21    | Reproducibility, score decomposition, exact-time search |
| Numerology       | 44    | Normalization, Unicode, masters, hand-worked values     |

## Not yet built

Integration tests (no database yet), E2E tests (no application yet), and visual
regression tests. These are blocked on the application layer, not skipped.
