# RAVS — Research Attendance & Verification System

> A digital replacement for paper lab registers: students log research work, faculty verify it, and attendance is derived from what's actually been approved.

---

## 📌 Overview

RAVS lets students check in/out of research **events** with a live timer, upload files with a comment for faculty to review, and see their approved hours. Faculty create and supervise events, approve or reject submitted work sessions and file uploads (each with their own remarks), and manage who's enrolled. Admins can additionally change anyone's role.

### What it actually does today

- ⏱️ **Check-in / check-out timer** — one active session per student at a time, with automatic duration tracking.
- 📎 **File submissions with review** — members upload a file + comment for an event; the event's faculty approves or rejects it with their own comment.
- 👥 **Per-event members sidebar** — a Discord-style roster scoped to each event's actual participants (not a platform-wide user list). Admins get an inline role selector per person.
- ✅ **Session approvals** — faculty review submitted work sessions and approve/reject with remarks.
- 📊 **Attendance history** — a log of completed sessions and their approval status, per user.
- 🔐 **Role-based access** — three roles (`student`, `faculty`, `admin`), enforced with PostgreSQL Row-Level Security, not just UI checks.
- 🎓 **Self-service faculty** — anyone can become faculty for an event by creating it; there's no signup role picker or manual approval step for that.

---

## 🛠️ Tech Stack

- **Framework:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/), running as a plain client-side SPA
- **Routing:** [TanStack Router](https://tanstack.com/router) (file-based, client-side only — see note below)
- **Data fetching:** [TanStack Query](https://tanstack.com/query)
- **UI:** [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) primitives (shadcn/ui style), [Lucide](https://lucide.dev/) icons, [Sonner](https://sonner.emilkowal.ski/) for toasts
- **Backend:** [Supabase](https://supabase.com/) — PostgreSQL, Auth, and Storage. No custom server; the client talks to Supabase directly, secured by RLS.

> **Note on unused scaffolding:** `package.json` and `src/` still contain `@tanstack/react-start`, `src/server.ts`, and `src/start.ts` from an earlier SSR-based setup. The app does **not** run in SSR mode — `vite.config.ts` only wires up the plain `@tanstack/react-router` plugin, and `netlify.toml` builds and deploys it as a static SPA (`vite build` → `dist/`, with an SPA fallback redirect). Don't add `shellComponent`/SSR-only APIs to `__root.tsx` — that combination previously caused a real production bug (a duplicated `<html>` document nested inside `index.html`'s `<div id="root">`, which froze the page on the first re-render). Similarly, `react-hook-form`, `zod`, and `recharts` are installed (part of the full shadcn/ui component set) but none of the app's actual forms or dashboard stats use them — forms use plain `useState`, and there are no charts.

---

## 👥 Roles & Permissions

Everyone signs up as `student` (no role picker at signup, no Google/social login). The only way to become `faculty` is to create an event — the app grants it automatically at that point. Only an existing `admin` can promote/demote anyone via the per-event members sidebar; there's no self-service path to `admin`.

| Action | Student | Faculty | Admin |
| :--- | :---: | :---: | :---: |
| Check in / check out of an event | ✅ (if enrolled) | — | — |
| Upload a file + comment to an event | ✅ (if enrolled) | — | — |
| Review submissions & sessions (approve/reject + comment) | ❌ | ✅ (events they created) | ✅ (any event) |
| Create an event (becomes its faculty) | ✅ → becomes faculty | ✅ | ✅ |
| Remove a member from an event's roster | ❌ | ✅ (events they created) | ✅ (any event) |
| Change anyone's global role | ❌ | ❌ | ✅ |
| View own attendance history | ✅ | ✅ | ✅ |

"Events they created" means the RLS policies check `projects.faculty_id = auth.uid()` — a faculty account only has review/management authority over events it owns, not every event on the platform.

---

## 📂 Directory Structure

```text
research-connect-main/
├── docs/
│   ├── PROJECT_ARCHITECTURE.md        # Frontend structure & data flow
│   └── SUPABASE_GUIDE.md              # Schema, RLS, functions, migrations
├── src/
│   ├── components/
│   │   ├── app-shell.tsx              # Header, nav, sign-out
│   │   ├── session-widget.tsx         # Check-in/out timer widget
│   │   └── ui/                        # shadcn/ui (Radix + Tailwind) primitives
│   ├── integrations/supabase/
│   │   ├── client.ts                  # Browser Supabase client (anon key)
│   │   └── types.ts                   # Hand-maintained DB types (see note below)
│   ├── lib/
│   │   ├── auth.tsx                   # AuthProvider/useAuth — session, role, profile
│   │   ├── people.ts                  # attachStudentNames() — joins names/roles onto rows
│   │   └── session-utils.ts           # Duration/hour formatting, status colors
│   ├── routes/
│   │   ├── __root.tsx                 # Root layout — QueryClientProvider, AuthProvider
│   │   ├── index.tsx                  # Public landing page
│   │   ├── auth.tsx                   # Sign in / create account
│   │   └── _authenticated/            # Everything behind the auth guard
│   │       ├── route.tsx              # Redirects to /auth if not signed in; renders AppShell
│   │       ├── dashboard.tsx          # Role-specific home (student vs faculty view)
│   │       ├── projects.index.tsx     # Events list + "Create event" dialog
│   │       ├── projects.$id.tsx       # Event detail: stats, submissions, sessions, members sidebar
│   │       ├── approvals.tsx          # Faculty queue for pending work sessions
│   │       ├── attendance.tsx         # Completed session history
│   │       └── profile.tsx            # Name/college editing
│   └── main.tsx                       # SPA entry point (mounts into index.html's #root)
├── supabase/
│   ├── migrations/                    # Applied in order via `supabase db push`
│   └── config.toml                    # Local `supabase start` config only — not used in production
├── index.html                         # Static HTML shell the SPA mounts into
└── vite.config.ts
```

> `src/integrations/supabase/types.ts` is normally auto-generated by `supabase gen types typescript`, but is currently maintained by hand to match the migrations. Regenerate it (or update it manually) whenever you add a migration that changes a table or function signature.

---

## ⚡ Getting Started

### 1. Prerequisites

- Node.js 18+
- A Supabase project (free tier is fine)

### 2. Install

```bash
git clone <this-repo-url>
cd research-connect-main
npm install
```

### 3. Environment variables

Create `.env` in the project root:

```env
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-public-key"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
```

Only `VITE_`-prefixed variables are read by the app (Vite inlines them into the client bundle, so they're public — never put a service role key or any real secret in `.env` with a `VITE_` prefix).

### 4. Run

```bash
npm run dev
```

Open `http://localhost:5173`.

### 5. Apply the database schema

Point the Supabase CLI at your project and push the migrations:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

See [docs/SUPABASE_GUIDE.md](docs/SUPABASE_GUIDE.md) for the full schema, RLS policies, and required Auth dashboard settings (email confirmation is off by default in this app — see below).

### 6. Email confirmation

Signup runs with **email confirmation disabled** (Supabase Dashboard → Authentication → Sign In / Providers → Email → "Confirm email" off), so account creation doesn't depend on any outbound email delivery or SMTP setup. If you want confirmation emails, you'll need to configure a custom SMTP provider yourself and verify a real domain with it — a `resend.dev`-style sandbox sender can only deliver to your own inbox, not to real users.

---

## 📖 Further Reading

- [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md) — frontend structure, auth/role flow, and the data flow between the app and Supabase.
- [docs/SUPABASE_GUIDE.md](docs/SUPABASE_GUIDE.md) — full schema, RLS policies, security-definer functions, storage bucket setup, and the CLI migration workflow.

---

## 📄 License

[MIT](LICENSE)
