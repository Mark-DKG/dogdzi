# DOGDZI — Get it done

Personal execution and accountability app by **9DEVs**. People plan actions, follow through, account for what was missed, and recover.

**Create → Schedule → Remind → Execute → Review → Recover**

- Responsive PWA (installable, offline shell, notifications), built so it can be packaged for Android/iOS later
- Works immediately in **guest mode** (data stays in the browser, with clear limits). Registered accounts sync through Supabase.
- History is **append-only**: missed and skipped actions are never silently removed, not even by staff.
- Separate **admin console** with role-based access, MFA, aggregate analytics and an audit log.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Vercel + Vercel Web Analytics · Web Push.

---

## 1. Quick start (local)

```bash
npm install
cp .env.example .env.local      # leave Supabase empty to try guest-only mode
npm run dev                     # http://localhost:3000
npm test                        # 38 tests: action flows, guest conversion, authorization, admin permissions, schema rules
npm run typecheck && npm run lint && npm run build
```

Requires Node 20.9+.

Without Supabase variables the app runs in **guest-only mode**. Sign-up, sync and the admin console show a "not configured" notice instead of failing.

## 2. Supabase setup

1. Create a project at supabase.com.
2. **SQL Editor** → run `supabase/migrations/0001_init.sql`, then `0003_server_only_account_deletion.sql` (or `supabase db push` with the CLI). It creates every table, the RLS policies, the append-only triggers, the admin RBAC seed and the analytics functions.
3. **Authentication → URL configuration**
   - Site URL: your production URL (e.g. `https://dogdzi.app`)
   - Redirect URLs: `https://dogdzi.app/auth/callback`, `http://localhost:3000/auth/callback`
4. **Authentication → Multi-factor**: enable **TOTP** (required for the admin console).
5. **Authentication → Providers → Email**: keep "Confirm email" on (recommended). Set a minimum password length of 8 and enable leaked-password protection if your plan has it.
6. Copy **Project URL**, **anon key** and **service_role key** into your env (see §4).

### Create the first Super Admin

Admins are normal Supabase Auth users who are listed in `admin_users`. Use a **dedicated staff email**, not a personal DOGDZI account. There is no shared admin login.

1. Sign up at `/signup` with the staff email and confirm it.
2. In the SQL Editor:

```sql
insert into public.admin_users (user_id, role)
select id, 'super_admin' from auth.users where email = 'founder@yourcompany.com';
```

3. Go to `/admin/signin`. On first sign-in you'll scan a QR code with an authenticator app. After that, add other admins from **Admin team** in the console.

### Roles

| Role | Default permissions |
|---|---|
| Super Admin | everything, including `admins:manage`, `settings:manage`, `content:write`, `analytics:user_level`, `audit:read` |
| Support Admin | `accounts:read`, `accounts:write`, `content:read` (a reason is required and logged), `analytics:read` |
| Read-only Admin | `accounts:read`, `analytics:read` |

Super admins can grant `content:read`, `content:write`, `analytics:user_level` or `audit:read` to individual admins. Read-only admins can never receive write permissions. The last super admin can't be removed, and nobody can change their own role.

Every console sign-in, account view, content view (with reason), user-level analytics view and change is written to `audit_log`, which is append-only. Writes fail closed: if the audit entry can't be written, the change doesn't happen. `content:write` can only **append** a support note to a user's history. Existing entries can't be edited or deleted.

## 3. Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel (framework: Next.js).
2. Add the environment variables from §4 to Production (and Preview if you use it).
3. **Project → Analytics → Enable Web Analytics.** The `<Analytics />` component is already in the root layout. Page views appear after the next deployment. Custom events (`signup_completed`, `guest_converted`, `onboarding_completed`, `action_completed`) need a plan that supports custom events.
4. Deploy. Then update Supabase's Site URL and Redirect URLs to the production domain.

### Reminder delivery (push while the app is closed)

`GET /api/cron/reminders` sends due push reminders. It's protected by `Authorization: Bearer $CRON_SECRET` and should run every 5–10 minutes. Pick one:

- **Vercel Pro**: add to `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron/reminders", "schedule": "*/5 * * * *" }] }
  ```
  Not included by default, because Hobby plans reject cron jobs that run more than once a day.
- **Supabase (any plan)**: enable `pg_cron` and `pg_net`, then:
  ```sql
  select cron.schedule('dogdzi-reminders', '*/5 * * * *', $$
    select net.http_get(url := 'https://YOUR-DOMAIN/api/cron/reminders',
                        headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'));
  $$);
  ```

While the app is open, guests and accounts also get in-app reminders without any server setup.

## 4. Environment variables

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | yes | Canonical URL for metadata and auth emails |
| `NEXT_PUBLIC_SUPABASE_URL` | public | for accounts | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | for accounts | Anon key (safe in the browser; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | for admin, telemetry, cron | Bypasses RLS. Only used in server code after permission checks. Never prefix with `NEXT_PUBLIC_`. |
| `ADMIN_REQUIRE_MFA` | server | recommended | `true` (default) requires authenticator-app verification (AAL2) for the console |
| `NEXT_PUBLIC_ANALYTICS_CONSENT_MODE` | public | no | `opt-in` (default): nothing is measured until the visitor allows it. `opt-out`: only where lawful. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | public / **server** / server | for push | Generate with `npm run vapid:generate` |
| `CRON_SECRET` | server | for push | Protects the reminder endpoint |
| `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` | server | optional | Shows Vercel page-view totals in the admin dashboard |

## 5. What's where

```
src/lib/domain/       Pure business logic (actions, occurrences, recurrence, missed detection,
                      accountability, recovery, reminders, guest limits, insights). Fully unit-tested.
src/lib/store/        Storage: LocalRepo (guest, browser), SupabaseRepo (accounts), guest → account migration
src/lib/admin/        RBAC matrix, access decision (testable), server guard + audit writer
src/lib/analytics/    Consent, privacy filtering, session heartbeat rules, Vercel API client
src/lib/push/         Web Push client, server sender, reminder dispatch selection
src/components/       UI kit (buttons, fields, dialogs, skeletons, empty/error states), app and admin components
src/app/              Routes: landing, auth, onboarding, /app/*, /admin/*, /api/*
supabase/migrations/  Schema, RLS, triggers, admin functions
public/               Brand assets, icons, service worker, offline page
tests/                node:test suites (run with tsx)
```

### Data model

`profiles`, `user_preferences`, `notification_preferences`, `categories`, `goals`, `milestones`, `actions` (the commitment), `occurrences` (each time it's due; status lives here), `action_history` (append-only events), `accountability_responses` (append-only reason + outcome), `recovery_plans`, `push_subscriptions`, `reminders` (delivery log), `app_sessions`, `analytics_events`, `admin_roles`, `admin_permissions`, `role_permissions`, `admin_users`, `admin_permission_grants`, `audit_log`, `system_settings`.

Composite foreign keys `(id, user_id)` make it impossible to link your rows to someone else's. RLS restricts every user table to `auth.uid()`. Users have **no delete policy** on content: actions are cancelled, never deleted. A trigger blocks turning a missed or skipped occurrence back into "pending". Account deletion (`/api/account/delete`, which re-checks the password and then calls `purge_user_data` with the service role) is the only path that removes history, and it removes the whole account.

### Accountability rules

- Pending occurrences become **missed** 2 hours after a timed action (or at the end of the day for untimed ones) and wait in **Review**.
- A review records a reason (neutral wording, no blame) and an outcome: *done now* (kept as "done later"), *reschedule* (the original stays missed and links to the new one), *recovery plan* (steps plus an optional restart date), *let it go*, or *cancel*.
- Skipping an open action goes through the same review.
- Routines backfill at most 7 days after a long absence. Several missed routine days can be let go at once, with one reason.

### Guest limits

10 active actions, 1 goal with 3 milestones, 7 days of visible history, no routines, recovery plans, insights, sync or push. In-app reminders still work. Guest data is never described as backed up. When a guest signs up (or signs in) on the same device, their data moves into the account automatically: ids are preserved, matching categories are merged, and a copy is kept on the device.

### Sessions and time spent

With consent only, the client starts a session, sends a heartbeat every 60 seconds while the tab is visible and someone interacted within 5 minutes, and ends it after 5 idle minutes or when the tab closes. The server ignores gaps longer than 6 minutes and caps sessions at 24 hours. Figures are labelled as **estimates**. Vercel Analytics is used for page views and selected events only. Titles, notes and reasons are never sent to any analytics provider.

## 6. Status: verified, mocked, or needing configuration

**Verified in the build sandbox**
- 38 unit tests pass (`npm test`): action lifecycle, missed detection across time zones, review outcomes, recurrence, reminder styles, quiet hours, daily caps, push selection, guest storage and conversion, guest limits, admin access decisions, role and grant guard rails, SQL/TypeScript permission parity, RLS and append-only presence in the migration, service-key isolation, analytics privacy filtering and heartbeat rules.
- Every screen except the admin pages was rendered in headless Chromium at mobile and desktop sizes, in light and dark mode, and the guest flow was driven end to end (create, complete, upgrade prompts, review and reschedule, milestone limit) with no runtime errors. The admin analytics view was rendered with sample data.

**Not run in the sandbox (package registry blocked), so run these first**
- `npm install`, `npm run typecheck`, `npm run lint`, `npm run build`. The code was type-checked against stand-in declarations for Next.js, React, Supabase and Vercel, not the real packages, so expect possibly a few small type fixes on the first build.
- The SQL migration hasn't been executed against Postgres yet. Run it on a fresh Supabase project and check that it completes.

**Needs external configuration**
- Supabase project, SMTP and email templates, MFA (TOTP)
- VAPID keys and a reminder scheduler (Web Push). On iOS, push only works after "Add to Home Screen".
- Vercel Web Analytics toggle. Custom events need a supporting plan.
- The privacy notice is a template. Have it reviewed for your jurisdiction (e.g. Ghana's Data Protection Act, 2012, and GDPR if you serve EU users).

### Verifying RLS on a real project

In the SQL Editor, impersonate a user and confirm isolation:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user-a-uuid>"}';
select count(*) from actions;                     -- only user A's rows
delete from action_history;                       -- 0 rows (no delete policy)
update action_history set data = '{}';            -- denied
select * from audit_log;                          -- permission denied
```

## 7. Mobile packaging later

The app is a standards-based PWA (manifest, maskable icons, service worker, standalone display). To ship to stores, wrap it with Trusted Web Activity / Bubblewrap (Android) or Capacitor (iOS and Android). The domain logic in `src/lib/domain` has no browser or Next.js dependencies and can be reused in a native client.

## Brand

The logo files are used unaltered from the supplied artwork: the full lockup (transparent, cream) appears on forest-green surfaces, and the full-background version and DZD monogram are used for icons, favicon and navigation. Tokens: forest `#254032`, cream `#F8E7C3`, sampled from the files. Tagline: **GET IT DONE · By 9DEVs**.
