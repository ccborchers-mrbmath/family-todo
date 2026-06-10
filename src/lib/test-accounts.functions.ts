import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function randomPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 14; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s + "!9";
}

export const createTestKids = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Verify caller is a parent with a family
    const { data: prof } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.family_id) throw new Error("Create a family first.");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!roles?.some((r) => r.role === "parent")) {
      throw new Error("Only parents can create test accounts.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const stamp = Date.now().toString(36);
    const kids = [
      { name: "Test Kid Alex", email: `testkid-alex-${stamp}@kinquest.test` },
      { name: "Test Kid Sam", email: `testkid-sam-${stamp}@kinquest.test` },
    ];

    const results: { name: string; email: string; password: string }[] = [];

    for (const k of kids) {
      const password = randomPassword();
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: k.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: k.name },
      });
      if (cErr || !created.user) throw new Error(cErr?.message ?? "Failed to create user");

      const uid = created.user.id;

      // The handle_new_user trigger created a profile with no family_id (no invite matched).
      // Attach to this parent's family and assign kid role.
      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({ family_id: prof.family_id, display_name: k.name })
        .eq("id", uid);
      if (upErr) throw new Error(upErr.message);

      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: uid, role: "kid" }, { onConflict: "user_id,role" });
      if (rErr) throw new Error(rErr.message);

      results.push({ name: k.name, email: k.email, password });
    }

    return { kids: results };
  });
