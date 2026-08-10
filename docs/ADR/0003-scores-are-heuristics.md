# ADR 0003 — Scores are product heuristics, and must be presented as such

Status: **Accepted** · 2026-08-09

## Context

The product shows numbers like "Career 91" and "Lunar Influence 84/100". These
are compelling precisely because they look measured. They are not measured.

## Decision

Every score is a **product heuristic**: a weighted combination of editorial
judgement and geometry. The codebase separates the two so the distinction cannot
quietly disappear on its way to the UI.

`TransitEvent.strength` is computed as:

```
strength ∝ transitingBodyWeight × natalTargetWeight × aspectWeight × orbStrength
```

Of these four factors, exactly one — `orbStrength` — is derived from astronomy.
The other three come from `DEFAULT_TRANSIT_WEIGHTS`, which is editorial
configuration living in a plain data table.

## Consequences

1. **Every score ships with its factors.** `TransitEvent.strengthFactors`
   contains the four multiplicands. A score that cannot be decomposed is a score
   users cannot be shown an explanation for, and `natal.test.ts` asserts that the
   factors reproduce the reported strength exactly.

2. **Weights are versioned.** `ENGINE_VERSIONS.scoreModel` must be bumped when a
   weight changes, otherwise previously stored reports silently stop being
   reproducible.

3. **Language constraints are binding.** Acceptable: "astrology traditionally
   interprets this as…", "within this system…", "this reading is based on…".
   Not acceptable: any phrasing that presents a score as measurement, evidence,
   prediction, or grounds for a medical, financial, legal or safety decision.

4. **Weights are replaceable.** A different astrological tradition — or a
   different product decision — should require editing one table, not touching
   any calculation. `computeTransits` accepts a `weights` override for exactly
   this reason.

## What is _not_ a heuristic

The geometry underneath is astronomical fact and is held to a different standard:
positions, phase angles, aspect separations, orbs, exact-contact timings and
house cusps are all verifiable, and are verified against published reference
values. The heuristic layer sits strictly on top and never feeds back into it.
