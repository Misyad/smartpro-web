-- Auth <-> profile linkage.
--
-- Supabase Auth writes to auth.users; the application reads public.profiles.
-- Without this trigger a signed-up user has no profile and every RLS policy
-- that joins profiles fails closed (user sees nothing). That is the safe
-- failure mode, but it makes signup appear broken.
--
-- The trigger creates the profile with the least privilege possible:
-- role='pelanggan', points=0, is_vip=false, kyc_status='belum'.
-- It never reads role from user metadata — a client could set that.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  suffix integer := 0;
begin
  -- Derive a username from the email local-part or the provided metadata.
  base_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'user'
  );
  -- Keep it URL-safe and bounded.
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  if base_username = '' then
    base_username := 'user';
  end if;
  final_username := base_username;

  -- Resolve collisions deterministically instead of failing signup.
  while exists (select 1 from profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into profiles (id, username, name, role, phone)
  values (
    new.id,
    final_username,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), final_username),
    -- Hard-coded: never trust metadata for privilege.
    'pelanggan',
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
