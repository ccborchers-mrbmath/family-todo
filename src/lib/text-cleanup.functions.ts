import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  text: z.string().min(1).max(5000),
});

export const cleanupText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Parents only (matches transcribeVoice restriction)
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "parent")
      .maybeSingle();
    if (!role) throw new Error("Only parents can use text cleanup.");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    const trimmed = data.text.trim();
    if (!trimmed) return { text: "" };

    const system = `You are a light-touch text tidier. Your ONLY job is:
1. Fix spelling and grammar.
2. Add natural punctuation and capitalisation where missing.

Strict rules — do NOT break these:
- Preserve ALL meaning and ALL content words. Do not summarise, shorten, expand, rephrase, reorder, or restructure sentences.
- Do not add any new information, greetings, sign-offs, emojis, or commentary.
- Do not translate. Keep the original language.
- Keep the writer's voice, tone, and wording. Only change what's needed for correct spelling/grammar.
- Do not invent or change any proper names.
- If the text is already clean, return it unchanged.
- Output ONLY the cleaned text. No quotes, no preamble, no explanation.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: trimmed },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Too many requests — please try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings.");
      const body = await res.text().catch(() => "");
      throw new Error(`Cleanup failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const cleaned = json.choices?.[0]?.message?.content?.trim();
    return { text: cleaned || trimmed };
  });
