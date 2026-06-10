import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ---- Helpers ----
async function getProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

async function isParent(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "parent")
    .maybeSingle();
  return !!data;
}

// ---- Materialize due recurring pocket money into transactions ----
function nextDueDates(
  recurrence: "weekly" | "monthly",
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  startDate: string,
  endDate: string | null,
  lastRunOn: string | null,
  today: string,
): string[] {
  const out: string[] = [];
  const start = new Date((lastRunOn ?? startDate) + "T00:00:00Z");
  if (lastRunOn) start.setUTCDate(start.getUTCDate() + 1);
  const beginBound = new Date(startDate + "T00:00:00Z");
  if (start < beginBound) start.setTime(beginBound.getTime());
  const end = new Date(today + "T00:00:00Z");
  const stop = endDate ? new Date(endDate + "T00:00:00Z") : null;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (stop && d > stop) break;
    if (recurrence === "weekly" && dayOfWeek !== null && d.getUTCDay() === dayOfWeek) {
      out.push(d.toISOString().slice(0, 10));
    } else if (recurrence === "monthly" && dayOfMonth !== null) {
      // emit on min(dayOfMonth, lastDayOfThisMonth)
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const target = Math.min(dayOfMonth, lastDay);
      if (d.getUTCDate() === target) out.push(d.toISOString().slice(0, 10));
    }
  }
  return out;
}

async function materializeRecurring(supabase: any, familyId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rules } = await supabase
    .from("recurring_pocket_money")
    .select("*")
    .eq("family_id", familyId)
    .eq("active", true);

  for (const r of rules ?? []) {
    const dates = nextDueDates(
      r.recurrence,
      r.day_of_week,
      r.day_of_month,
      r.start_date,
      r.end_date,
      r.last_run_on,
      today,
    );
    if (dates.length === 0) continue;
    const rows = dates.map((d) => ({
      family_id: familyId,
      child_id: r.child_id,
      type: "income" as const,
      amount: r.amount,
      note: r.note ?? "Pocket money",
      source: "recurring" as const,
      status: "approved" as const,
      occurred_on: d,
      recurring_id: r.id,
      created_by: r.created_by,
      reviewed_at: new Date().toISOString(),
    }));
    await supabase.from("account_transactions").insert(rows);
    await supabase
      .from("recurring_pocket_money")
      .update({ last_run_on: dates[dates.length - 1] })
      .eq("id", r.id);
  }
}

// ---- List account (transactions + balance) for a child ----
export const listAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ childId: uuid.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const prof = await getProfile(supabase, userId);
    if (!prof?.family_id) return { txns: [], balance: 0, pendingExpense: 0, childId: null };
    const parent = await isParent(supabase, userId);
    const childId = parent ? data.childId : userId;
    if (!childId) return { txns: [], balance: 0, pendingExpense: 0, childId: null };

    if (parent) await materializeRecurring(supabase, prof.family_id);

    const { data: txns, error } = await supabase
      .from("account_transactions")
      .select("*")
      .eq("child_id", childId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    let balance = 0;
    let pendingExpense = 0;
    for (const t of txns ?? []) {
      const amt = Number(t.amount);
      if (t.status === "approved") balance += t.type === "income" ? amt : -amt;
      if (t.status === "pending" && t.type === "expense") pendingExpense += amt;
    }
    return { txns: txns ?? [], balance, pendingExpense, childId };
  });

// ---- Parent adds a manual transaction ----
const addTxnSchema = z.object({
  childId: uuid,
  type: z.enum(["income", "expense"]),
  amount: z.number().positive().max(1_000_000),
  note: z.string().trim().max(200).optional().nullable(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const addTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addTxnSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const prof = await getProfile(supabase, userId);
    if (!prof?.family_id) throw new Error("No family.");
    const { error } = await supabase.from("account_transactions").insert({
      family_id: prof.family_id,
      child_id: data.childId,
      type: data.type,
      amount: data.amount,
      note: data.note ?? null,
      source: "manual",
      status: "approved",
      occurred_on: data.occurredOn ?? new Date().toISOString().slice(0, 10),
      created_by: userId,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Kid creates an expense request ----
const requestSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  note: z.string().trim().min(1).max(200),
});

export const requestExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => requestSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const prof = await getProfile(supabase, userId);
    if (!prof?.family_id) throw new Error("No family.");
    const { error } = await supabase.from("account_transactions").insert({
      family_id: prof.family_id,
      child_id: userId,
      type: "expense",
      amount: data.amount,
      note: data.note,
      source: "request",
      status: "pending",
      occurred_on: new Date().toISOString().slice(0, 10),
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Parent decides on a pending expense request ----
const decideSchema = z.object({
  id: uuid,
  approve: z.boolean(),
});

export const decideExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decideSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("account_transactions")
      .update({
        status: data.approve ? "approved" : "rejected",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Delete a transaction (parent only) ----
export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("account_transactions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Recurring pocket money management ----
const upsertRecurringSchema = z.object({
  id: uuid.optional(),
  childId: uuid,
  amount: z.number().positive().max(1_000_000),
  note: z.string().trim().max(200).optional().nullable(),
  recurrence: z.enum(["weekly", "monthly"]),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  active: z.boolean().default(true),
});

export const upsertRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertRecurringSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const prof = await getProfile(supabase, userId);
    if (!prof?.family_id) throw new Error("No family.");
    const payload = {
      family_id: prof.family_id,
      child_id: data.childId,
      amount: data.amount,
      note: data.note ?? null,
      recurrence: data.recurrence,
      day_of_week: data.recurrence === "weekly" ? data.dayOfWeek ?? 1 : null,
      day_of_month: data.recurrence === "monthly" ? data.dayOfMonth ?? 1 : null,
      start_date: data.startDate,
      end_date: data.endDate ?? null,
      active: data.active,
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("recurring_pocket_money")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("recurring_pocket_money").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ childId: uuid.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const prof = await getProfile(supabase, userId);
    if (!prof?.family_id) return [];
    let q = supabase
      .from("recurring_pocket_money")
      .select("*")
      .eq("family_id", prof.family_id);
    if (data.childId) q = q.eq("child_id", data.childId);
    const { data: rows, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recurring_pocket_money")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Pending expense requests for parent ----
export const listPendingExpenseRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const prof = await getProfile(supabase, userId);
    if (!prof?.family_id) return [];
    const { data, error } = await supabase
      .from("account_transactions")
      .select("*")
      .eq("family_id", prof.family_id)
      .eq("status", "pending")
      .eq("source", "request")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
