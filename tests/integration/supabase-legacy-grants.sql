-- Run against a fresh local stack BEFORE the app migrations.
--
-- The production project predates Supabase's switch to "new tables are not
-- exposed to the Data API without explicit GRANTs": its tables carry the old
-- default grants (anon, authenticated and service_role get every privilege,
-- and Row-Level Security does the real work). A local stack started by a
-- current CLI does not, so without this the integration suite would test a
-- database where `authenticated` cannot touch user_notes at all, and pass or
-- fail for reasons production never sees.
--
-- This restores the legacy default so the local database matches what the
-- migrations produced in production. It is test setup, not a migration.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
