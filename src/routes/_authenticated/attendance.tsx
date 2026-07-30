import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { attachStudentNames } from "@/lib/people";
import { formatMinutes, hoursFrom, statusTone } from "@/lib/session-utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — RAVS" },
      { name: "description", content: "Verified research hours and attendance recommendations." },
      { property: "og:title", content: "Attendance — RAVS" },
      { property: "og:description", content: "Hours approved against project requirements." },
    ],
  }),
  component: Attendance,
});

function recommend(pct: number) {
  if (pct >= 90) return { label: "Full attendance credit", tone: "text-success" };
  if (pct >= 70) return { label: "Partial credit — keep logging", tone: "text-warning-foreground" };
  return { label: "Below threshold — needs more verified hours", tone: "text-destructive" };
}

function Attendance() {
  const { user, role } = useAuth();
  const isFaculty = role === "faculty" || role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", user?.id, role],
    enabled: !!user && !!role,
    queryFn: async () => {
      let pq = supabase.from("projects").select("id, title, required_hours");
      if (isFaculty) pq = pq.eq("faculty_id", user!.id);
      const { data: projects, error: pErr } = await pq.order("created_at", { ascending: false });
      if (pErr) throw pErr;

      let query = supabase.from("work_sessions").select("*").neq("status", "active");
      if (!isFaculty) query = query.eq("student_id", user!.id);
      else {
        query = query.in(
          "project_id",
          (projects ?? []).map((p) => p.id),
        );
      }
      const { data: sessions, error } = await query.order("check_in_at", { ascending: false });
      if (error) throw error;

      return { projects: projects ?? [], sessions: await attachStudentNames(sessions ?? []) };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading attendance…</p>;

  const sessions = data?.sessions ?? [];
  const projects = data?.projects ?? [];

  const groups = new Map<
    string,
    { key: string; label: string; sub: string; required: number; approved: number; total: number }
  >();

  for (const s of sessions) {
    const project = projects.find((p) => p.id === s.project_id);
    const key = isFaculty ? `${s.project_id}:${s.student_id}` : s.project_id;
    const g = groups.get(key) ?? {
      key,
      label: isFaculty ? s.student_name : (project?.title ?? "Project"),
      sub: isFaculty ? (project?.title ?? "") : `${project?.required_hours ?? 60}h required`,
      required: project?.required_hours ?? 60,
      approved: 0,
      total: 0,
    };
    g.total += s.duration_minutes ?? 0;
    if (s.status === "approved") g.approved += s.duration_minutes ?? 0;
    groups.set(key, g);
  }

  const rows = [...groups.values()];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Attendance is calculated from faculty-approved hours against required project hours.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          No completed sessions yet.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((g) => {
            const pct = Math.min(
              100,
              Math.round((g.approved / 60 / Math.max(1, g.required)) * 100),
            );
            const rec = recommend(pct);
            return (
              <div key={g.key} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h2 className="text-lg">{g.label}</h2>
                  <span className="text-xs text-muted-foreground">{g.sub}</span>
                  <span className="ml-auto font-display text-2xl">{pct}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {hoursFrom(g.approved)}h approved of {g.required}h required ·{" "}
                  {hoursFrom(g.total - g.approved)}h unverified
                </p>
                <p className={`mt-2 text-sm ${rec.tone}`}>{rec.label}</p>
              </div>
            );
          })}
        </div>
      )}

      <section>
        <h2 className="text-xl">All sessions</h2>
        <ul className="mt-3 space-y-3">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">
                  {isFaculty ? s.student_name : projects.find((p) => p.id === s.project_id)?.title}
                </span>
                <span
                  className={`ml-auto rounded-full border px-2.5 py-0.5 text-xs capitalize ${statusTone(s.status)}`}
                >
                  {s.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(s.check_in_at).toLocaleString()} · {formatMinutes(s.duration_minutes)}
              </p>
              {s.remarks && (
                <p className="mt-2 text-sm text-muted-foreground">Faculty remark: {s.remarks}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
