-- 0001_core_schema.sql
--
-- Core domain schema. Portable PostgreSQL: runs on a plain Postgres instance or
-- on Supabase. Row-level security is a separate migration (0002) because it
-- depends on Supabase's auth schema.
--
-- Design notes that matter:
--
--   * Birth data is personal data. It lives in exactly one table
--     (`birth_profiles`) so deletion and export have one place to look.
--   * Computed charts, contexts and readings are CACHES, not sources of truth.
--     Every one carries the engine versions that produced it and can be dropped
--     and recomputed at any time. See packages/db/src/cache-keys.ts.
--   * Nothing here stores a plan or entitlement that the client can influence.
--     Subscription state comes from the payment provider's webhooks only.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Soft-delete marker. Actual erasure is a scheduled job so that a mistaken
  -- deletion has a recovery window; see docs/PRIVACY.md.
  deleted_at    timestamptz
);

CREATE UNIQUE INDEX users_email_unique ON users (email) WHERE deleted_at IS NULL;

CREATE TABLE profiles (
  user_id       uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name  text,
  -- IANA zone the user currently lives in, used for notification timing. This
  -- is NOT the birth timezone, which belongs to the birth profile.
  timezone      text,
  locale        text NOT NULL DEFAULT 'en',
  -- Free-form UI preferences. Never entitlements.
  preferences   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Birth data
-- ---------------------------------------------------------------------------

-- How the local birth time mapped onto the UTC timeline. Mirrors
-- TimeResolutionKind in the astro engine; 'ambiguous' and 'nonexistent' must be
-- surfaced to the user rather than silently resolved.
CREATE TYPE time_resolution AS ENUM ('unique', 'ambiguous', 'nonexistent');

CREATE TABLE birth_profiles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- 'Me', 'Mum', 'Alex' — user-supplied and personal. Never exposed publicly.
  label              text NOT NULL,

  birth_date         date NOT NULL,
  -- Null when the user does not know their birth time. This is common, and it
  -- is NOT the same as midnight: without a time the ascendant, midheaven and
  -- all house placements are unreliable and must be suppressed in the UI.
  birth_time         time,
  birth_time_known   boolean NOT NULL DEFAULT false,

  -- IANA zone of the BIRTH place at the birth date, not the user's zone today.
  birth_timezone     text NOT NULL,
  latitude           numeric(9, 6) NOT NULL,
  longitude          numeric(9, 6) NOT NULL,
  -- Human-readable place, for display. Coordinates are authoritative.
  place_label        text,

  -- Resolved UTC instant, and how the resolution went.
  birth_instant      timestamptz NOT NULL,
  time_resolution    time_resolution NOT NULL DEFAULT 'unique',

  -- Full birth name, used for numerology. Optional.
  full_name          text,

  is_primary         boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT birth_profiles_latitude_range  CHECK (latitude  BETWEEN -90  AND 90),
  CONSTRAINT birth_profiles_longitude_range CHECK (longitude BETWEEN -180 AND 180),
  -- A known birth time must actually have a time recorded.
  CONSTRAINT birth_profiles_time_consistency
    CHECK (NOT birth_time_known OR birth_time IS NOT NULL)
);

CREATE INDEX birth_profiles_user_id_idx ON birth_profiles (user_id);
-- At most one primary profile per user.
CREATE UNIQUE INDEX birth_profiles_one_primary
  ON birth_profiles (user_id) WHERE is_primary;

-- ---------------------------------------------------------------------------
-- Computed caches
--
-- Everything below is derivable. Truncating these tables costs CPU, never data.
-- ---------------------------------------------------------------------------

CREATE TABLE birth_charts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  birth_profile_id    uuid NOT NULL REFERENCES birth_profiles (id) ON DELETE CASCADE,
  -- Includes engine and provider versions; see cache-keys.ts. A version bump
  -- yields a new key, so stale rows become unreachable rather than being served.
  cache_key           text NOT NULL,
  house_system        text NOT NULL,

  -- The full NatalChart object: placements, angles, cusps, aspects, metadata.
  -- Stored whole because it is always read whole, and because the shape is
  -- owned by the engine rather than by the database.
  chart               jsonb NOT NULL,

  astro_engine_version text NOT NULL,
  ephemeris_provider   text NOT NULL,
  ephemeris_version    text NOT NULL,
  computed_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX birth_charts_cache_key ON birth_charts (cache_key);
CREATE INDEX birth_charts_profile_idx ON birth_charts (birth_profile_id);

CREATE TABLE daily_contexts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  birth_profile_id  uuid NOT NULL REFERENCES birth_profiles (id) ON DELETE CASCADE,
  cache_key         text NOT NULL,
  context_date      date NOT NULL,

  context           jsonb NOT NULL,

  score_model_version text NOT NULL,
  computed_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX daily_contexts_cache_key ON daily_contexts (cache_key);
CREATE INDEX daily_contexts_profile_date_idx
  ON daily_contexts (birth_profile_id, context_date DESC);

CREATE TYPE reading_source AS ENUM ('deterministic', 'ai');

CREATE TABLE daily_readings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  birth_profile_id  uuid NOT NULL REFERENCES birth_profiles (id) ON DELETE CASCADE,
  cache_key         text NOT NULL,
  reading_date      date NOT NULL,

  reading           jsonb NOT NULL,
  source            reading_source NOT NULL DEFAULT 'deterministic',
  -- Populated when an AI response was rejected, so rejection rates are
  -- measurable rather than invisible.
  rejection_reasons text[],

  interpretation_version text NOT NULL,
  computed_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX daily_readings_cache_key ON daily_readings (cache_key);
CREATE INDEX daily_readings_profile_date_idx
  ON daily_readings (birth_profile_id, reading_date DESC);

CREATE TABLE numerology_profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  birth_profile_id  uuid NOT NULL REFERENCES birth_profiles (id) ON DELETE CASCADE,
  system_id         text NOT NULL,
  -- Full profile including calculation traces, so a displayed number can always
  -- be justified without recomputing.
  profile           jsonb NOT NULL,
  numerology_version text NOT NULL,
  computed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX numerology_profiles_unique
  ON numerology_profiles (birth_profile_id, system_id, numerology_version);

-- ---------------------------------------------------------------------------
-- Compatibility and sharing
-- ---------------------------------------------------------------------------

CREATE TABLE compatibility_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  profile_a_id      uuid NOT NULL REFERENCES birth_profiles (id) ON DELETE CASCADE,
  profile_b_id      uuid NOT NULL REFERENCES birth_profiles (id) ON DELETE CASCADE,

  report            jsonb NOT NULL,

  -- Opaque and random, never derived from birth data. A derived token would let
  -- a holder of the URL confirm a guess about the underlying data.
  share_token       text,
  -- Sharing is off unless explicitly turned on.
  is_public         boolean NOT NULL DEFAULT false,
  share_expires_at  timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT compatibility_distinct_profiles CHECK (profile_a_id <> profile_b_id),
  -- Cannot be public without a token to reach it by.
  CONSTRAINT compatibility_public_requires_token
    CHECK (NOT is_public OR share_token IS NOT NULL)
);

CREATE UNIQUE INDEX compatibility_share_token ON compatibility_reports (share_token)
  WHERE share_token IS NOT NULL;
CREATE INDEX compatibility_user_idx ON compatibility_reports (user_id);

-- ---------------------------------------------------------------------------
-- Billing and entitlements
-- ---------------------------------------------------------------------------

CREATE TYPE subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'paused'
);

CREATE TABLE subscriptions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- Plan identifier resolved to entitlements SERVER-SIDE. The client never
  -- supplies or influences this value.
  plan                      text NOT NULL,
  status                    subscription_status NOT NULL,

  provider                  text NOT NULL DEFAULT 'stripe',
  provider_customer_id      text,
  provider_subscription_id  text,

  current_period_end        timestamptz,
  cancel_at_period_end      boolean NOT NULL DEFAULT false,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscriptions_provider_subscription
  ON subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX subscriptions_user_idx ON subscriptions (user_id);

-- Webhook idempotency. A payment provider will redeliver events; processing one
-- twice must not double-apply. Insert the event id here inside the same
-- transaction that applies the effect, and let the primary key reject replays.
CREATE TABLE processed_webhook_events (
  provider     text NOT NULL,
  event_id     text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE notification_preferences (
  user_id            uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  -- Opt-in by default off, for every channel.
  email_enabled      boolean NOT NULL DEFAULT false,
  push_enabled       boolean NOT NULL DEFAULT false,
  daily_briefing     boolean NOT NULL DEFAULT false,
  lunar_events       boolean NOT NULL DEFAULT false,
  major_transits     boolean NOT NULL DEFAULT false,
  numerology_cycles  boolean NOT NULL DEFAULT false,
  -- Local hour of day the user wants their briefing, 0-23.
  preferred_hour     smallint NOT NULL DEFAULT 8,
  -- Hard cap the user can lower but the system will never exceed.
  max_per_week       smallint NOT NULL DEFAULT 7,
  unsubscribed_at    timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notification_hour_range CHECK (preferred_hour BETWEEN 0 AND 23)
);

CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'failed', 'suppressed');

CREATE TABLE notification_deliveries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel          text NOT NULL,
  -- Stable per logical notification, so a retry cannot send twice.
  idempotency_key  text NOT NULL,
  scheduled_for    timestamptz NOT NULL,
  sent_at          timestamptz,
  status           delivery_status NOT NULL DEFAULT 'pending',
  failure_reason   text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notification_deliveries_idempotency
  ON notification_deliveries (idempotency_key);
CREATE INDEX notification_deliveries_pending_idx
  ON notification_deliveries (scheduled_for) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

CREATE TABLE audit_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  action      text NOT NULL,
  -- Never store birth date, birth time, coordinates, names or secrets here.
  -- Audit rows outlive the data they describe and are read by operators.
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_user_idx ON audit_events (user_id, created_at DESC);

COMMIT;
