# ADR 0002 — Pluggable house systems, and failing loudly at the poles

Status: **Accepted** · 2026-08-09

## Context

House systems divide the ecliptic into twelve sectors relative to the horizon.
Traditions disagree, users have preferences, and — importantly — some systems are
mathematically undefined for some birthplaces.

## Decision

Support `placidus`, `whole-sign` and `equal` behind a `HouseSystem` union, with
the system recorded in every chart's `calculationMetadata`. Default to Placidus
as the most widely expected in Western practice, but treat the default as a
product setting rather than a structural assumption.

Store the **system used** alongside cusps so a stored chart remains interpretable
if the default changes.

## Placidus is undefined inside the polar circles

Placidus divides a body's diurnal semi-arc into thirds. Above roughly 66° of
latitude, parts of the ecliptic never rise or set, the semi-arc does not exist,
and the defining equation has no solution — `asin` of a value outside [-1, 1].

Many implementations silently clamp, wrap, or return NaN-tainted cusps here. That
is the worst outcome: a chart that looks plausible and is meaningless.

**This engine throws `HouseSystemUndefinedError`**, naming the latitude and
recommending a fallback. Callers are expected to catch it and offer Whole Sign or
Equal, which are defined everywhere. This is deliberately a visible failure.

## The midheaven is not always the tenth cusp

Under Placidus, cusp 10 _is_ the MC. Under Whole Sign and Equal it is not — the
MC floats and can land in the 9th, 10th or 11th house. This is correct behaviour,
not a bug.

Consequently `ChartAngles` is returned **separately** from `cusps`, and code must
never assume `cusps[9]` is the midheaven. `houses.test.ts` asserts the identity
holds for Placidus specifically, not universally.

## Verification approach

The ascendant and midheaven formulas are checked against an _independent_ path:
the computed longitude is converted to horizontal coordinates using the ephemeris
library's own rotation machinery, and asserted to sit on the horizon (altitude 0)
and on the meridian respectively — across four cities in both hemispheres,
including the equator, on four dates.

Atmospheric refraction must be disabled for this check. It lifts a body at the
horizon by ~0.48°, which on first run looked exactly like a formula error.
