import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  audioBase64: z.string().min(1),
  mime: z.string().min(1).max(100),
});

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "mp4";
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("flac")) return "flac";
  return "webm";
}

export const transcribeVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Parents only
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "parent")
      .maybeSingle();
    if (!role) throw new Error("Only parents can transcribe voice notes.");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    // Decode base64 to bytes
    const binary = Buffer.from(data.audioBase64, "base64");
    if (binary.byteLength === 0) throw new Error("Empty audio.");
    if (binary.byteLength > 20 * 1024 * 1024) throw new Error("Audio too large.");

    const ext = extFromMime(data.mime);
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(binary)], { type: data.mime }),
      `recording.${ext}`,
    );
    form.append("model", "openai/gpt-4o-mini-transcribe");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Too many requests — please try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings.");
      throw new Error(`Transcription failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });
