# Architecture — RAVS

How the frontend is put together and how data flows through it. For the database schema, RLS policies, and Supabase-specific setup, see [SUPABASE_GUIDE.md](SUPABASE_GUIDE.md).

---

## 1. High-level shape

```mermaid
graph TD
    Browser([Browser]) -->|React 19 + TanStack Router| SPA[Vite Single-Page App]
    SPA -->|supabase-js, anon key| Auth[Supabase Auth]
    SPA -->|PostgREST, RLS-enforced| DB[(Supabase Postgres)]
    SPA -->|signed URLs| Storage[Supabase Storage: submissions bucket]
```

There is no application server. The SPA talks to Supabase directly with the public anon key; every access rule is enforced by Postgres Row-Level Security, not by any backend code. This is a deliberate, load-bearing architectural choice — see §5 before adding a server component.

---

## 2. Routing & the auth guard

File-based routes under `src/routes/`, powered by `@tanstack/react-router`:

- `__root.tsx` — wraps everything in `QueryClientProvider` and `AuthProvider`. Renders `<Outlet />` directly; it does **not** render `<html>`/`<body>` (see §5 for why that matters).
- `index.tsx` — public landing page.
- `auth.tsx` — sign in / create account. Redirects to `/dashboard` if a session already exists.
- `_authenticated/route.tsx` — the guard. Its `beforeLoad` calls `supabase.auth.getUser()` and throws a redirect to `/auth` if there's no user; otherwise renders `AppShell` (header, nav, sign-out) around `<Outlet />`. Every route nested under `_authenticated/` inherits this guard automatically.

```mermaid
sequenceDiagram
    actor U as User
    participant R as Router
    participant G as _authenticated/route.tsx
    participant S as Supabase Auth

    U->>R: navigate to /dashboard
    R->>G: beforeLoad()
    G->>S: getUser()
    alt no session
        S-->>G: null
        G-->>R: redirect to /auth
    else session exists
        S-->>G: user
        G-->>R: render AppShell + Dashboard
    end
```

---

## 3. Role & auth flow

`lib/auth.tsx`'s `AuthProvider` loads the session once on mount and subscribes to `onAuthStateChange`. On each auth event it fetches the user's single `user_roles` row and their `profiles` row, self-healing either if missing (see [SUPABASE_GUIDE.md §3](SUPABASE_GUIDE.md#3-role-model) for the exact functions involved). `role` and `profile` are exposed via `useAuth()` and read throughout the app — there is no separate role fetch per page.

```mermaid
sequenceDiagram
    actor Student
    participant UI as Frontend
    participant DB as Supabase

    Student->>UI: Sign up
    UI->>DB: auth.signUp() (no role in metadata)
    DB->>DB: trigger: handle_new_user() inserts profiles + user_roles('student')
    Student->>UI: Create event
    UI->>DB: rpc('self_grant_faculty')
    DB->>DB: replaces caller's role with 'faculty'
    UI->>DB: insert into projects (now passes RLS: has_role('faculty'))
    Note over Student,DB: Student is now Faculty account-wide, not just for this event
```

Promoting someone to `admin` (or changing anyone's role) is a separate, admin-only path: the members sidebar on an event page calls `rpc('admin_update_user_role', { target_user_id, new_role })`, which checks `has_role(auth.uid(), 'admin')` before doing anything.

---

## 4. Core feature flows

### Check-in / check-out (work sessions)

```mermaid
sequenceDiagram
    actor Student
    participant UI
    participant DB
    actor Faculty

    Student->>UI: Check in
    UI->>DB: insert work_sessions (status: 'active')
    Note over UI: SessionWidget shows a live timer
    Student->>UI: Check out + write summary
    UI->>DB: update work_sessions (status: 'pending', duration_minutes, summary)
    Faculty->>UI: Open Approvals queue
    UI->>DB: select work_sessions where status='pending' and project.faculty_id = me
    Faculty->>UI: Approve / Reject + remarks
    UI->>DB: update work_sessions (status, remarks, reviewed_by, reviewed_at)
```

A partial unique index (`one_active_session_per_student`) guarantees a student can't have two active sessions at once — enforced in the database, not just the UI.

### File submissions

```mermaid
sequenceDiagram
    actor Member
    participant UI
    participant Storage as Supabase Storage
    participant DB
    actor Faculty

    Member->>UI: Choose file + write comment
    UI->>Storage: upload to submissions/{userId}/{projectId}/{file}
    UI->>DB: insert submissions (status: 'pending', file_path, comment)
    Faculty->>UI: Open event page
    UI->>Storage: createSignedUrl(file_path) on click, to view the file
    Faculty->>UI: Approve / Reject + comment
    UI->>DB: update submissions (status, faculty_comment, reviewed_by, reviewed_at)
```

Both flows follow the same shape on purpose: member creates a `pending` row, the event's owning faculty (or an admin) transitions it to `approved`/`rejected` with their own remark. `lib/people.ts`'s `attachStudentNames()` is the shared helper that joins `student_name` / `student_role` onto whichever rows need it (sessions, submissions, or roster members).

---

## 5. Why this is a static SPA, not SSR — and a war story

`package.json` includes `@tanstack/react-start`, and `src/server.ts` / `src/start.ts` exist, left over from an earlier SSR-oriented setup. **None of it is active.** `vite.config.ts` only registers the plain `@tanstack/router-plugin` (no `tanstackStart()` plugin), and `netlify.toml` builds with `vite build` and deploys `dist/` as a static SPA with a catch-all redirect to `index.html`. `main.tsx` mounts the app the ordinary client-only way: `createRoot(document.getElementById("root")).render(...)`.

This matters because the two models are incompatible in one specific way: TanStack Start's SSR pattern has the root route's `shellComponent` render the entire `<html><head>...<body>...</body></html>` document, because in SSR the server *owns* the document. If you add a `shellComponent` to `__root.tsx` while still deploying as a static SPA, you get a second `<html>` document rendered *inside* `index.html`'s `<div id="root">` — browsers can't nest `<html>` tags, so the browser's parser silently reparents the DOM, React's view of the tree stops matching reality, and the page hard-freezes on the very next re-render (which in practice meant: the moment a user typed a single character into the signup form). This exact bug shipped once and took a full debugging session to trace back to `shellComponent`. If you ever want real SSR, it needs the `tanstackStart()` Vite plugin, a real server entry point, and a hosting target that runs Node (not a static-file host like Netlify's SPA mode) — that's a deliberate migration, not a one-line addition to `__root.tsx`.

---

## 6. Further reading

- [README.md](../README.md) — setup, directory structure, tech stack.
- [SUPABASE_GUIDE.md](SUPABASE_GUIDE.md) — schema, RLS, security-definer functions, storage, migrations.
