import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

async function ensureParentFamily(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.family_id) throw new Error("No family");
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "parent")
    .maybeSingle();
  if (!role) throw new Error("Parents only");
  return profile.family_id as string;
}

export const listHomeManagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const familyId = await ensureParentFamily(supabase, userId);
    const [visionsRes, tasksRes] = await Promise.all([
      supabase.from("home_management_visions").select("*").eq("family_id", familyId),
      supabase
        .from("home_management_tasks")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true }),
    ]);
    if (visionsRes.error) throw visionsRes.error;
    if (tasksRes.error) throw tasksRes.error;
    return { visions: visionsRes.data ?? [], tasks: tasksRes.data ?? [] };
  });

export const saveVision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ sectionKey: z.string().min(1).max(200), content: z.string().max(5000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const familyId = await ensureParentFamily(supabase, userId);
    const { error } = await supabase
      .from("home_management_visions")
      .upsert(
        { family_id: familyId, section_key: data.sectionKey, content: data.content },
        { onConflict: "family_id,section_key" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const addHomeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        sectionKey: z.string().min(1).max(200),
        title: z.string().trim().min(1).max(300),
        timeframe: z.string().trim().max(100).optional().nullable(),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .nullable(),
        assigneeId: uuid.optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const familyId = await ensureParentFamily(supabase, userId);

    // If assigned to someone other than the acting parent, mirror into the
    // main tasks pipeline so the assignee sees it in their normal task views.
    let linkedTaskId: string | null = null;
    if (data.assigneeId && data.assigneeId !== userId) {
      // Verify the assignee is in this family
      const { data: member } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.assigneeId)
        .eq("family_id", familyId)
        .maybeSingle();
      if (!member) throw new Error("Assignee is not in your family.");

      const today = new Date().toISOString().slice(0, 10);
      const { data: task, error: tErr } = await supabase
        .from("tasks")
        .insert({
          family_id: familyId,
          assignee_id: data.assigneeId,
          created_by: userId,
          title: data.title,
          description: data.timeframe ?? null,
          recurrence_type: "once",
          recurrence_config: {} as never,
          start_date: data.dueDate ?? today,
          end_date: data.dueDate ?? today,
          reward_amount: 0,
        })
        .select("id")
        .single();
      if (tErr) throw tErr;
      linkedTaskId = task.id;
    }

    const { data: row, error } = await supabase
      .from("home_management_tasks")
      .insert({
        family_id: familyId,
        section_key: data.sectionKey,
        title: data.title,
        timeframe: data.timeframe ?? null,
        due_date: data.dueDate ?? null,
        assignee_id: data.assigneeId ?? null,
        linked_task_id: linkedTaskId,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });


export const toggleHomeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid, completed: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await ensureParentFamily(supabase, userId);
    const { error } = await supabase
      .from("home_management_tasks")
      .update({ completed: data.completed, completed_at: data.completed ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteHomeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await ensureParentFamily(supabase, userId);
    const { data: existing } = await supabase
      .from("home_management_tasks")
      .select("linked_task_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase.from("home_management_tasks").delete().eq("id", data.id);
    if (error) throw error;
    if (existing?.linked_task_id) {
      await supabase.from("tasks").delete().eq("id", existing.linked_task_id);
    }
    return { ok: true };
  });

