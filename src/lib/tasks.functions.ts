import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { expandOccurrences, type RecurrenceConfig, type RecurrenceType } from "./recurrence";

const recurrenceConfigSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  intervalDays: z.number().int().min(1).max(365).optional(),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  assigneeId: z.string().uuid(),
  recurrenceType: z.enum(["once", "daily", "weekly", "monthly", "custom"]),
  recurrenceConfig: recurrenceConfigSchema.default({}),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  rewardAmount: z.number().min(0).max(1_000_000).default(0),
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createTaskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.family_id) throw new Error("No family.");

    const { error } = await supabase.from("tasks").insert({
      family_id: prof.family_id,
      assignee_id: data.assigneeId,
      created_by: userId,
      title: data.title,
      description: data.description ?? null,
      recurrence_type: data.recurrenceType,
      recurrence_config: data.recurrenceConfig as never,
      start_date: data.startDate,
      end_date: data.endDate ?? null,
      reward_amount: data.rewardAmount ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select("id, title, description, assignee_id, recurrence_type, recurrence_config, start_date, end_date, active, reward_amount, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const windowSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assigneeId: z.string().uuid().optional(),
});

export const listInstances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => windowSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.family_id) return [];

    // 1. Fetch active tasks in family (optionally for assignee)
    let q = supabase
      .from("tasks")
      .select("id, family_id, assignee_id, title, recurrence_type, recurrence_config, start_date, end_date, active")
      .eq("active", true);
    if (data.assigneeId) q = q.eq("assignee_id", data.assigneeId);
    const { data: tasks, error: tErr } = await q;
    if (tErr) throw new Error(tErr.message);

    // 2. Compute expected occurrences
    type Row = {
      task_id: string;
      family_id: string;
      assignee_id: string;
      due_date: string;
    };
    const expected: Row[] = [];
    for (const t of tasks ?? []) {
      const dates = expandOccurrences(
        t.recurrence_type as RecurrenceType,
        (t.recurrence_config as RecurrenceConfig) ?? {},
        t.start_date,
        t.end_date,
        data.from,
        data.to,
      );
      for (const d of dates) {
        expected.push({
          task_id: t.id,
          family_id: t.family_id,
          assignee_id: t.assignee_id,
          due_date: d,
        });
      }
    }

    // 3. Upsert missing (ignore conflicts)
    if (expected.length > 0) {
      await supabase
        .from("task_instances")
        .upsert(expected, { onConflict: "task_id,due_date", ignoreDuplicates: true });
    }

    // 4. Read instances in window
    let iq = supabase
      .from("task_instances")
      .select(
        "id, task_id, assignee_id, due_date, status, completed_at, verified_at, reject_note, reward_override, tasks(title, description, recurrence_type, recurrence_config, reward_amount)",
      )
      .gte("due_date", data.from)
      .lte("due_date", data.to)
      .order("due_date", { ascending: true });
    if (data.assigneeId) iq = iq.eq("assignee_id", data.assigneeId);
    const { data: instances, error: iErr } = await iq;
    if (iErr) throw new Error(iErr.message);

    return instances ?? [];
  });

export const submitInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("task_instances")
      .update({ status: "submitted", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("assignee_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const verifySchema = z.object({
  id: z.string().uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(300).optional().nullable(),
  rewardOverride: z.number().min(0).max(1_000_000).optional().nullable(),
});

export const verifyInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => verifySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const update: Record<string, unknown> = {
      status: data.approve ? "approved" : "rejected",
      verified_at: new Date().toISOString(),
      verifier_id: userId,
      reject_note: data.approve ? null : data.note ?? null,
    };
    if (!data.approve && data.rewardOverride !== undefined && data.rewardOverride !== null) {
      update.reward_override = data.rewardOverride;
    }
    const { error } = await supabase
      .from("task_instances")
      .update(update as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
