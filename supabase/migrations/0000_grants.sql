-- Restore the standard Supabase grants that are missing from this project.
--
-- Symptom: every REST call returned 42501 "permission denied for table ..."
-- even with the service_role key. Root cause is not RLS — it is the absence of
-- table-level privileges for the anon / authenticated / service_role roles.
-- Without GRANT, Postgres rejects the statement before RLS is even evaluated.
--
-- This is additive and reversible: it only adds privileges, changes no table,
-- drops nothing, and touches zero rows.

-- 1. Schema usage
grant usage on schema public to anon, authenticated, service_role;

-- 2. Table privileges, matching Supabase's documented defaults:
--      anon          -> SELECT only (RLS still filters rows)
--      authenticated -> SELECT, INSERT, UPDATE, DELETE (RLS decides which rows)
--      service_role  -> full access (bypasses RLS by design)
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

-- 3. Sequences (needed for any serial/identity column)
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- 4. Functions
grant execute on all functions in schema public to anon, authenticated, service_role;

-- 5. Ensure future tables created by migrations inherit the same grants
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
