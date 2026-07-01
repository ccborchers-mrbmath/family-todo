import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  audioBase64: z.string().min(1),
  mime: z.string().min(1).max(100),
  childName: z.string().max(200).optional(),
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

async function cleanupTranscript(
  raw: string,
  childName: string | undefined,
  apiKey: string,
): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const nameLine = childName
    ? `The message is addressed to a child whose name is exactly "${childName}". Any word or phrase in the transcript that sounds like this name (phonetic near-matches, misheard spellings, or partial matches) MUST be replaced with "${childName}" spelled exactly as given. Do not invent or infer any other proper names.`
    : `Do not invent or change any proper names.`;

  const system = `You are a light-touch transcript tidier. Your ONLY job is:
1. Fix spelling and grammar.
2. Remove filler words and disfluencies (um, uh, er, ah, like, you know, sort of, kind of, I mean, hmm, mhm) and false starts/repeated words.
3. Add natural punctuation and capitalisation.
4. ${nameLine}

Strict rules — do NOT break these:
- Preserve ALL meaning and ALL content words. Do not summarise, shorten, expand, rephrase, reorder, or restructure sentences.
- Do not add any new information, greetings, sign-offs, emojis, or commentary that wasn't in the transcript.
- Do not translate. Keep the original language.
- Keep the speaker's voice, tone, and wording. Only change what's needed for correct spelling/grammar and to strip fillers.
- If the transcript is already clean, return it unchanged.
- Output ONLY the cleaned transcript text. No quotes, no preamble, no explanation.`;

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
    // Fall back to raw transcript rather than failing the whole flow
    return trimmed;
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const cleaned = json.choices?.[0]?.message?.content?.trim();
  return cleaned || trimmed;
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
    const raw = (json.text ?? "").trim();

    let cleaned = raw;
    try {
      cleaned = await cleanupTranscript(raw, data.childName, apiKey);
    } catch {
      cleaned = raw;
    }

    return { text: cleaned, raw };
  });
