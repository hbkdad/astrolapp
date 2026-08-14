-- 0002_row_level_security.sql
--
-- Row-level security. SUPABASE-SPECIFIC: relies on `auth.uid()`. On a plain
-- Postgres deployment, skip this migration and enforce ownership in the
-- application's data layer instead.
--
-- Every policy is granted TO authenticated, so the anonymous role falls through
-- to default-deny and can read nothing. Verified live against Supabase.
--
-- RLS is defence in depth, NOT the only authorization. Every server-side query
-- must still scope by owner. RLS is what stops a missed `WHERE user_id = ...`
-- from becoming a data breach.
--
-- Note the caches: birth_charts, daily_contexts, daily_readings and
-- numerology_profiles contain derived personal data and are protected by
-- joining back to the owning birth profile. Leaving a cache table open because
-- "it is only derived data" would expose the very thing the source table
-- protects.

BEGIN;

ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE birth_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE birth_charts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_contexts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_readings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE numerology_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE compatibility_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events             ENABLE ROW LEVEL SECURITY;

-- processed_webhook_events holds no user data and is written only by
-- service-role webhook handlers. RLS is enabled with NO policy, so every
-- client-facing role is denied by default. Supabase's linter reports this as
-- INFO "RLS enabled, no policy" — that is the intended state, not an oversight.
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Identity ------------------------------------------------------------------

CREATE POLICY users_self_select ON users
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY users_self_update ON users
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY profiles_self_all ON profiles
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Birth data ----------------------------------------------------------------

CREATE POLICY birth_profiles_owner_all ON birth_profiles
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Derived caches ------------------------------------------------------------
-- Read-only to the client. Writes happen through service-role server code,
-- which bypasses RLS; a browser must never be able to insert a "computed"
-- chart, because that would let it fabricate its own astrology.

CREATE POLICY birth_charts_owner_select ON birth_charts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM birth_profiles p
      WHERE p.id = birth_charts.birth_profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY daily_contexts_owner_select ON daily_contexts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM birth_profiles p
      WHERE p.id = daily_contexts.birth_profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY daily_readings_owner_select ON daily_readings
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM birth_profiles p
      WHERE p.id = daily_readings.birth_profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY numerology_profiles_owner_select ON numerology_profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM birth_profiles p
      WHERE p.id = numerology_profiles.birth_profile_id AND p.user_id = auth.uid()
    )
  );

-- Compatibility -------------------------------------------------------------

CREATE POLICY compatibility_owner_all ON compatibility_reports
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Public share access is deliberately NOT granted here.
--
-- A policy allowing anonymous SELECT on `is_public` rows would expose the whole
-- row, including profile_a_id and profile_b_id and any personal fields the
-- report contains. Public share links are served by a server-side endpoint that
-- looks up the token and returns a REDACTED projection. Keeping that logic in
-- one place is what stops private birth data leaking through a share URL.

-- Billing -------------------------------------------------------------------
-- Read-only to the client. Subscription state is written exclusively by
-- verified webhooks running with service-role credentials; a client that could
-- write here could grant itself a paid plan.

CREATE POLICY subscriptions_owner_select ON subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Notifications -------------------------------------------------------------

CREATE POLICY notification_preferences_owner_all ON notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_deliveries_owner_select ON notification_deliveries
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Audit ---------------------------------------------------------------------
-- Readable by the subject, never writable by them.

CREATE POLICY audit_events_owner_select ON audit_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

COMMIT;
