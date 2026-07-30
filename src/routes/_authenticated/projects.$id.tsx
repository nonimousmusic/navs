import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Share2, UserMinus, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { attachStudentNames } from "@/lib/people";
import { formatMinutes, hoursFrom, statusTone } from "@/lib/session-utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "Event — RAVS" },
      {
        name: "description",
        content: "Event details, roster, roles and logged research sessions.",
      },
      { property: "og:title", content: "Event — RAVS" },
      { property: "og:description", content: "Roster and verified session history." },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isFaculty = role === "admin" || role === "faculty";
  const isAdmin = role === "admin";

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

  const toggleJoin = useMutation({
    mutationFn: async (isJoined: boolean) => {
      if (isJoined) {
        const { error } = await supabase
          .from("project_members")
          .delete()
          .eq("project_id", id)
          .eq("student_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_members")
          .insert({ project_id: id, student_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Roster updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({
      userId,
      newRole,
    }: {
      userId: string;
      newRole: "student" | "faculty" | "admin";
    }) => {
      const { error } = await supabase.rpc("admin_update_user_role", {
        target_user_id: userId,
        new_role: newRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member role updated");
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", id)
        .eq("student_id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed from event");
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading project…</p>;
  if (!data?.project) return <p className="text-sm text-muted-foreground">Event not found.</p>;

  const { project, members, sessions } = data;
  const isJoined = members.some((m) => m.student_id === user?.id);
  const approvedMins = sessions
    .filter((s) => s.status === "approved")
    .reduce((a, s) => a + (s.duration_minutes ?? 0), 0);

  const shareEvent = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Event link copied to clipboard!");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{project.title}</h1>
          {project.description && (
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={shareEvent}>
            <Share2 className="mr-1.5 size-4" /> Share event
          </Button>
          <Button
            size="sm"
            variant={isJoined ? "ghost" : "default"}
            onClick={() => toggleJoin.mutate(isJoined)}
            disabled={toggleJoin.isPending}
          >
            {isJoined ? "Leave event" : "Join event"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved hours</p>
          <p className="mt-2 font-display text-3xl">{hoursFrom(approvedMins)}h</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">People enrolled</p>
          <p className="mt-2 font-display text-3xl">{members.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Sessions logged</p>
          <p className="mt-2 font-display text-3xl">{sessions.length}</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Enrolled People &amp; Roles</h2>
          {isAdmin && (
            <span className="flex items-center text-xs text-muted-foreground">
              <ShieldAlert className="mr-1 size-3.5" /> Admin controls active
            </span>
          )}
        </div>

        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            No people enrolled yet. Share the event link above to invite participants!
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {members.map((m) => (
                <div
                  key={m.student_id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {m.student_name} {m.student_id === user?.id && "(You)"}
                    </p>
                    {m.student_college_id && (
                      <p className="text-xs text-muted-foreground">{m.student_college_id}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {isAdmin ? (
                      <Select
                        value={m.student_role}
                        onValueChange={(newRole) =>
                          updateRole.mutate({
                            userId: m.student_id,
                            newRole: newRole as "student" | "faculty" | "admin",
                          })
                        }
                        disabled={updateRole.isPending}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs capitalize">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="faculty">Faculty</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
                        {m.student_role}
                      </span>
                    )}

                    {isFaculty && m.student_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:bg-destructive/10"
                        title="Remove member"
                        onClick={() => removeMember.mutate(m.student_id)}
                        disabled={removeMember.isPending}
                      >
                        <UserMinus className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
