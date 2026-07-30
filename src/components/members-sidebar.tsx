import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Member = {
  id: string;
  full_name: string;
  college_id: string | null;
  role: "student" | "faculty" | "admin";
};

function initialsFor(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function MembersSidebar() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);

  const { data: members, isLoading } = useQuery({
    queryKey: ["all-members"],
    enabled: open,
    queryFn: async (): Promise<Member[]> => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, college_id"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;

      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      return (profiles ?? [])
        .map((p) => ({
          id: p.id,
          full_name: p.full_name || "Unnamed member",
          college_id: p.college_id,
          role: (roleMap.get(p.id) as Member["role"]) || "student",
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: Member["role"] }) => {
      const { error } = await supabase.rpc("admin_update_user_role", {
        target_user_id: userId,
        new_role: newRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["all-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byRole = {
    admin: (members ?? []).filter((m) => m.role === "admin"),
    faculty: (members ?? []).filter((m) => m.role === "faculty"),
    student: (members ?? []).filter((m) => m.role === "student"),
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Members">
          <Users className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Members</SheetTitle>
        </SheetHeader>

        {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading members…</p>}

        <div className="mt-4 space-y-6">
          {(["admin", "faculty", "student"] as const).map((groupRole) =>
            byRole[groupRole].length === 0 ? null : (
              <div key={groupRole} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {groupRole === "admin"
                    ? "Admins"
                    : groupRole === "faculty"
                      ? "Faculty"
                      : "Students"}{" "}
                  — {byRole[groupRole].length}
                </p>
                <div className="space-y-1">
                  {byRole[groupRole].map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-secondary text-xs">
                          {initialsFor(m.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.full_name} {m.id === user?.id && "(You)"}
                        </p>
                        {m.college_id && (
                          <p className="truncate text-xs text-muted-foreground">{m.college_id}</p>
                        )}
                      </div>

                      {isAdmin ? (
                        <Select
                          value={m.role}
                          onValueChange={(newRole) =>
                            updateRole.mutate({ userId: m.id, newRole: newRole as Member["role"] })
                          }
                          disabled={updateRole.isPending}
                        >
                          <SelectTrigger className="h-7 w-24 shrink-0 text-xs capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="faculty">Faculty</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">
                          {m.role}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
