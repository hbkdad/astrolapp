-- TEST HARNESS ONLY — never apply this to a real database.
--
-- Supabase provides the `auth` schema and `auth.uid()`. Plain PostgreSQL does
-- not, so migration 0002 cannot be applied locally without a stand-in. This
-- stub reads the same JWT claim setting Supabase uses, which lets the policy
-- SQL be verified against real PostgreSQL before it ever reaches production.
--
-- Applying this on Supabase would shadow the genuine auth schema. It exists
-- purely so `tools/verify-schema.ts` can prove the policies behave.

-- Supabase ships `anon`, `authenticated` and `service_role`. The policies are
-- granted TO authenticated, so without these roles they would match nothing and
-- the local verification would be meaningless.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated;
