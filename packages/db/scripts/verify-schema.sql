-- Schema verification.
--
-- Applying a migration only proves it parses. This proves it BEHAVES: that RLS
-- actually isolates one user's birth data from another's, that the derived
-- cache tables are covered too, and that the constraints reject the states they
-- were written to reject.
--
-- Run against a throwaway database with 0001, the auth stub and 0002 applied.
-- See scripts/verify-migrations.sh.
--
-- Every check RAISEs on failure, so a non-zero psql exit means a real problem.

\set ON_ERROR_STOP on
\pset pager off

BEGIN;

-- A role that does NOT bypass RLS. The superuser does, so testing as postgres
-- would pass no matter how broken the policies were.
CREATE ROLE app_user NOLOGIN;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA auth TO app_user;

-- Two users with birth data and a derived chart each.
INSERT INTO users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

INSERT INTO birth_profiles
  (id, user_id, label, birth_date, birth_time, birth_time_known,
   birth_timezone, latitude, longitude, birth_instant)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Alice', '1990-05-15', '14:30', true,
   'Europe/London', 51.5074, -0.1278, '1990-05-15T13:30:00Z'),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'Bob', '1985-02-02', NULL, false,
   'America/New_York', 40.7128, -74.0060, '1985-02-02T17:00:00Z');

INSERT INTO birth_charts
  (birth_profile_id, cache_key, house_system, chart,
   astro_engine_version, ephemeris_provider, ephemeris_version)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'chart:alice', 'placidus', '{}'::jsonb,
   '1.0.0', 'astronomy-engine', '2.1.19'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'chart:bob', 'whole-sign', '{}'::jsonb,
   '1.0.0', 'astronomy-engine', '2.1.19');

INSERT INTO subscriptions (user_id, plan, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'free', 'active');

-- ---------------------------------------------------------------------------
-- Every table that holds user data must have RLS switched on.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  unprotected text;
BEGIN
  SELECT string_agg(c.relname, ', ')
    INTO unprotected
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity
    -- processed_webhook_events holds no user data and is service-role only.
    AND c.relname <> 'processed_webhook_events';

  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'Tables without RLS: %', unprotected;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Isolation: acting as Alice, Bob's rows must be invisible.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE app_user;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
  visible int;
BEGIN
  SELECT count(*) INTO visible FROM birth_profiles;
  IF visible <> 1 THEN
    RAISE EXCEPTION 'Alice sees % birth profiles, expected only her own', visible;
  END IF;

  SELECT count(*) INTO visible FROM birth_profiles WHERE label = 'Bob';
  IF visible <> 0 THEN
    RAISE EXCEPTION 'Alice can read Bob''s birth profile';
  END IF;

  -- The derived caches carry the same personal data and must be equally closed.
  -- Leaving them open because "it is only derived" would defeat the source table.
  SELECT count(*) INTO visible FROM birth_charts;
  IF visible <> 1 THEN
    RAISE EXCEPTION 'Alice sees % birth charts, expected only her own', visible;
  END IF;

  SELECT count(*) INTO visible FROM birth_charts WHERE cache_key = 'chart:bob';
  IF visible <> 0 THEN
    RAISE EXCEPTION 'Alice can read Bob''s computed chart';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- A client must not be able to grant itself a paid plan.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  changed int;
BEGIN
  UPDATE subscriptions SET plan = 'advanced'
   WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN
    RAISE EXCEPTION 'A client was able to modify its own subscription plan';
  END IF;
EXCEPTION
  -- No UPDATE policy exists, so a hard denial is the correct outcome too.
  WHEN insufficient_privilege THEN NULL;
END $$;

-- Writing a fabricated chart must also be refused: only server-side service-role
-- code may populate the caches, or a browser could invent its own astrology.
DO $$
BEGIN
  INSERT INTO birth_charts
    (birth_profile_id, cache_key, house_system, chart,
     astro_engine_version, ephemeris_provider, ephemeris_version)
  VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', 'chart:forged', 'placidus', '{}'::jsonb,
     '1.0.0', 'forged', '0');
  RAISE EXCEPTION 'A client was able to insert a fabricated chart';
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN NULL;
END $$;

RESET ROLE;
RESET request.jwt.claim.sub;

-- ---------------------------------------------------------------------------
-- Constraints must reject the states they were written for.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- birth_time_known = true with no time recorded is incoherent.
  BEGIN
    INSERT INTO birth_profiles
      (user_id, label, birth_date, birth_time, birth_time_known,
       birth_timezone, latitude, longitude, birth_instant)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'Bad', '1990-01-01', NULL, true,
       'UTC', 0, 0, now());
    RAISE EXCEPTION 'birth_profiles_time_consistency did not fire';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Out-of-range coordinates.
  BEGIN
    INSERT INTO birth_profiles
      (user_id, label, birth_date, birth_timezone, latitude, longitude, birth_instant)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'Bad', '1990-01-01', 'UTC', 91, 0, now());
    RAISE EXCEPTION 'latitude range check did not fire';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A public report with no token would be unreachable, and the flag misleading.
  BEGIN
    INSERT INTO compatibility_reports
      (user_id, profile_a_id, profile_b_id, report, is_public, share_token)
    VALUES
      ('11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-0000-0000-0000-000000000001',
       'bbbbbbbb-0000-0000-0000-000000000002', '{}'::jsonb, true, NULL);
    RAISE EXCEPTION 'compatibility_public_requires_token did not fire';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A report comparing someone with themselves is meaningless.
  BEGIN
    INSERT INTO compatibility_reports
      (user_id, profile_a_id, profile_b_id, report)
    VALUES
      ('11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-0000-0000-0000-000000000001',
       'aaaaaaaa-0000-0000-0000-000000000001', '{}'::jsonb);
    RAISE EXCEPTION 'compatibility_distinct_profiles did not fire';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Webhook replay protection.
  INSERT INTO processed_webhook_events (provider, event_id) VALUES ('stripe', 'evt_1');
  BEGIN
    INSERT INTO processed_webhook_events (provider, event_id) VALUES ('stripe', 'evt_1');
    RAISE EXCEPTION 'a webhook event could be processed twice';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- Only one primary birth profile per user.
DO $$
BEGIN
  UPDATE birth_profiles SET is_primary = true
   WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
  BEGIN
    INSERT INTO birth_profiles
      (user_id, label, birth_date, birth_timezone, latitude, longitude,
       birth_instant, is_primary)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'Second primary', '1990-01-01',
       'UTC', 0, 0, now(), true);
    RAISE EXCEPTION 'a user was allowed two primary birth profiles';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- Deleting a user must take their birth data and every derived cache with it.
DO $$
DECLARE
  remaining int;
BEGIN
  DELETE FROM users WHERE id = '22222222-2222-2222-2222-222222222222';

  SELECT count(*) INTO remaining FROM birth_profiles WHERE label = 'Bob';
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'birth profile survived user deletion';
  END IF;

  SELECT count(*) INTO remaining FROM birth_charts WHERE cache_key = 'chart:bob';
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'computed chart survived user deletion';
  END IF;
END $$;

ROLLBACK;

\echo 'SCHEMA VERIFICATION PASSED'
