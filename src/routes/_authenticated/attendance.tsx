import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { attachStudentNames } from "@/lib/people";
import { formatMinutes, statusTone } from "@/lib/session-utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — RAVS" },
      { name: "description", content: "Verified research hours and attendance recommendations." },
      { property: "og:title", content: "Attendance — RAVS" },
      { property: "og:description", content: "Hours approved against event requirements." },
    ],
  }),
  component: Attendance,
});

function Attendance() {
  const { user, role } = useAuth();
  const isFaculty = role === "faculty" || role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", user?.id, role],
    enabled: !!user && !!role,
    queryFn: async () => {
      let pq = supabase.from("projects").select("id, title");
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Completed work sessions and their faculty approval status.
        </p>
      </div>

      <section>
        <h2 className="text-xl">All sessions</h2>
        {sessions.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
            No completed sessions yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">
                    {isFaculty
                      ? s.student_name
                      : projects.find((p) => p.id === s.project_id)?.title}
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
        )}
      </section>
    </div>
  );
}
