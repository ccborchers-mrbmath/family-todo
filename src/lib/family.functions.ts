import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, family_id, display_name, email, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rErr) throw new Error(rErr.message);

    let family = null as null | { id: string; name: string };
    if (profile?.family_id) {
      const { data: fam } = await supabase
        .from("families")
        .select("id, name")
        .eq("id", profile.family_id)
        .maybeSingle();
      family = fam ?? null;
    }

    const role = roles?.[0]?.role ?? null;
    return { profile, role, family };
  });

const createFamilySchema = z.object({ name: z.string().trim().min(1).max(60) });

export const createFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createFamilySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Block if already in a family
    const { data: existing } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    if (existing?.family_id) throw new Error("You already belong to a family.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: fam, error: fErr } = await supabaseAdmin
      .from("families")
      .insert({ name: data.name, created_by: userId })
      .select("id, name")
      .single();
    if (fErr) throw new Error(fErr.message);

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ family_id: fam.id })
      .eq("id", userId);
    if (upErr) throw new Error(upErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "parent" }, { onConflict: "user_id,role" });
    if (roleErr) throw new Error(roleErr.message);

    return { family: fam };
  });

const inviteSchema = z.object({
  email: z.string().trim().email().max(255).transform((s) => s.toLowerCase()),
  displayName: z.string().trim().min(1).max(60),
});

export const inviteKid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.family_id) throw new Error("Create a family first.");

    const { error } = await supabase.from("family_invites").insert({
      family_id: prof.family_id,
      email: data.email,
      display_name: data.displayName,
      role: "kid",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFamilyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.family_id) return { members: [], invites: [] };

    const [{ data: members }, { data: invites }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .eq("family_id", prof.family_id),
      supabase
        .from("family_invites")
        .select("id, email, display_name, role, claimed_at, created_at")
        .eq("family_id", prof.family_id)
        .order("created_at", { ascending: false }),
    ]);

    // also fetch roles for members
    const ids = (members ?? []).map((m) => m.id);
    const roleMap: Record<string, string> = {};
    if (ids.length) {
      const { data: rs } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      (rs ?? []).forEach((r) => (roleMap[r.user_id] = r.role));
    }

    return {
      members: (members ?? []).map((m) => ({ ...m, role: roleMap[m.id] ?? "kid" })),
      invites: invites ?? [],
    };
  });

const idSchema = z.object({ id: z.string().uuid() });

export const deleteInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("family_invites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const resetKid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isParent } = await supabase.rpc("has_role", { _user_id: userId, _role: "parent" });
    if (!isParent) throw new Error("Only parents can reset a kid.");

    const { data: me } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.family_id) throw new Error("No family.");

    const { data: target } = await supabase
      .from("profiles")
      .select("id, family_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!target || target.family_id !== me.family_id) {
      throw new Error("That member isn't in your family.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("recurring_pocket_money").delete().eq("child_id", data.id);
    await supabaseAdmin.from("account_transactions").delete().eq("child_id", data.id);
    await supabaseAdmin.from("task_instances").delete().eq("assignee_id", data.id);
    await supabaseAdmin.from("tasks").delete().eq("assignee_id", data.id);

    return { ok: true };
  });


export const removeKid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id === userId) throw new Error("You can't remove yourself.");

    // Caller must be a parent
    const { data: isParent } = await supabase.rpc("has_role", { _user_id: userId, _role: "parent" });
    if (!isParent) throw new Error("Only parents can remove members.");

    // Caller's family
    const { data: me } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.family_id) throw new Error("No family.");

    // Target must be in the same family
    const { data: target } = await supabase
      .from("profiles")
      .select("id, family_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!target || target.family_id !== me.family_id) {
      throw new Error("That member isn't in your family.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Wipe data tied to the kid in this family
    await supabaseAdmin.from("recurring_pocket_money").delete().eq("child_id", data.id);
    await supabaseAdmin.from("account_transactions").delete().eq("child_id", data.id);
    await supabaseAdmin.from("task_instances").delete().eq("assignee_id", data.id);
    await supabaseAdmin.from("tasks").delete().eq("assignee_id", data.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);

    // Free any invite for this email so they can be re-invited cleanly
    await supabaseAdmin
      .from("family_invites")
      .delete()
      .eq("family_id", me.family_id)
      .eq("claimed_by", data.id);

    // Unlink from family
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ family_id: null })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });
