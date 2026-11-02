-- ════════════════════════════════════════════════════════════════════
-- DOGDZI — initial schema
--
-- Principles enforced here, not only in the app:
--   • Every user table has row-level security; users only see their rows.
--   • Users can't delete actions, occurrences or history. They cancel.
--   • action_history, accountability_responses and audit_log are
--     append-only (UPDATE/DELETE blocked by trigger for every role).
--   • A missed or skipped occurrence can't be turned back into "pending".
--   • Admin tables and analytics are reachable only by the service role,
--     from server code that checks admin permissions and writes the audit log.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────── helpers ───────────────────────────────

-- Set only inside delete_my_account()/purge_user_data() so cascading deletes
-- of a user's own data can pass the append-only guards.
create or replace function public.is_purging() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('dogdzi.purge', true), '') = 'on'
$$;

create or replace function public.prevent_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_purging() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception '% is append-only: records cannot be changed or removed', tg_table_name
    using errcode = 'P0001';
end $$;

-- ─────────────────────────────── profiles ───────────────────────────────

create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text check (char_length(display_name) <= 80),
  signup_source           text not null default 'direct' check (signup_source in ('direct', 'guest_conversion')),
  converted_from_guest_at timestamptz,
  last_active_at          timestamptz,
  created_at              timestamptz not null default now()
);

create table public.user_preferences (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  life_areas           text[] not null default array['personal','work','health','home'],
  timezone             text not null default 'UTC' check (char_length(timezone) <= 64),
  week_starts_on       smallint not null default 1 check (week_starts_on in (0, 1)),
  onboarding_completed boolean not null default false,
  updated_at           timestamptz not null default now(),
  constraint life_areas_valid check (life_areas <@ array['personal','work','education','health','home','finance','social','custom'])
);

create table public.notification_preferences (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  reminder_style text not null default 'standard' check (reminder_style in ('gentle','standard','firm','persistent')),
  quiet_start    time not null default '22:00',
  quiet_end      time not null default '07:00',
  max_per_day    smallint not null default 12 check (max_per_day between 1 and 50),
  push_enabled   boolean not null default false,
  updated_at     timestamptz not null default now()
);

-- Create profile + preference rows for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.notification_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── categories & goals ───────────────────────────

create table public.categories (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  area       text not null check (area in ('personal','work','education','health','home','finance','social','custom')),
  color      text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  position   integer not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.goals (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 140),
  description text check (char_length(description) <= 2000),
  kind        text not null default 'goal' check (kind in ('goal','project')),
  category_id uuid,
  target_date date,
  status      text not null default 'active' check (status in ('active','paused','completed','archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id)
);

create table public.milestones (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  goal_id      uuid not null,
  title        text not null check (char_length(title) between 1 and 140),
  target_date  date,
  position     integer not null default 0,
  status       text not null default 'todo' check (status in ('todo','done')),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);

-- ───────────────────────────── actions ─────────────────────────────

create table public.actions (
  id                uuid primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 140),
  notes             text check (char_length(notes) <= 2000),
  category_id       uuid,
  kind              text not null default 'task' check (kind in ('task','routine','habit')),
  priority          text not null default 'normal' check (priority in ('low','normal','high')),
  start_date        date not null,
  due_time          time,
  duration_min      integer check (duration_min between 1 and 1440),
  recurrence        jsonb check (recurrence is null or jsonb_typeof(recurrence) = 'object'),
  reminder_offsets  integer[] not null default '{}',
  reminders_enabled boolean not null default true,
  goal_id           uuid,
  milestone_id      uuid,
  status            text not null default 'active' check (status in ('active','cancelled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id)  references public.categories (id, user_id),
  foreign key (goal_id, user_id)      references public.goals (id, user_id),
  foreign key (milestone_id, user_id) references public.milestones (id, user_id)
);

-- One row per time an action is due. Status changes; rows are never deleted.
create table public.occurrences (
  id                  uuid primary key,
  user_id             uuid not null references auth.users (id) on delete cascade,
  action_id           uuid not null,
  scheduled_date      date not null,
  scheduled_time      time,
  status              text not null default 'pending'
                        check (status in ('pending','done','missed','skipped','rescheduled','cancelled')),
  resolution          text check (resolution in ('completed_late','rescheduled','recovery_plan','cancelled','acknowledged')),
  completed_at        timestamptz,
  source              text not null default 'single' check (source in ('single','recurrence','reschedule','recovery')),
  rescheduled_from_id uuid,
  rescheduled_to_id   uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, user_id),
  foreign key (action_id, user_id) references public.actions (id, user_id),
  foreign key (rescheduled_from_id, user_id) references public.occurrences (id, user_id) deferrable initially deferred,
  foreign key (rescheduled_to_id, user_id)   references public.occurrences (id, user_id) deferrable initially deferred
);

create unique index occurrences_recurrence_day on public.occurrences (action_id, scheduled_date) where source = 'recurrence';
create index occurrences_user_date on public.occurrences (user_id, scheduled_date);
create index occurrences_needs_review on public.occurrences (user_id) where status = 'missed' and resolution is null;

-- Missed/skipped can be resolved (done late, rescheduled, …) but never reopened as pending,
-- and a recorded resolution can't be erased.
create or replace function public.guard_occurrence_transition() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_purging() then return new; end if;
  if old.status in ('missed','skipped') and new.status not in ('missed','skipped','done') then
    raise exception 'A missed or skipped action cannot be reopened' using errcode = 'P0001';
  end if;
  if old.status in ('missed','skipped') and old.resolution is not null and new.resolution is null then
    raise exception 'A recorded resolution cannot be removed' using errcode = 'P0001';
  end if;
  if new.user_id <> old.user_id or new.action_id <> old.action_id then
    raise exception 'Occurrence ownership cannot change' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger occurrences_transition_guard
  before update on public.occurrences
  for each row execute function public.guard_occurrence_transition();

-- ─────────────────────── history & accountability ───────────────────────

create table public.action_history (
  id            uuid primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  action_id     uuid not null,
  occurrence_id uuid,
  event_type    text not null check (event_type in (
                  'created','edited','completed','completed_late','reopened','missed','skipped','rescheduled',
                  'cancelled','acknowledged','reason_recorded','recovery_plan_created','recovery_plan_completed',
                  'admin_annotation')),
  data          jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  created_at    timestamptz not null default now(),
  recorded_at   timestamptz not null default now(),
  foreign key (action_id, user_id) references public.actions (id, user_id),
  foreign key (occurrence_id, user_id) references public.occurrences (id, user_id)
);
create index action_history_user_time on public.action_history (user_id, created_at desc);

create table public.accountability_responses (
  id            uuid primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  action_id     uuid not null,
  occurrence_id uuid not null,
  trigger       text not null check (trigger in ('missed','skipped')),
  reason_code   text not null check (reason_code in ('forgot','no_time','low_energy','unexpected_event',
                  'unclear_next_step','blocked','changed_priorities','unwell','other')),
  note          text check (char_length(note) <= 1000),
  outcome       text not null check (outcome in ('completed_late','rescheduled','recovery_plan','cancelled','acknowledged')),
  created_at    timestamptz not null default now(),
  recorded_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (action_id, user_id) references public.actions (id, user_id),
  foreign key (occurrence_id, user_id) references public.occurrences (id, user_id)
);
create index accountability_responses_user_time on public.accountability_responses (user_id, created_at desc);

create trigger action_history_append_only
  before update or delete on public.action_history
  for each row execute function public.prevent_mutation();
create trigger accountability_responses_append_only
  before update or delete on public.accountability_responses
  for each row execute function public.prevent_mutation();

create table public.recovery_plans (
  id            uuid primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  action_id     uuid not null,
  occurrence_id uuid not null,
  response_id   uuid,
  title         text not null check (char_length(title) between 1 and 140),
  steps         jsonb not null default '[]' check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 12),
  restart_date  date,
  status        text not null default 'active' check (status in ('active','completed','abandoned')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (action_id, user_id) references public.actions (id, user_id),
  foreign key (occurrence_id, user_id) references public.occurrences (id, user_id),
  foreign key (response_id, user_id) references public.accountability_responses (id, user_id)
);

-- ─────────────────────────── reminders & push ───────────────────────────

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  endpoint        text not null unique check (endpoint like 'https://%'),
  p256dh          text not null,
  auth            text not null,
  user_agent      text check (char_length(user_agent) <= 300),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count   integer not null default 0
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

-- Delivery log for server-sent reminders (de-duplication + daily limits).
create table public.reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  occurrence_id uuid not null,
  dedupe_key    text not null,
  kind          text not null check (kind in ('before','due','followup','day')),
  scheduled_for timestamptz not null,
  channel       text not null default 'push' check (channel in ('push')),
  status        text not null check (status in ('sent','failed','suppressed')),
  sent_at       timestamptz not null default now(),
  unique (user_id, dedupe_key),
  foreign key (occurrence_id, user_id) references public.occurrences (id, user_id)
);
create index reminders_user_sent on public.reminders (user_id, sent_at desc);

-- ────────────────────────── product analytics ──────────────────────────
-- Written only by the server (service role) after consent checks. Never
-- contains action titles, notes or reasons.

create table public.app_sessions (
  id             uuid primary key,
  user_id        uuid references auth.users (id) on delete set null,
  guest_id       uuid,
  is_guest       boolean not null,
  platform       text not null default 'other' check (platform in ('android','ios','desktop','other')),
  display_mode   text not null default 'browser' check (display_mode in ('browser','standalone')),
  started_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  ended_at       timestamptz,
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400),
  check ((is_guest and guest_id is not null) or (not is_guest))
);
create index app_sessions_started on public.app_sessions (started_at);
create index app_sessions_user on public.app_sessions (user_id, started_at);
create index app_sessions_guest on public.app_sessions (guest_id, started_at);

create table public.analytics_events (
  id         bigint generated always as identity primary key,
  name       text not null check (name in ('signup_completed','guest_converted','onboarding_completed','action_created',
               'routine_created','action_completed','action_missed','action_skipped','recovery_plan_created',
               'goal_created','push_enabled')),
  user_id    uuid references auth.users (id) on delete set null,
  guest_id   uuid,
  is_guest   boolean not null,
  platform   text not null default 'other' check (platform in ('android','ios','desktop','other')),
  props      jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and pg_column_size(props) < 1024),
  created_at timestamptz not null default now()
);
create index analytics_events_time on public.analytics_events (created_at, name);

-- ───────────────────────────── admin (RBAC) ─────────────────────────────
-- The permission matrix is mirrored in src/lib/admin/permissions.ts, which
-- server code enforces; tests/permissions.test.ts fails if they drift.

create table public.admin_roles (
  role        text primary key,
  description text not null
);

create table public.admin_permissions (
  permission  text primary key,
  description text not null,
  is_write    boolean not null default false
);

create table public.role_permissions (
  role       text not null references public.admin_roles (role) on delete cascade,
  permission text not null references public.admin_permissions (permission) on delete cascade,
  primary key (role, permission)
);

create table public.admin_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         text not null references public.admin_roles (role),
  display_name text check (char_length(display_name) <= 80),
  created_at   timestamptz not null default now(),
  created_by   uuid,
  disabled_at  timestamptz
);

-- Extra permissions granted to an individual admin (e.g. content:write for one support lead).
create table public.admin_permission_grants (
  admin_user_id uuid not null references public.admin_users (user_id) on delete cascade,
  permission    text not null references public.admin_permissions (permission) on delete cascade,
  granted_by    uuid,
  granted_at    timestamptz not null default now(),
  primary key (admin_user_id, permission)
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid,
  actor_role  text,
  action      text not null,
  target_type text,
  target_id   text,
  reason      text check (char_length(reason) <= 500),
  metadata    jsonb not null default '{}',
  ip          text,
  user_agent  text
);
create index audit_log_time on public.audit_log (created_at desc);
create index audit_log_actor on public.audit_log (actor_id, created_at desc);
create index audit_log_target on public.audit_log (target_type, target_id);

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.prevent_mutation();

create table public.system_settings (
  key        text primary key check (key in ('announcement')),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.admin_roles (role, description) values
  ('super_admin',    'Manages admin roles, system settings and access policies'),
  ('support_admin',  'Inspects permitted account and content details for support requests'),
  ('readonly_admin', 'Views permitted information; cannot change anything');

insert into public.admin_permissions (permission, description, is_write) values
  ('accounts:read',        'View account details (email, dates, status, counts)', false),
  ('accounts:write',       'Suspend/restore accounts, send password resets',      true),
  ('content:read',         'View a user''s actions and history (reason required)',  false),
  ('content:write',        'Append support annotations to a user''s history',     true),
  ('analytics:read',       'View aggregate analytics',                              false),
  ('analytics:user_level', 'View identifiable per-user activity',                   false),
  ('audit:read',           'View the admin audit log',                              false),
  ('admins:manage',        'Add, remove and change admin roles and grants',         true),
  ('settings:manage',      'Change system settings',                                true);

insert into public.role_permissions (role, permission) values
  ('super_admin', 'accounts:read'), ('super_admin', 'accounts:write'),
  ('super_admin', 'content:read'),  ('super_admin', 'content:write'),
  ('super_admin', 'analytics:read'), ('super_admin', 'analytics:user_level'),
  ('super_admin', 'audit:read'),    ('super_admin', 'admins:manage'),
  ('super_admin', 'settings:manage'),
  ('support_admin', 'accounts:read'), ('support_admin', 'accounts:write'),
  ('support_admin', 'content:read'),  ('support_admin', 'analytics:read'),
  ('readonly_admin', 'accounts:read'), ('readonly_admin', 'analytics:read');

insert into public.system_settings (key, value) values ('announcement', '{"text": "", "active": false}');

-- ───────────────────────────── row-level security ─────────────────────────────

alter table public.profiles                 enable row level security;
alter table public.user_preferences         enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.categories               enable row level security;
alter table public.goals                    enable row level security;
alter table public.milestones               enable row level security;
alter table public.actions                  enable row level security;
alter table public.occurrences              enable row level security;
alter table public.action_history           enable row level security;
alter table public.accountability_responses enable row level security;
alter table public.recovery_plans           enable row level security;
alter table public.push_subscriptions       enable row level security;
alter table public.reminders                enable row level security;
alter table public.app_sessions             enable row level security;
alter table public.analytics_events         enable row level security;
alter table public.admin_roles              enable row level security;
alter table public.admin_permissions        enable row level security;
alter table public.role_permissions         enable row level security;
alter table public.admin_users              enable row level security;
alter table public.admin_permission_grants  enable row level security;
alter table public.audit_log                enable row level security;
alter table public.system_settings          enable row level security;

-- Owner can read / create / update; no delete policies exist for user content.
do $$
declare t text;
begin
  foreach t in array array['categories','goals','milestones','actions','occurrences','recovery_plans']
  loop
    execute format('create policy %1$s_select_own on public.%1$s for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_insert_own on public.%1$s for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_update_own on public.%1$s for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;

  -- Append-only: read and insert only.
  foreach t in array array['action_history','accountability_responses']
  loop
    execute format('create policy %1$s_select_own on public.%1$s for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_insert_own on public.%1$s for insert to authenticated with check (user_id = (select auth.uid()))', t);
  end loop;

  foreach t in array array['user_preferences','notification_preferences']
  loop
    execute format('create policy %1$s_select_own on public.%1$s for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_insert_own on public.%1$s for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_update_own on public.%1$s for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_own on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_update_own on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

create policy reminders_select_own on public.reminders for select to authenticated using (user_id = (select auth.uid()));

-- The in-app announcement is public; every other setting is admin-only.
create policy system_settings_public_announcement on public.system_settings for select to anon, authenticated
  using (key = 'announcement');

-- app_sessions, analytics_events and all admin tables: no policies → only the service role can access them.

-- Defence in depth: clients never delete user content and anon gets nothing.
revoke all on all tables in schema public from anon;
grant select on public.system_settings to anon;
revoke delete, truncate on public.categories, public.goals, public.milestones, public.actions, public.occurrences,
  public.action_history, public.accountability_responses, public.recovery_plans, public.profiles,
  public.user_preferences, public.notification_preferences, public.reminders from authenticated;
revoke update on public.action_history, public.accountability_responses from authenticated;
revoke all on public.app_sessions, public.analytics_events, public.admin_roles, public.admin_permissions,
  public.role_permissions, public.admin_users, public.admin_permission_grants, public.audit_log from authenticated;
revoke insert, update, delete on public.system_settings from authenticated;

-- ───────────────────────────── account deletion ─────────────────────────────

-- Server-side purge (service role). Removes the auth user and, by cascade, all their data.
-- Analytics rows are kept but anonymised (user_id → null).
create or replace function public.purge_user_data(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('dogdzi.purge', 'on', true);
  delete from auth.users where id = p_user;
end $$;

-- Self-service deletion for the signed-in user.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.admin_users where user_id = uid) then
    raise exception 'Admin accounts must be removed by a super admin first' using errcode = '42501';
  end if;
  perform public.purge_user_data(uid);
end $$;

revoke all on function public.purge_user_data(uuid) from public, anon, authenticated;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.purge_user_data(uuid) to service_role;

-- ───────────────────────────── admin read functions ─────────────────────────────
-- All service-role only. The admin console calls them after checking permissions.

create or replace function public.admin_analytics(p_from timestamptz, p_to timestamptz, p_platform text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
with s as (
  select * from public.app_sessions
  where started_at >= p_from and started_at < p_to
    and (p_platform is null or platform = p_platform)
),
ev as (
  select * from public.analytics_events
  where created_at >= p_from and created_at < p_to
    and (p_platform is null or platform = p_platform)
),
recent as (
  select coalesce(user_id::text, 'g:' || guest_id::text) as who, last_seen_at
  from public.app_sessions
  where started_at < p_to and last_seen_at >= p_to - interval '30 days'
    and (p_platform is null or platform = p_platform)
),
cohort as (
  select p.id, p.created_at,
    exists (select 1 from public.app_sessions x where x.user_id = p.id and x.started_at >= p.created_at + interval '1 day')  as r1,
    exists (select 1 from public.app_sessions x where x.user_id = p.id and x.started_at >= p.created_at + interval '7 days') as r7,
    exists (select 1 from public.app_sessions x where x.user_id = p.id and x.started_at >= p.created_at + interval '30 days') as r30
  from public.profiles p
  where p.created_at >= p_from and p.created_at < p_to
)
select jsonb_build_object(
  'range', jsonb_build_object('from', p_from, 'to', p_to, 'platform', p_platform),
  'accounts', jsonb_build_object(
    'total', (select count(*) from public.profiles),
    'new', (select count(*) from public.profiles where created_at >= p_from and created_at < p_to),
    'from_guest', (select count(*) from public.profiles where converted_from_guest_at >= p_from and converted_from_guest_at < p_to)
  ),
  'users', jsonb_build_object(
    'active_registered', (select count(distinct user_id) from s where not is_guest and user_id is not null),
    'active_guests',     (select count(distinct guest_id) from s where is_guest),
    'returning_registered', (select count(*) from (
        select user_id from s where not is_guest and user_id is not null
        group by user_id having count(distinct (started_at at time zone 'UTC')::date) >= 2) x),
    'dau', (select count(distinct who) from recent where last_seen_at >= p_to - interval '1 day'),
    'wau', (select count(distinct who) from recent where last_seen_at >= p_to - interval '7 days'),
    'mau', (select count(distinct who) from recent)
  ),
  'sessions', jsonb_build_object(
    'count', (select count(*) from s),
    'total_seconds', (select coalesce(sum(active_seconds), 0) from s),
    'avg_session_seconds', (select coalesce(round(avg(active_seconds)), 0) from s),
    'avg_seconds_per_user', (select coalesce(round(sum(active_seconds)::numeric
        / nullif(count(distinct coalesce(user_id::text, 'g:' || guest_id::text)), 0)), 0) from s)
  ),
  'segments', (select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
      select case when is_guest then 'guest' else 'registered' end as segment,
             count(*) as sessions,
             count(distinct coalesce(user_id::text, 'g:' || guest_id::text)) as users,
             coalesce(sum(active_seconds), 0) as seconds
      from s group by 1 order by 1) x),
  'platforms', (select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
      select platform, display_mode, count(*) as sessions,
             count(distinct coalesce(user_id::text, 'g:' || guest_id::text)) as users,
             coalesce(sum(active_seconds), 0) as seconds
      from s group by 1, 2 order by 3 desc) x),
  'daily', (select coalesce(jsonb_agg(row_to_json(x) order by x.date), '[]'::jsonb) from (
      select (started_at at time zone 'UTC')::date as date,
             count(distinct coalesce(user_id::text, 'g:' || guest_id::text)) as active,
             count(*) as sessions,
             coalesce(sum(active_seconds), 0) as seconds
      from s group by 1) x),
  'actions', jsonb_build_object(
    'registered', jsonb_build_object(
      'created',   (select count(*) from public.actions where created_at >= p_from and created_at < p_to),
      'completed', (select count(*) from public.occurrences where status = 'done' and completed_at >= p_from and completed_at < p_to),
      'missed',    (select count(*) from public.action_history where event_type = 'missed' and created_at >= p_from and created_at < p_to),
      'skipped',   (select count(*) from public.action_history where event_type = 'skipped' and created_at >= p_from and created_at < p_to),
      'recovery_created',   (select count(*) from public.recovery_plans where created_at >= p_from and created_at < p_to),
      'recovery_completed', (select count(*) from public.recovery_plans where status = 'completed' and updated_at >= p_from and updated_at < p_to)
    ),
    'guest', jsonb_build_object(
      'created',   (select count(*) from ev where is_guest and name in ('action_created','routine_created')),
      'completed', (select count(*) from ev where is_guest and name = 'action_completed'),
      'missed',    (select count(*) from ev where is_guest and name = 'action_missed'),
      'skipped',   (select count(*) from ev where is_guest and name = 'action_skipped'),
      'recovery_created', (select count(*) from ev where is_guest and name = 'recovery_plan_created')
    )
  ),
  'conversions', (select count(*) from ev where name = 'guest_converted'),
  'retention', jsonb_build_object(
    'cohort', (select count(*) from cohort),
    'd1',  jsonb_build_object('eligible', (select count(*) from cohort where created_at <= now() - interval '1 day'),
                              'returned', (select count(*) from cohort where r1 and created_at <= now() - interval '1 day')),
    'd7',  jsonb_build_object('eligible', (select count(*) from cohort where created_at <= now() - interval '7 days'),
                              'returned', (select count(*) from cohort where r7 and created_at <= now() - interval '7 days')),
    'd30', jsonb_build_object('eligible', (select count(*) from cohort where created_at <= now() - interval '30 days'),
                              'returned', (select count(*) from cohort where r30 and created_at <= now() - interval '30 days'))
  )
);
$$;

create or replace function public.admin_list_users(p_search text default null, p_limit integer default 25, p_offset integer default 0)
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz,
               last_active_at timestamptz, is_admin boolean, action_count bigint, total_count bigint)
language sql stable security definer set search_path = '' as $$
  with base as (
    select u.id, u.email::text as email, u.created_at, u.last_sign_in_at, u.banned_until, p.last_active_at,
           exists (select 1 from public.admin_users a where a.user_id = u.id) as is_admin
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p_search is null or p_search = '' or u.email ilike '%' || replace(replace(p_search, '%', '\%'), '_', '\_') || '%'
  )
  select b.*, (select count(*) from public.actions a where a.user_id = b.id) as action_count,
         count(*) over () as total_count
  from base b
  order by b.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

create or replace function public.admin_user_overview(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'banned_until', u.banned_until,
    'email_confirmed_at', u.email_confirmed_at,
    'profile', (select row_to_json(p) from public.profiles p where p.id = u.id),
    'is_admin', exists (select 1 from public.admin_users a where a.user_id = u.id),
    'counts', jsonb_build_object(
      'actions', (select count(*) from public.actions where user_id = u.id),
      'active_actions', (select count(*) from public.actions where user_id = u.id and status = 'active'),
      'goals', (select count(*) from public.goals where user_id = u.id),
      'done', (select count(*) from public.occurrences where user_id = u.id and status = 'done'),
      'missed', (select count(*) from public.occurrences where user_id = u.id and status = 'missed'),
      'skipped', (select count(*) from public.occurrences where user_id = u.id and status = 'skipped'),
      'needs_review', (select count(*) from public.occurrences where user_id = u.id and status = 'missed' and resolution is null),
      'recovery_plans', (select count(*) from public.recovery_plans where user_id = u.id),
      'push_subscriptions', (select count(*) from public.push_subscriptions where user_id = u.id)
    )
  )
  from auth.users u where u.id = p_user
$$;

-- Identifiable per-user activity (analytics:user_level only).
create or replace function public.admin_user_activity(p_user uuid, p_days integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'sessions', (select count(*) from public.app_sessions where user_id = p_user and started_at >= now() - make_interval(days => p_days)),
    'seconds', (select coalesce(sum(active_seconds), 0) from public.app_sessions where user_id = p_user and started_at >= now() - make_interval(days => p_days)),
    'days_active', (select count(distinct (started_at at time zone 'UTC')::date) from public.app_sessions where user_id = p_user and started_at >= now() - make_interval(days => p_days)),
    'platforms', (select coalesce(jsonb_agg(distinct platform), '[]'::jsonb) from public.app_sessions where user_id = p_user),
    'daily', (select coalesce(jsonb_agg(row_to_json(x) order by x.date), '[]'::jsonb) from (
        select (started_at at time zone 'UTC')::date as date, count(*) as sessions, coalesce(sum(active_seconds), 0) as seconds
        from public.app_sessions where user_id = p_user and started_at >= now() - make_interval(days => p_days)
        group by 1) x)
  )
$$;

revoke all on function public.admin_analytics(timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.admin_list_users(text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_user_overview(uuid) from public, anon, authenticated;
revoke all on function public.admin_user_activity(uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_analytics(timestamptz, timestamptz, text) to service_role;
grant execute on function public.admin_list_users(text, integer, integer) to service_role;
grant execute on function public.admin_user_overview(uuid) to service_role;
grant execute on function public.admin_user_activity(uuid, integer) to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
