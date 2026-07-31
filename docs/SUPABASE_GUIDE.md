# Supabase Guide — RAVS

The database schema, security model, and Supabase-specific setup for RAVS. This reflects what's actually defined in `supabase/migrations/` — if the two ever disagree, the migrations are the source of truth.

---

## 1. Environment Variables

```env
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-public-key"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
```

Only `VITE_`-prefixed variables are used by the app. They're bundled into the client and are public by design (the anon key is meant to be exposed — RLS is what actually protects the data). Never add a `SUPABASE_SERVICE_ROLE_KEY` or any real secret with a `VITE_` prefix; the service role key bypasses RLS entirely.

---

## 2. Schema

Six tables, all in `public`:

| Table | Purpose |
| :--- | :--- |
| `profiles` | One row per user (`id` = `auth.users.id`): `full_name`, `college_id`, `department`, `phone`, `avatar_url`. |
| `user_roles` | `(user_id, role)` pairs, `role` is `student` \| `faculty` \| `admin`. Each user should have exactly **one** row — see §4 for why this is enforced by convention, not a schema constraint. |
| `projects` | Called "Events" in the UI. Actively used: `title`, `description`, `faculty_id` (owner), `status`. Columns `objectives`, `lab_name`, and `required_hours` still exist from the original schema but nothing in the UI reads or writes them anymore — the "Create event" form only collects title/description. |
| `project_members` | Join table: which students/users are enrolled in which event. |
| `work_sessions` | Check-in/check-out timer records: `check_in_at`, `check_out_at`, `duration_minutes`, `summary`, `status` (`active`/`pending`/`approved`/`rejected`), `remarks`, `reviewed_by`. One `active` row per student at a time (enforced by a partial unique index). |
| `submissions` | File uploads: `file_path`, `file_name`, `comment` (uploader's), `status` (`pending`/`approved`/`rejected`), `faculty_comment`, `reviewed_by`. |

No `departments`, `laboratories`, `approvals`, `attendance_records`, or `audit_logs` tables exist — attendance is derived on the fly from `work_sessions` at query time, not stored separately.

---

## 3. Role Model

Three roles: `student`, `faculty`, `admin` (`public.app_role` enum — note it's `admin`, not `head_admin`).

- **Everyone signs up as `student`.** There's no role picker at signup and no Google/social login.
- **Becoming `faculty` is self-service**, but only through one path: creating an event calls `self_grant_faculty()`, a `SECURITY DEFINER` function that can only ever set the *calling* user's own role to `faculty` — never anyone else's, and never `admin`.
- **Becoming `admin` has no self-service path at all.** Only an existing admin can promote someone, via `admin_update_user_role()`, called from the per-event members sidebar.
- A user should hold exactly one role row at a time. `self_grant_faculty()` and `admin_update_user_role()` both `DELETE` any existing row before inserting the new one — this matters because `lib/auth.tsx` reads the role with `.maybeSingle()`, which silently returns `null` (and the app falls back to treating the user as a student) if a user somehow ends up with more than one row. This actually happened once in production — an earlier version of `self_grant_faculty()` only `INSERT`ed, leaving `student` and `faculty` rows side by side — see `20260731050000_fix_self_grant_faculty_duplicates.sql` for the fix and the one-time cleanup query.

### Security-definer functions

| Function | Who can call it | What it does |
| :--- | :--- | :--- |
| `has_role(user_id, role)` | Any authenticated user (used internally by RLS policies) | Read-only check. |
| `handle_new_user()` | Trigger on `auth.users` insert | Creates the `profiles` row and a `student` `user_roles` row on signup. Wrapped in `EXCEPTION WHEN OTHERS THEN RETURN NEW` so a profile/role insert failure never blocks the actual signup. |
| `self_grant_faculty()` | Any authenticated user, for themselves only | Replaces the caller's role with `faculty`. |
| `ensure_own_student_role()` | Any authenticated user, for themselves only | Inserts a `student` row for the caller if one is missing (self-heal path in `lib/auth.tsx`; `ON CONFLICT DO NOTHING`, no-op if a role already exists). |
| `admin_update_user_role(target_user_id, new_role)` | Admins only (checked inside the function) | Replaces *any* user's role with any value, including `admin`. |

Two RPCs existed briefly and were deliberately removed rather than fixed: `self_grant_role(role)` let any user pick `faculty` **or `admin`** for themselves, and an earlier version of `admin_update_user_role` let any `faculty` account (not just admins) grant `admin` to anyone. Both were caught in review and were never actually applied to production. If you ever see either pattern reintroduced, that's a privilege-escalation bug, not a feature.

### RLS patterns worth knowing

- `profiles` and `user_roles` are readable by every authenticated user (`USING (true)`) — the app shows names/roles across rosters, so this is intentional, not an oversight.
- "Faculty can review/manage X" almost always means **the event's specific owning faculty** (`projects.faculty_id = auth.uid()`), not any faculty account. The UI sometimes shows a faculty-gated control (e.g. "remove member") to any faculty account, but the underlying policy will reject it unless they actually own that event — the RLS is the real boundary, not the UI check.
- `work_sessions` and `submissions` inserts both require the inserting student to actually be a member of the event (`EXISTS (... project_members ...)`), not just authenticated.

---

## 4. Storage

One private bucket: `submissions`.

- **Upload path convention:** `{uploader_user_id}/{project_id}/{timestamp}-{filename}`. The storage RLS policy enforces that the first path segment matches `auth.uid()`, so you can only upload into your own folder.
- **Read:** any authenticated user can generate a signed URL to read any file in the bucket. This matches the same "campus community is the trust boundary" model as `profiles`/`user_roles` — it's not per-event scoped at the storage layer (scoping happens at the `submissions` table's RLS instead, which does restrict who can *see the row* pointing at a file).
- The frontend uses `supabase.storage.from("submissions").createSignedUrl(path, 60)` to generate short-lived download links on click, rather than public URLs.

---

## 5. Migrations & CLI Workflow

```bash
npx supabase login                                    # opens a browser to authenticate
npx supabase link --project-ref your-project-ref
npx supabase db push                                  # applies any migration not yet recorded as applied
```

Useful commands while working on this:

```bash
npx supabase migration list --linked          # local vs. remote migration status
npx supabase db push --dry-run                # preview without applying
npx supabase db query --linked "<sql>"        # run read-only SQL directly against the linked project
```

If migrations were ever applied by hand (e.g. pasted into the Supabase Dashboard's SQL Editor) instead of via the CLI, `supabase db push` won't know about it and will try to replay everything from scratch — which fails the moment it hits a `CREATE TABLE` for something that already exists. Fix the tracking table without re-running anything:

```bash
npx supabase migration repair --linked --status applied <version> <version> ...
```

---

## 6. Auth Configuration

- **Email confirmation is off** (Dashboard → Authentication → Sign In / Providers → Email). Signup returns a session immediately with no email round-trip.
- **No custom SMTP is configured.** A previous attempt used Resend's sandbox sender (`onboarding@resend.dev`), which can only deliver to the Resend account owner's own inbox — every real user's confirmation email was rejected with a 403 from Resend. If you turn email confirmation back on, you'll need a verified custom domain (Resend, Postmark, SES, etc. all require this — sandbox/test senders never work for arbitrary recipients) and the Auth "sending emails" rate limit raised from its low default.
- **`supabase/config.toml`** only configures the *local* `supabase start` stack (Docker-based local dev) — it has no effect on the hosted project. The hosted project's Auth settings live only in the Dashboard (or are reachable via the Management API with a personal access token), not in this repo.

---

## 7. Local Development (optional)

Only needed if you want a fully local Postgres/Auth/Storage stack instead of pointing at your hosted Supabase project:

```bash
npx supabase start   # requires Docker Desktop running
```

Local Studio UI: `http://localhost:54323`.
