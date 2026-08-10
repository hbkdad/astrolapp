# Astrology engine

`packages/astro-engine`

## Coordinate frame

All longitudes are **tropical ecliptic, true equinox and ecliptic of date**, in
degrees on `[0, 360)`. This is not J2000. Precession moves the two apart by about
50.3 arcseconds per year (~0.335° between J2000 and 2024), so mixing them shifts
every placement by roughly a third of a degree today and more later.

`ephemeris.test.ts` asserts the frame against published equinox times to within
0.01°, so a dependency upgrade cannot change it silently.

## Zodiac

```
signIndex     = floor(longitude / 30)
degreeInSign  = longitude - signIndex * 30
```

Signs in order from 0° Aries. Boundary behaviour is tested explicitly at 0°,
29.999°, exactly 30°, 359.999°, 360° and negative inputs.

## Aspects

Minimum angular separation:

```
diff       = normalize(a - b)
separation = min(diff, 360 - diff)      // [0, 180]
orb        = |separation - exactAngle|
strength   = max(0, 1 - orb / maxOrb)   // 1 at exact, 0 at the limit
```

Majors: conjunction 0°, sextile 60°, square 90°, trine 120°, opposition 180°.
Minors (opt-in): semisextile 30°, semisquare 45°, quintile 72°, sesquiquadrate
135°, quincunx 150°.

Default orbs (degrees): conjunction 8, sextile 5, square 7, trine 7, opposition
8; minors 2–3. **Orbs are configuration, not fact** — pass an `OrbConfig` to
change them. A zero or missing orb disables that aspect.

When several aspects are within orb, the tightest wins.

### Applying and separating

Computed by projecting both bodies forward one hundredth of a day and comparing
orbs. Returns `applying`, `separating`, or `unknown` when relative motion is
below 1e-4 °/day — near a station the direction genuinely is indeterminate, and
asserting one would produce a prediction that reverses within hours.

## Houses

Inputs: Greenwich apparent sidereal time, true obliquity, observer coordinates.

```
RAMC = normalize(GST° + longitudeEast)
MC   = atan2(sin RAMC, cos RAMC · cos ε)
ASC  = atan2(cos RAMC, −(sin RAMC · cos ε + tan φ · sin ε))
```

Obliquity is read from the ephemeris provider's own rotation matrix rather than
computed independently, so houses and planets stay in one consistent frame.

**Placidus** solves each intermediate cusp by fixed-point iteration, because the
relation is implicit — the cusp position depends on declination, which depends on
the cusp position:

```
RA → ecliptic longitude → declination → ascensional difference → RA
```

with `AD = asin(tan φ · tan δ)` and

| Cusp | Right ascension           |
| ---- | ------------------------- |
| 11   | `RAMC + ⅓(90 + AD)`       |
| 12   | `RAMC + ⅔(90 + AD)`       |
| 2    | `RAMC + 180 − ⅔(90 − AD)` |
| 3    | `RAMC + 180 − ⅓(90 − AD)` |

Cusps 4–9 are exactly opposite 10–3. Convergence takes well under ten passes.

**Placidus throws inside the polar circles**, where the semi-arc does not exist.
See ADR 0002. Whole Sign and Equal are defined everywhere.

**The MC is only the tenth cusp under Placidus.** Angles are returned separately
from cusps for this reason.

## Transits

`computeTransits` compares current positions against natal bodies _and_ the
angles (`ascendant`, `midheaven`). Natal points are fixed, so only the transiting
body contributes motion when classifying applying/separating.

`findTransitWindow` locates orb entry, exactness and orb exit. It scans on a
coarse step looking for a sign change in the signed orb, then bisects to the
minute. The coarse scan matters: retrograde motion lets a slow planet perfect the
same aspect three times, and a naive monotonic search would find only the first.

Scoring is a **heuristic** — see ADR 0003 before displaying it anywhere.

## Reproducibility

Every chart records provider, provider version, engine version, house system,
orbs, body list, instant and coordinates. Recomputing from stored metadata is
asserted to be identical.
