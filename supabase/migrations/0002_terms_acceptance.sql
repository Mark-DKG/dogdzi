-- Record which version of the Terms of Service each user accepted, and when.
alter table public.user_preferences
  add column if not exists terms_version text check (char_length(terms_version) <= 32),
  add column if not exists terms_accepted_at timestamptz;
