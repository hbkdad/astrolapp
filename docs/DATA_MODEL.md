# Data model

`packages/db`

Migrations are portable PostgreSQL and run against a plain Postgres instance or
Supabase. Row-level security is separated into `0002` because it depends on
Supabase's `auth` schema.

## Sources of truth versus caches

| Kind                | Tables                                                                                                      | Losing it costs |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| **Source of truth** | `users`, `profiles`, `birth_profiles`, `subscriptions`, `notification_preferences`, `compatibility_reports` | Real data       |
| **Cache**           | `birth_charts`, `daily_contexts`, `daily_readings`, `numerology_profiles`                                   | CPU only        |

Every cache row carries the engine versions that produced it and can be
truncated at any time. This split is what makes engine changes safe to ship.

## Cache invalidation is version-driven

The failure being designed against: an engine change ships, and every user keeps
seeing charts computed under the **old** rules — indefinitely, and invisibly,
because the output still looks completely normal.

So every cache key includes the engine and provider versions:

```
birthChartCacheKey  = hash(instant, lat, lon, houseSystem,
                           ephemerisProvider, ephemerisVersion, astroVersion)
dailyContextCacheKey = hash(chartKey, date, numerologyFingerprint,
                            astro, lunar, numerology, scoreModel versions)
dailyReadingCacheKey = hash(contextKey, source, interpretationVersion)
```

Keys cascade: a changed chart key changes every context built on it.

**Therefore: bumping `ENGINE_VERSIONS` is the cache invalidation mechanism.**
Changing a calculation without bumping the version leaves wrong data live.

Two details that matter:

- **Coordinates are rounded to 6 decimals before hashing** (~0.1 m). Without
  this, float noise in the last bits produces a different key for the same
  physical place and the cache never hits.
- **The numerology fingerprint hashes the name.** Cache keys reach logs, metrics
  and error reports; a user's full birth name must not travel to any of those.

## Personal data

Birth data lives in exactly one table, `birth_profiles`, so deletion and export
have one place to look.

- `birth_time` is nullable and paired with `birth_time_known`. A missing birth
  time is **not** midnight — without it the Ascendant, Midheaven and all house
  placements are unreliable and the UI suppresses them.
- `time_resolution` records whether the local birth time was `unique`,
  `ambiguous` (a DST fall-back, so it happened twice) or `nonexistent` (inside a
  spring-forward gap). Ambiguity is a real ~15° uncertainty in the Ascendant and
  must be surfaced, not silently resolved.
- `audit_events.detail` must never contain birth dates, times, coordinates,
  names or secrets. Audit rows outlive the data they describe and are read by
  operators.

## Sharing

`compatibility_reports.share_token` is **random, never derived**. A derived token
would let anyone holding the underlying data reconstruct the URL and — worse —
let anyone holding the URL confirm a guess about the data.

RLS deliberately grants **no** anonymous access to public reports. A policy
allowing anonymous `SELECT` on `is_public` rows would expose the whole row,
including both profile ids. Share links are served by a server endpoint that
resolves the token and returns a redacted projection, keeping that logic in one
place.

## Entitlements

Resolved server-side from subscription state, never supplied by the client, and
never compared inline in UI components — ask `hasFeature`.

`resolvePlan` **fails closed**: unknown plans, unknown statuses, and entitling
statuses whose `current_period_end` has already passed all resolve to `free`. A
bug here should cost a user features, never hand out paid ones. `past_due` still
entitles, because cutting off a paying customer mid-dunning is worse than a few
days of grace.

Hiding a button is presentation, not access control — gate the server route too.

## Webhook idempotency

`processed_webhook_events` has a composite primary key of `(provider,
event_id)`. Insert the event id in the **same transaction** that applies the
effect and let the primary key reject replays. Payment providers redeliver
events routinely; processing one twice must not double-apply.

## Verification

```bash
pnpm verify:schema
```

Spins up a throwaway PostgreSQL 17 container — the major version Supabase
runs — applies both migrations plus a stub `auth.uid()`, and then asserts
behaviour rather than mere syntax:

- RLS is enabled on every table holding user data.
- Acting as a non-superuser role, one user cannot read another's birth profile
  **or** their derived charts. Testing as `postgres` would pass no matter how
  broken the policies were, because superusers bypass RLS.
- A client cannot alter its own subscription plan or insert a fabricated chart.
- Constraints fire: incoherent birth-time state, out-of-range coordinates, a
  public report with no share token, a report comparing someone with themselves,
  duplicate primary profiles, and webhook replay.
- Deleting a user cascades to birth data and every derived cache.

The assertions were negative-controlled: disabling RLS on `birth_charts`, and
separately weakening its policy to `USING (true)`, both make the run fail. A
check that cannot fail proves nothing.

Applying the migrations for the first time immediately found a real bug: the
schema used `citext` for emails without ever running `CREATE EXTENSION citext`.
Every table after `users` would have failed. That is the value of running SQL
rather than reading it.

## Deployed

Applied to the Supabase project `astrolapp` (`lhbwcmfhbziqugzuomfz`,
ca-central-1, PostgreSQL 17.6) and verified **on the live database**, not only
locally:

- All 13 tables report `relrowsecurity = true`.
- Acting as `authenticated` with Alice's JWT claim: 1 profile and 1 chart
  visible. As `service_role`, which bypasses RLS: 2 and 2. The gap is the proof
  — had both returned the same number, the check would have been vacuous.
- Acting as `anon`: zero rows from `birth_profiles`, `birth_charts` and `users`.
- Test rows were removed afterwards; cascade deletes cleared the caches.

Supabase's linter surfaced two warnings, both fixed in `0003` and by moving
`citext`:

- `citext` was installed in `public`, exposing its functions through the REST
  surface. Moved to `extensions` and referenced schema-qualified. Verified after
  the move that case-insensitive comparison and the unique index still hold.
- `public.rls_auto_enable()` — a Supabase-provided event trigger, not ours — was
  `SECURITY DEFINER` with EXECUTE granted to `anon`. Revoked. (Low practical
  risk: an `event_trigger` function cannot be invoked over RPC. It is also why
  our tables had RLS on before `0002` even ran.)

The one remaining lint is INFO-level and intentional: `processed_webhook_events`
has RLS enabled with no policy, which is default-deny for every client role.

## Not yet built

No query layer, no ORM, no connection pooling and no seed data. Nothing in the
application reads or writes the database yet — see `PROJECT_STATUS.md`.
