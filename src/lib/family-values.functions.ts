import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function myFamily(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("family_id").eq("id", userId).maybeSingle();
  if (!data?.family_id) throw new Error("No family");
  return data.family_id as string;
}

export const getFamilyValues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const familyId = await myFamily(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("family_values")
      .select("content, updated_at")
      .eq("family_id", familyId)
      .maybeSingle();
    if (error) throw error;
    return { content: data?.content ?? "", updatedAt: data?.updated_at ?? null };
  });

export const saveFamilyValues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ content: z.string().max(100000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const familyId = await myFamily(supabase, userId);
    const { data: isParent } = await supabase.rpc("has_role", { _user_id: userId, _role: "parent" });
    if (!isParent) throw new Error("Parents only");
    const { error } = await supabase
      .from("family_values")
      .upsert({ family_id: familyId, content: data.content, updated_by: userId }, { onConflict: "family_id" });
    if (error) throw error;
    return { ok: true };
  });
