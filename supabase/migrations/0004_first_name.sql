-- First name used to greet the user. Set at sign-up (from auth metadata) or in Settings.
alter table public.user_preferences
  add column if not exists first_name text check (char_length(first_name) between 1 and 40);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_first text := nullif(left(btrim(regexp_replace(coalesce(new.raw_user_meta_data ->> 'first_name', ''), '[[:cntrl:]]|\s+', ' ', 'g')), 40), '');
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_preferences (user_id, first_name) values (new.id, btrim(v_first)) on conflict do nothing;
  insert into public.notification_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
