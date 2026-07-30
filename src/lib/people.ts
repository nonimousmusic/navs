import { supabase } from "@/integrations/supabase/client";

type WithStudent = { student_id: string } & Record<string, unknown>;

export async function attachStudentNames<T extends WithStudent>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.student_id))];
  if (ids.length === 0)
    return rows.map((r) => ({ ...r, student_name: "", student_college_id: null as string | null }));
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, college_id")
    .in("id", ids);
  if (error) throw error;
  const map = new Map((data ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    student_name: map.get(r.student_id)?.full_name || "Unnamed student",
    student_college_id: map.get(r.student_id)?.college_id ?? null,
  }));
}
