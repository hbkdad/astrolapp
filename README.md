# astrolapp

A computational platform for astrology, lunar cycles and numerology.

The goal is not "a horoscope website". It is a reliable calculation platform that
happens to provide horoscope, astrology, lunar and numerology experiences. Every
displayed result should be traceable, reproducible, explainable and testable.

> **Current state:** there is a working app (284 tests). Enter birth details and
> you get a calculated natal chart, a personalised daily reading with explainable
> scores, and an interactive chart wheel — no AI required. Persistence, auth,
> subscriptions and SEO pages are not built. See
> [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for an honest breakdown.

```bash
pnpm install
pnpm dev      # run the app
pnpm demo     # print a reading to the terminal
pnpm verify   # lint, typecheck, tests, builds
```

## What exists today

```ts
import {
  defaultEphemerisProvider,
  computeNatalChart,
  computeTransits,
  computeLunarState,
  resolveLocalTimeToInstant,
  formatZodiacPosition,
} from '@astrolapp/astro-engine';

// Birth times are wall-clock readings; resolving them is explicit.
const birth = resolveLocalTimeToInstant(
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30 },
  'Europe/London',
);
if (birth.kind !== 'unique') {
  // Daylight-saving overlap or gap: a real ~15° ascendant ambiguity.
}

const chart = computeNatalChart(defaultEphemerisProvider, {
  instant: birth.instant,
  coordinates: { latitude: 51.5074, longitude: -0.1278 },
  houseSystem: 'placidus',
});

const sun = chart.placements.find((p) => p.body === 'sun');
if (sun) {
  console.log(formatZodiacPosition(sun.position), `house ${sun.house}`);
}

const today = computeTransits(defaultEphemerisProvider, chart, new Date());
const moon = computeLunarState(defaultEphemerisProvider, new Date());
```

```ts
import { PythagoreanNumerology } from '@astrolapp/numerology-engine';

const numerology = new PythagoreanNumerology();
const profile = numerology.calculateProfile({ year: 1990, month: 5, day: 15 }, 'John Smith');
console.log(profile.lifePath.value, profile.lifePath.trace); // every step shown
```

## The three layers

| Layer                    | What it is                | Rule                                      |
| ------------------------ | ------------------------- | ----------------------------------------- |
| **A. Astronomical fact** | Positions, phases, angles | Never estimated or generated              |
| **B. Interpretation**    | Meanings, scores          | Deterministic, keyed off A                |
| **C. Language**          | AI-written prose          | Consumes validated B, produces no numbers |

**An AI model never produces a planetary position, aspect, orb, placement or
numerology value.** Those come from the engines. The product must work fully with
the AI layer switched off.

## Packages

- `@astrolapp/shared` — angle arithmetic, engine version stamps
- `@astrolapp/astro-engine` — ephemeris, zodiac, aspects, houses, time, natal,
  transits, lunar
- `@astrolapp/numerology-engine` — normalization, reduction, Pythagorean system
- `@astrolapp/context-engine` — category scoring, combined daily context
- `@astrolapp/interpretation-engine` — facts, interpretations, deterministic
  readings, AI schema validation and claim screening
- `@astrolapp/db` — schema migrations, version-driven cache keys, entitlements
- `apps/web` — Next.js application; all calculation runs server-side

## Documentation

- [AGENTS.md](AGENTS.md) — conventions and boundaries
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/ASTROLOGY_ENGINE.md](docs/ASTROLOGY_ENGINE.md)
- [docs/NUMEROLOGY_ENGINE.md](docs/NUMEROLOGY_ENGINE.md)
- [docs/LUNAR_ENGINE.md](docs/LUNAR_ENGINE.md)
- [docs/INTERPRETATION_ENGINE.md](docs/INTERPRETATION_ENGINE.md)
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)
- ADRs: [ephemeris choice](docs/ADR/0001-ephemeris-provider.md) ·
  [house systems](docs/ADR/0002-house-systems.md) ·
  [scores are heuristics](docs/ADR/0003-scores-are-heuristics.md)

## A note on claims

Astrology and numerology are interpretive traditions. This project treats the
astronomy as fact and the interpretation as tradition, and keeps the two
separable in code so the distinction survives into the UI.

Scores such as "Career 91" are **product heuristics** — weighted editorial
judgements, not measurements. They ship with their contributing factors so they
can always be explained. Nothing here should be presented as scientifically
established prediction, or as grounds for medical, financial, legal or safety
decisions.

## Licence

Unlicensed / private. Third-party: `astronomy-engine` (MIT). Swiss Ephemeris was
evaluated and not adopted — see ADR 0001.
