import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

const BUCKET = "encouragement-media";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

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

// ---- Parent posts an encouraging message (text and/or photo and/or voice note) ----
const sendSchema = z
  .object({
    childId: uuid,
    message: z.string().trim().max(1000).optional().nullable(),
    imagePath: z.string().max(300).optional().nullable(),
    audioPath: z.string().max(300).optional().nullable(),
  })
  .refine((d) => !!(d.message && d.message.length > 0) || !!d.imagePath || !!d.audioPath, {
    message: "Add a message, photo, or voice note.",
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

    // Media must live under this family's storage folder.
    const prefix = `${prof.family_id}/`;
    if (data.imagePath && !data.imagePath.startsWith(prefix)) {
      throw new Error("Invalid image path.");
    }
    if (data.audioPath && !data.audioPath.startsWith(prefix)) {
      throw new Error("Invalid audio path.");
    }

    const { error } = await supabase.from("encouragement_messages").insert({
      family_id: prof.family_id,
      child_id: data.childId,
      author_id: userId,
      message: data.message && data.message.length > 0 ? data.message : null,
      image_path: data.imagePath ?? null,
      audio_path: data.audioPath ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- List messages on a wall, with signed URLs for any media ----
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
      .select("id, message, child_id, author_id, image_path, audio_path, created_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    // Sign any media URLs using the service-role client (bucket is private).
    const needsSigning = list.some((r: any) => r.image_path || r.audio_path);
    let sign: (path: string | null) => Promise<string | null> = async () => null;
    if (needsSigning) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      sign = async (path) => {
        if (!path) return null;
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL);
        return signed?.signedUrl ?? null;
      };
    }

    return Promise.all(
      list.map(async (r: any) => ({
        id: r.id,
        message: r.message,
        child_id: r.child_id,
        author_id: r.author_id,
        created_at: r.created_at,
        imageUrl: await sign(r.image_path),
        audioUrl: await sign(r.audio_path),
      })),
    );
  });

// ---- Parent removes a message (and its media) ----
export const deleteEncouragement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: row } = await supabase
      .from("encouragement_messages")
      .select("image_path, audio_path")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabase
      .from("encouragement_messages")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const paths = [row?.image_path, row?.audio_path].filter(Boolean) as string[];
    if (paths.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from(BUCKET).remove(paths);
    }
    return { ok: true };
  });
