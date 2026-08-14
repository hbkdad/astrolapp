# Context and interpretation engines

`packages/context-engine` (Goal 10) and `packages/interpretation-engine` (Goal 11)

## The join point

`computeDailyContext` combines natal chart, current sky, lunar state, personal
lunar contacts and numerology cycles into one structured object. It produces
**data, never prose**.

Everything downstream — deterministic templates, AI language, dashboards,
notifications — reads that object and nothing else. This is what makes the "AI
never invents astronomy" rule structural rather than aspirational: by the time
any prose is written, every number already exists and has been verified.

## FACT and INTERPRETATION are different fields

The single most important structure in the interpretation engine:

```ts
{
  fact:           "Transiting Saturn is conjunct your natal Venus, 1.70° from
                   exact and applying, moving retrograde. Saturn is at 14°35' Aries.",
  interpretation: "Astrology traditionally reads transiting Saturn — structure
                   and responsibility — conjunct your natal Venus — what you
                   love and value — as a merging..."
}
```

The fact is mechanically derived from verified numbers and can be checked
against an ephemeris. The interpretation is a tradition and says so. A UI may
present them together, but it can always show which is which, and callers must
never merge them into one field.

`facts.ts` carries the rule directly: if a sentence could not be verified with an
ephemeris, it does not belong in that file.

## Interpretation resolution

Two paths, in priority order:

1. **`specific`** — a hand-written entry for the exact key
   (`transit.saturn.conjunction.saturn` → "Saturn Return").
2. **`composed`** — assembled from body, target and aspect themes.

Composition always succeeds, so an interpretation is never missing. Writing
bespoke copy for every combination would need 700+ entries before minor aspects;
instead each body, target and aspect carries a theme and these compose.
`Interpretation.source` reports which path ran, which makes gaps in the content
library **measurable** rather than invisible.

## Category scores

```
contribution = (strength / 100) × affinity(body, category)
                                × affinity(target, category)
                                × valence(aspect)

score        = 50 + 50 × tanh(Σ contribution / VALENCE_SCALE)
confidence   = 1 − exp(−Σ |relevance| / CONFIDENCE_SCALE)
```

Design points that matter:

- **A quiet category scores 50 with confidence 0**, not 0. "Love: 0" reads to a
  user as catastrophe; the truth is "nothing is happening here". Confidence is
  what distinguishes a genuinely balanced day from an empty one, and the UI must
  surface both.
- **Every score lists its contributions**, sorted by influence, and they sum to
  the reported valence. A score that cannot be decomposed is one the product
  cannot explain.
- **`VALENCE_SCALE` is display calibration.** At 1.5 nearly every day mapped into
  45–55 and every category read "mixed" — the number carried no information. At
  0.6 an ordinary day spreads across roughly 25–75. A test samples a year of real
  transits and fails if the spread collapses again.
- **Scores come from the full transit set**, not the truncated display list, so
  asking the UI for fewer rows never changes the numbers.

`opportunity` and `friction` are deliberately **not** categories: they describe
the character of a day rather than a life area, and a day can be high in both.

## The AI layer

Optional by design. `buildDailyReading` is the complete product with AI switched
off — not a degraded mode.

Model output is schema-validated and then screened by `findUnsupportedClaims`,
which rejects two failure modes:

1. **Fabricated astronomy.** Degrees, orbs and illumination figures are all
   computed upstream and already appear in the `fact` strings. Their appearance
   in _generated_ prose means the model minted a number.
2. **Overclaiming.** Certainty language, and medical, financial, legal or safety
   direction — prohibited regardless of provenance.

Rejection is wholesale, never partial: a response that fabricated one figure is
not trustworthy on the others. A rejected response is discarded and the
deterministic reading is used.

### Privacy boundary

The model payload carries **no birth date, birth time, coordinates or name**.

This was found by a test rather than by inspection. Numerology `fact` strings
include their own derivation — `"Year: 1990 → 19 → 10 → 1"` — so sending them
would hand the model the user's date of birth in order to write a sentence that
only needs the resulting number. The payload now sends numerology values alone;
many birth dates reduce to the same value, so the value is not reversible.

## Content rules, enforced mechanically

`content-safety.test.ts` scans **every** user-facing string the system can emit —
hand-written entries, composed interpretations across a spread of dates, and AI
output — for prohibited claims and second-person predictive phrasing.

A failure there means the product is about to tell a user something it has no
business telling them. The rules are not left to reviewer discipline.

Note that `fact` strings legitimately contain degree figures: they are the
computed values. The claim screen exists for generated prose, and a test
documents that boundary so it is not accidentally tightened into forbidding real
data.

## Seeing it work

```bash
pnpm demo
```

Prints a complete reading with the FACT/INTERPRETATION split visible, category
scores with their plain-language bands, and the "why" behind a score.
