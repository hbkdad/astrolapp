# Lunar engine

`packages/astro-engine/src/lunar.ts`

## Phase from positions, never from a calendar

```
phaseAngle = normalize(moonLongitude − sunLongitude)   // [0, 360)
```

0° is New, 90° First Quarter, 180° Full, 270° Third Quarter.

An approximate synodic-day model drifts by hours within a single lunation and
will put a Full Moon on the wrong calendar date several times a year — something
users notice immediately. The engine therefore derives phase from actual solar
and lunar longitudes, and gets exact lunation instants from the provider's phase
search rather than from arithmetic.

Verified against published 2024 lunation times to within two minutes.

## Naming a phase at an arbitrary moment

The four principal phases are _instants_, not intervals, but a product still has
to name the Moon's state right now. The engine centres a **45° band** on each of
the eight canonical angles, so "Full Moon" means within 22.5° of exact
opposition — roughly 1¾ days either side.

This is a **presentation convention**, documented as such. Exact instants remain
available through `findNextPhase` and `computeUpcomingLunations`.

Implemented as `round(angle / 45) mod 8`, which handles the New Moon band
straddling the 0/360 seam correctly — the one case a naive interval comparison
gets wrong. Tested at 350°, 359.999°, 360° and 10°, all of which must be
`new-moon`.

## Moon age

Days since the preceding New Moon. The provider searches forward only, so
`findPreviousNewMoon` starts a lunation and a half back and steps forward to the
last crossing that has already occurred. A 40-day window is guaranteed to contain
at least one New Moon.

Asserted to stay within `[0, 29.6)` across a two-month sweep.

## Sign ingress

`findNextMoonSignIngress` bisects on the sign index. The Moon covers ~13°/day and
never stations, so its longitude increases monotonically and a sign boundary is
crossed at most once in the three-day search window.

## Not yet implemented

Moonrise, moonset, altitude, azimuth and culmination. `astronomy-engine` provides
`SearchRiseSet` and `Horizon`, so these are a straightforward addition behind
`EphemerisProvider` — they are simply not built yet, and are listed as pending in
`PROJECT_STATUS.md` rather than stubbed.

Personal lunar analysis (Moon-to-natal contacts) is available today by calling
`computeTransits` restricted to the Moon; a dedicated Lunar Influence heuristic
has not been built.
