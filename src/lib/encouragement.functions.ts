import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

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

// ---- Parent posts an encouraging message to a child's wall ----
const sendSchema = z.object({
  childId: uuid,
  message: z.string().trim().min(1).max(500),
});

export const sendEncouragement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const prof = await getProfile(supabase, userId);
    if (!prof?.family_id) throw new Error("No family.");
    if (!(await isParent(supabase, userId))) {
      throw new Error("Only parents can send encouragement.");
    }

    // Target must be a child in the same family.
    const { data: target } = await supabase
      .from("profiles")
      .select("id, family_id")
      .eq("id", data.childId)
      .maybeSingle();
    if (!target || target.family_id !== prof.family_id) {
      throw new Error("That child isn't in your family.");
    }

    const { error } = await supabase.from("encouragement_messages").insert({
      family_id: prof.family_id,
      child_id: data.childId,
      author_id: userId,
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- List messages on a wall ----
// Kids see their own wall; parents pass a childId to see a specific child's wall.
export const listEncouragement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ childId: uuid.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const prof = await getProfile(supabase, userId);
    if (!prof?.family_id) return [];
    const parent = await isParent(supabase, userId);
    const childId = parent ? data.childId : userId;
    if (!childId) return [];

    const { data: rows, error } = await supabase
      .from("encouragement_messages")
      .select("id, message, child_id, author_id, created_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---- Parent removes a message ----
export const deleteEncouragement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("encouragement_messages")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
