import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { attachStudentNames } from "@/lib/people";
import { SessionWidget } from "@/components/session-widget";
import { formatMinutes, hoursFrom, startOfWeek, statusTone } from "@/lib/session-utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — RAVS" },
      { name: "description", content: "Your research sessions, hours and pending approvals." },
      { property: "og:title", content: "Dashboard — RAVS" },
      { property: "og:description", content: "Research attendance at a glance." },
    ],
  }),
  component: Dashboard,
});

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Dashboard() {
  const { role, profile } = useAuth();
  const firstName = (profile?.full_name || "").split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">{firstName ? `Hello, ${firstName}` : "Dashboard"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {role === "faculty" || role === "admin"
            ? "Verify research sessions from your students."
            : "Log verified research work and build your attendance."}
        </p>
      </div>
      {role === "faculty" || role === "admin" ? <FacultyView /> : <StudentView />}
    </div>
  );
}

function StudentView() {
  const { user } = useAuth();

  const { data: sessions } = useQuery({
    queryKey: ["student-sessions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_sessions")
        .select("*, projects(title)")
        .eq("student_id", user!.id)
        .order("check_in_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const done = (sessions ?? []).filter((s) => s.status !== "active");
  const approved = done.filter((s) => s.status === "approved");
  const pending = done.filter((s) => s.status === "pending");
  const weekStart = startOfWeek();
  const weekMins = approved
    .filter((s) => new Date(s.check_in_at) >= weekStart)
    .reduce((a, s) => a + (s.duration_minutes ?? 0), 0);
  const approvedMins = approved.reduce((a, s) => a + (s.duration_minutes ?? 0), 0);
  const submittedMins = done.reduce((a, s) => a + (s.duration_minutes ?? 0), 0);
  const pct = submittedMins ? Math.round((approvedMins / submittedMins) * 100) : 0;

  return (
    <div className="space-y-8">
      <SessionWidget />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Approved hours" value={`${hoursFrom(approvedMins)}h`} hint="Counts for attendance" />
        <Stat label="This week" value={`${hoursFrom(weekMins)}h`} hint="Approved only" />
        <Stat label="Pending review" value={String(pending.length)} hint="Awaiting faculty" />
        <Stat label="Verification rate" value={`${pct}%`} hint="Approved of submitted" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">Recent sessions</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/attendance">View attendance</Link>
          </Button>
        </div>
        <SessionList sessions={done.slice(0, 6)} empty="No completed sessions yet." />
      </div>
    </div>
  );
}

function FacultyView() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["faculty-overview", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: projects, error: pErr } = await supabase
        .from("projects")
        .select("id, title, status")
        .eq("faculty_id", user!.id);
      if (pErr) throw pErr;
      const ids = (projects ?? []).map((p) => p.id);
      if (ids.length === 0) return { projects: projects ?? [], sessions: [], students: 0 };

      const [{ data: sessions, error: sErr }, { data: members, error: mErr }] = await Promise.all([
        supabase
          .from("work_sessions")
          .select("*, projects(title)")
          .in("project_id", ids)
          .order("submitted_at", { ascending: false }),
        supabase.from("project_members").select("student_id").in("project_id", ids),
      ]);
      if (sErr) throw sErr;
      if (mErr) throw mErr;
      return {
        projects: projects ?? [],
        sessions: await attachStudentNames(sessions ?? []),
        students: new Set((members ?? []).map((m) => m.student_id)).size,
      };
    },
  });

  const sessions = data?.sessions ?? [];
  const pending = sessions.filter((s) => s.status === "pending");
  const approved = sessions.filter((s) => s.status === "approved");
  const reviewed = sessions.filter((s) => s.status !== "active" && s.status !== "pending");
  const rate = reviewed.length ? Math.round((approved.length / reviewed.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending reviews" value={String(pending.length)} hint="Needs your decision" />
        <Stat
          label="Active projects"
          value={String((data?.projects ?? []).filter((p) => p.status === "active").length)}
        />
        <Stat label="Assigned students" value={String(data?.students ?? 0)} />
        <Stat label="Approval rate" value={`${rate}%`} hint="Of reviewed sessions" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">Waiting on you</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/approvals">Open queue</Link>
          </Button>
        </div>
        <SessionList
          sessions={pending.slice(0, 6)}
          showStudent
          empty="Nothing pending. All caught up."
        />
      </div>
    </div>
  );
}

type Row = {
  id: string;
  status: string;
  check_in_at: string;
  duration_minutes: number | null;
  summary: string | null;
  projects?: { title: string } | null;
  student_name?: string;
};

export function SessionList({
  sessions,
  empty,
  showStudent,
}: {
  sessions: Row[];
  empty: string;
  showStudent?: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {sessions.map((s) => (
        <li key={s.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">{s.projects?.title ?? "Project"}</span>
            {showStudent && s.student_name && (
              <span className="text-sm text-muted-foreground">{s.student_name}</span>
            )}
            <span
              className={`ml-auto rounded-full border px-2.5 py-0.5 text-xs capitalize ${statusTone(s.status)}`}
            >
              {s.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(s.check_in_at).toLocaleString()} · {formatMinutes(s.duration_minutes)}
          </p>
          {s.summary && <p className="mt-2 line-clamp-2 text-sm">{s.summary}</p>}
        </li>
      ))}
    </ul>
  );
}
