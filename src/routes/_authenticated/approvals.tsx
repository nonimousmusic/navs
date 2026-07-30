import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { attachStudentNames } from "@/lib/people";
import { formatMinutes } from "@/lib/session-utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approval queue — RAVS" },
      { name: "description", content: "Review and verify student research sessions." },
      { property: "og:title", content: "Approval queue — RAVS" },
      { property: "og:description", content: "Approve or reject submitted work sessions." },
    ],
  }),
  component: Approvals,
});

function Approvals() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["approval-queue", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: projects, error: pErr } = await supabase
        .from("projects")
        .select("id, title")
        .eq("faculty_id", user!.id);
      if (pErr) throw pErr;
      const ids = (projects ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("work_sessions")
        .select("*, projects(title)")
        .in("project_id", ids)
        .eq("status", "pending")
        .order("submitted_at", { ascending: true });
      if (error) throw error;
      return attachStudentNames(data ?? []);
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const note = (remarks[id] ?? "").trim();
      if (!approved && !note) throw new Error("Add a remark explaining the rejection");
      const { error } = await supabase
        .from("work_sessions")
        .update({
          status: approved ? "approved" : "rejected",
          remarks: note || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approved ? "Session approved" : "Session rejected");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role === "student") {
    return (
      <div>
        <h1 className="text-3xl">Approval queue</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only faculty can review sessions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Approval queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify submitted sessions. Approved hours count toward attendance.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading queue…</p>}

      {sessions && sessions.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          Nothing pending. All submissions are reviewed.
        </p>
      )}

      <ul className="space-y-4">
        {(sessions ?? []).map((s) => (
          <li key={s.id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg">{s.student_name}</h2>
              {s.student_college_id && (
                <span className="text-xs text-muted-foreground">{s.student_college_id}</span>
              )}
              <span className="ml-auto text-sm text-muted-foreground">{s.projects?.title}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(s.check_in_at).toLocaleString()} →{" "}
              {s.check_out_at ? new Date(s.check_out_at).toLocaleTimeString() : "—"} ·{" "}
              {formatMinutes(s.duration_minutes)}
            </p>
            {s.notes && <p className="mt-3 text-sm text-muted-foreground">Plan: {s.notes}</p>}
            <p className="mt-2 whitespace-pre-line text-sm">{s.summary}</p>

            <div className="mt-4 space-y-3">
              <Textarea
                rows={2}
                placeholder="Remarks (required to reject)"
                value={remarks[s.id] ?? ""}
                onChange={(e) => setRemarks({ ...remarks, [s.id]: e.target.value })}
                maxLength={500}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => decide.mutate({ id: s.id, approved: true })}
                  disabled={decide.isPending}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decide.mutate({ id: s.id, approved: false })}
                  disabled={decide.isPending}
                >
                  Reject
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
