# Complete System Architecture & Developer Guide: Research Connect (RAVS)

This document provides a complete technical walkthrough of the **Research Attendance & Verification System (RAVS)**, detailing the frontend routing, state management, database schema, authentication flow, and deployment workflow.

---

## 1. Core Architecture & Stack

```mermaid
graph TD
    User([User / Browser]) -->|React 19 + TanStack Router| Client[Vite Single Page Application]
    Client -->|Supabase JS Client| Auth[Supabase Auth Engine]
    Client -->|PostgreSQL Queries via RLS| DB[(Supabase PostgreSQL Database)]
    Client -->|File Storage| Storage[Supabase Storage Buckets]
    Auth -->|Custom SMTP| Resend[Resend Email Server]
```

- **Frontend:** Built with **React 19**, **Vite**, **TanStack Router**, **TanStack Query**, and **Tailwind CSS v4**.
- **Backend Platform:** Serverless architecture backed entirely by **Supabase** (PostgreSQL, Supabase Auth, Storage).
- **Security Layer:** Enforced at the database level via PostgreSQL **Row-Level Security (RLS)** policies.

---

## 2. Directory Structure & Key Files

```text
src/
├── components/          # UI components (Radix primitives, Modals, Forms, Tables)
├── hooks/               # Custom React hooks (useAuth, useSessionTimer, useProjects)
├── lib/                 # Utility functions & Supabase JS client initializer
│   ├── supabase.ts      # Supabase client singleton instance
│   └── utils.ts         # Tailwind class merger (cn) & date formatters
├── routes/              # TanStack File-Based Route Hierarchy
│   ├── __root.tsx       # Root layout provider & global toast containers
│   ├── auth.tsx         # Sign in, sign up, and password reset form
│   └── _authenticated/  # Authenticated route guard layout
│       ├── dashboard.tsx        # Dynamic dashboard based on active role
│       ├── projects.index.tsx   # Project listing & filter views
│       ├── projects.$id.tsx     # Project detail, timer widget & submission form
│       ├── approvals.tsx        # Faculty approval queue with review dialogs
│       ├── attendance.tsx       # Attendance summary, charts & report generation
│       └── profile.tsx          # Account settings & password manager
```

---

## 3. Authentication & User Role Model

User authentication is managed via Supabase Auth. Profiles and permissions are linked to `auth.users(id)`:

```sql
CREATE TYPE user_role AS ENUM ('student', 'faculty', 'head_admin');

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    college_id TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Role Workflows

1. **Student:**
   - Starts active research timer on [projects.$id.tsx](file:///c:/Users/admin/Desktop/work/ravs/research-connect-main/src/routes/_authenticated/projects.$id.tsx).
   - On check-out, submits summary notes and attached proof files.
   - Views approved hours and attendance breakdown on [attendance.tsx](file:///c:/Users/admin/Desktop/work/ravs/research-connect-main/src/routes/_authenticated/attendance.tsx).

2. **Faculty:**
   - Inspects pending queue on [approvals.tsx](file:///c:/Users/admin/Desktop/work/ravs/research-connect-main/src/routes/_authenticated/approvals.tsx).
   - Reviews student work notes and attached documents.
   - Approves session (calculating verified research hours) or rejects with remarks.

3. **Head Admin:**
   - Manages departments, laboratories, users, and project assignments.
   - Updates user roles via secure `admin_update_user_role` database functions.

---

## 4. Work Session & Verification Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant UI as Frontend App
    participant DB as Supabase DB
    actor Faculty

    Student->>UI: Click "Check In" (Start Session)
    UI->>DB: INSERT into work_sessions (status: 'active', start_time: NOW())
    Note over Student, UI: Timer runs in browser
    Student->>UI: Click "Check Out" & Submit Work Proof
    UI->>DB: UPDATE work_sessions (status: 'completed', end_time: NOW(), summary, files)
    UI->>DB: INSERT into approvals (status: 'pending')
    Faculty->>UI: View Approvals Queue
    Faculty->>DB: UPDATE approvals (status: 'approved', remarks, verified_hours)
    DB->>DB: Trigger updates attendance_records
```

---

## 5. Documentation Summary

The repository contains documentation covering all aspects of the application:

| Document                                                                                                                                     | Description                                                            |
| :------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| 📘 **[README.md](file:///c:/Users/admin/Desktop/work/ravs/research-connect-main/README.md)**                                                 | Main project overview, features, quick start & role permissions.       |
| 🛡️ **[docs/SUPABASE_GUIDE.md](file:///c:/Users/admin/Desktop/work/ravs/research-connect-main/docs/SUPABASE_GUIDE.md)**                       | Full database schema, RLS policies, migrations & CLI tools.            |
| ✉️ **[docs/SUPABASE_SMTP_RATE_LIMITS.md](file:///c:/Users/admin/Desktop/work/ravs/research-connect-main/docs/SUPABASE_SMTP_RATE_LIMITS.md)** | Resend SMTP setup & Supabase authentication rate limits guide.         |
| 🏗️ **[docs/PROJECT_ARCHITECTURE.md](file:///c:/Users/admin/Desktop/work/ravs/research-connect-main/docs/PROJECT_ARCHITECTURE.md)**           | Complete developer architecture, sequence diagrams & folder structure. |
