import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const BUCKET = "encouragement-media";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

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

// ---- Parent posts an encouraging message ----
const sendSchema = z
  .object({
    childId: uuid,
    message: z.string().trim().max(1000).optional().nullable(),
    photoPath: z.string().max(500).optional().nullable(),
    voicePath: z.string().max(500).optional().nullable(),
  })
  .refine(
    (v) => (v.message && v.message.length > 0) || v.photoPath || v.voicePath,
    { message: "Add a message, photo, or voice note." },
  );

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

    const { data: target } = await supabase
      .from("profiles")
      .select("id, family_id")
      .eq("id", data.childId)
      .maybeSingle();
    if (!target || target.family_id !== prof.family_id) {
      throw new Error("That child isn't in your family.");
    }

    // Media paths must live under this family's folder
    const familyPrefix = `${prof.family_id}/`;
    for (const p of [data.photoPath, data.voicePath]) {
      if (p && !p.startsWith(familyPrefix)) {
        throw new Error("Invalid media path.");
      }
    }

    const { error } = await supabase.from("encouragement_messages").insert({
      family_id: prof.family_id,
      child_id: data.childId,
      author_id: userId,
      message: data.message?.trim() || null,
      photo_path: data.photoPath || null,
      voice_path: data.voicePath || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- List messages on a wall ----
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
      .select("id, message, child_id, author_id, created_at, photo_path, voice_path")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Sign any media URLs so the client can render them
    const paths: string[] = [];
    (rows ?? []).forEach((r: any) => {
      if (r.photo_path) paths.push(r.photo_path);
      if (r.voice_path) paths.push(r.voice_path);
    });

    const signed: Record<string, string> = {};
    if (paths.length) {
      const { data: signedList } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL);
      (signedList ?? []).forEach((s: any) => {
        if (s.path && s.signedUrl) signed[s.path] = s.signedUrl;
      });
    }

    return (rows ?? []).map((r: any) => ({
      ...r,
      photo_url: r.photo_path ? signed[r.photo_path] ?? null : null,
      voice_url: r.voice_path ? signed[r.voice_path] ?? null : null,
    }));
  });

// ---- Parent removes a message (and any media) ----
export const deleteEncouragement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("encouragement_messages")
      .select("photo_path, voice_path")
      .eq("id", data.id)
      .maybeSingle();

    const toRemove = [row?.photo_path, row?.voice_path].filter(Boolean) as string[];
    if (toRemove.length) {
      await supabase.storage.from(BUCKET).remove(toRemove);
    }

    const { error } = await supabase
      .from("encouragement_messages")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
