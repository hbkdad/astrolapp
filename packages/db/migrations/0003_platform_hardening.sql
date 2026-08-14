-- 0003_platform_hardening.sql
--
-- Findings from the Supabase database linter, applied to the live project.
-- Guarded so this is a harmless no-op on plain PostgreSQL, where the object
-- below does not exist.
--
-- Kept as a migration rather than a one-off console fix so that the repository
-- reproduces production. A hardening step applied by hand and never written
-- down is one that silently disappears the next time the project is rebuilt.

BEGIN;

-- `public.rls_auto_enable()` is a Supabase-provided event trigger that
-- automatically enables RLS on newly created tables in `public`. It is
-- SECURITY DEFINER and ships with EXECUTE granted to `anon` and
-- `authenticated`, which the linter flags.
--
-- The practical risk is low: it returns `event_trigger`, and such a function
-- cannot be invoked outside an event-trigger context, so the exposed RPC
-- endpoint would error rather than do anything. But nothing legitimate calls
-- it either, so the grant is pure attack surface and is removed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;
  END IF;
END $$;

COMMIT;
