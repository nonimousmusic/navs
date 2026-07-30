import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { attachStudentNames } from "@/lib/people";
import { formatMinutes, hoursFrom, statusTone } from "@/lib/session-utils";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "Event — RAVS" },
      { name: "description", content: "Event objectives, roster and logged research sessions." },
      { property: "og:title", content: "Event — RAVS" },
      { property: "og:description", content: "Roster and verified session history." },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data: project, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;

      const [{ data: members }, { data: sessions }] = await Promise.all([
        supabase.from("project_members").select("student_id").eq("project_id", id),
        supabase
          .from("work_sessions")
          .select("*")
          .eq("project_id", id)
          .order("check_in_at", { ascending: false }),
      ]);

      return {
        project,
        members: await attachStudentNames(members ?? []),
        sessions: await attachStudentNames(sessions ?? []),
      };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading project…</p>;
  if (!data?.project) return <p className="text-sm text-muted-foreground">Event not found.</p>;

  const { project, members, sessions } = data;
  const approvedMins = sessions
    .filter((s) => s.status === "approved")
    .reduce((a, s) => a + (s.duration_minutes ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">{project.title}</h1>
        {project.description && (
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved hours</p>
          <p className="mt-2 font-display text-3xl">{hoursFrom(approvedMins)}h</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Students</p>
          <p className="mt-2 font-display text-3xl">{members.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Sessions logged</p>
          <p className="mt-2 font-display text-3xl">{sessions.length}</p>
        </div>
      </div>

      <section>
        <h2 className="text-xl">Roster</h2>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No students enrolled yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {members.map((m) => (
              <li
                key={m.student_id}
                className="rounded-full border border-border bg-card px-3 py-1 text-sm"
              >
                {m.student_name}
                {m.student_college_id ? (
                  <span className="text-muted-foreground"> · {m.student_college_id}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl">Session history</h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No sessions logged yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{s.student_name}</span>
                  <span
                    className={`ml-auto rounded-full border px-2.5 py-0.5 text-xs capitalize ${statusTone(s.status)}`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(s.check_in_at).toLocaleString()} · {formatMinutes(s.duration_minutes)}
                </p>
                {s.summary && <p className="mt-2 text-sm">{s.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
