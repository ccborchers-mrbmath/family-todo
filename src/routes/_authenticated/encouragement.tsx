import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, Sparkles, Send, Trash2, Image as ImageIcon, Mic, Square, X, Camera, Wand2, Loader2 } from "lucide-react";
import { getMe, listFamilyData } from "@/lib/family.functions";
import {
  listEncouragement,
  sendEncouragement,
  deleteEncouragement,
} from "@/lib/encouragement.functions";
import { transcribeVoice } from "@/lib/transcribe.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/encouragement")({
  head: () => ({ meta: [{ title: "Encouragement Wall · Kinquest" }] }),
  component: EncouragementPage,
});

const BUCKET = "encouragement-media";
const MAX_MESSAGE = 1000;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VOICE_BYTES = 10 * 1024 * 1024; // 10 MB

function EncouragementPage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  if (!me) return null;
  return me.role === "parent" ? <ParentWall /> : <KidWall />;
}

const NOTE_STYLES = [
  "bg-gradient-primary text-primary-foreground",
  "bg-gradient-cool text-primary-foreground",
  "bg-gradient-energy text-primary-foreground",
];

type WallMessage = {
  id: string;
  message: string | null;
  author_id: string;
  created_at: string;
  photo_url: string | null;
  voice_url: string | null;
};

function MessageCard({
  m,
  author,
  index,
  onDelete,
}: {
  m: WallMessage;
  author?: string;
  index: number;
  onDelete?: () => void;
}) {
  const style = NOTE_STYLES[index % NOTE_STYLES.length];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`relative overflow-hidden rounded-3xl p-5 shadow-pop ${style}`}
    >
      <Heart className="absolute -right-3 -top-3 h-16 w-16 rotate-12 opacity-15" />
      {m.photo_url && (
        <a
          href={m.photo_url}
          target="_blank"
          rel="noreferrer"
          className="relative mb-3 block overflow-hidden rounded-2xl"
        >
          <img
            src={m.photo_url}
            alt="Encouragement photo"
            className="max-h-80 w-full object-cover"
            loading="lazy"
          />
        </a>
      )}
      {m.message && (
        <p className="relative whitespace-pre-wrap text-base font-medium leading-relaxed">
          {m.message}
        </p>
      )}
      {m.voice_url && (
        <audio
          controls
          src={m.voice_url}
          className="relative mt-3 w-full"
          preload="metadata"
        />
      )}
      <div className="relative mt-4 flex items-center justify-between text-xs opacity-80">
        <span>{author ? `From ${author}` : "From your family"}</span>
        <span>{new Date(m.created_at).toLocaleDateString()}</span>
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete message"
          onClick={onDelete}
          className="absolute right-1.5 top-1.5 h-7 w-7 text-primary-foreground/80 hover:bg-black/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </motion.div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
        <Heart className="h-5 w-5 text-primary-foreground" />
      </span>
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Encouragement Wall</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
      <Sparkles className="mx-auto mb-3 h-8 w-8 text-accent" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function KidWall() {
  const qc = useQueryClient();
  const { data: family } = useQuery({ queryKey: ["family"], queryFn: () => listFamilyData() });
  const { data: messages = [] } = useQuery({
    queryKey: ["encouragement", "me"],
    queryFn: () => listEncouragement({ data: {} }) as Promise<WallMessage[]>,
  });

  useEffect(() => {
    const ch = supabase
      .channel("kid-encouragement")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encouragement_messages" },
        () => qc.invalidateQueries({ queryKey: ["encouragement"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const authorName = useMemo(() => {
    const map: Record<string, string> = {};
    (family?.members ?? []).forEach((m) => (map[m.id] = m.display_name));
    return map;
  }, [family]);

  return (
    <div className="space-y-8">
      <Header subtitle="Notes of encouragement from your family" />
      {messages.length === 0 ? (
        <EmptyState text="No messages yet — check back soon for some encouragement!" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {messages.map((m, i) => (
            <MessageCard
              key={m.id}
              m={m}
              author={authorName[m.author_id]}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Voice recorder hook ----------
function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const cleanup = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRef.current = mr;
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setBlob(b);
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(b);
        });
        cleanup();
      };
      mr.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    } catch (e) {
      toast.error("Microphone access denied");
    }
  };

  const stop = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const reset = () => {
    if (url) URL.revokeObjectURL(url);
    setBlob(null);
    setUrl(null);
    setElapsed(0);
  };

  useEffect(() => () => {
    cleanup();
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  return { recording, blob, url, elapsed, start, stop, reset };
}

function extFromMime(mime: string, fallback: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  return fallback;
}

function ParentWall() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const { data: family } = useQuery({ queryKey: ["family"], queryFn: () => listFamilyData() });
  const kids = useMemo(
    () => (family?.members ?? []).filter((m) => m.role === "kid"),
    [family],
  );
  const familyId = me?.family?.id;

  const [childId, setChildId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const lastTranscribedRef = useRef<Blob | null>(null);

  const runTranscription = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const buf = await blob.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const audioBase64 = btoa(binary);
      const { text: transcript } = await transcribeVoice({
        data: { audioBase64, mime: blob.type || "audio/webm" },
      });
      if (transcript) {
        setText((prev) => {
          const combined = prev.trim() ? `${prev.trim()}\n\n${transcript}` : transcript;
          return combined.slice(0, MAX_MESSAGE);
        });
        toast.success("Voice note transcribed");
      } else {
        toast.info("Couldn't hear any speech in that recording.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranscribing(false);
    }
  };

  // Auto-transcribe each new recording once
  useEffect(() => {
    if (voice.blob && voice.blob !== lastTranscribedRef.current && !voice.recording) {
      lastTranscribedRef.current = voice.blob;
      void runTranscription(voice.blob);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.blob, voice.recording]);


  useEffect(() => {
    if (!childId && kids.length > 0) setChildId(kids[0].id);
  }, [kids, childId]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const { data: messages = [] } = useQuery({
    queryKey: ["encouragement", childId],
    queryFn: () =>
      listEncouragement({ data: { childId: childId! } }) as Promise<WallMessage[]>,
    enabled: !!childId,
  });

  const resetForm = () => {
    setText("");
    setPhoto(null);
    voice.reset();
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const uploadMedia = async (
    file: Blob,
    kind: "photo" | "voice",
  ): Promise<string> => {
    if (!familyId) throw new Error("No family");
    const mime = file.type || (kind === "photo" ? "image/jpeg" : "audio/webm");
    const ext = extFromMime(mime, kind === "photo" ? "jpg" : "webm");
    const path = `${familyId}/${childId}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: mime,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return path;
  };

  const send = useMutation({
    mutationFn: async () => {
      if (!childId) throw new Error("Pick a kid first");
      setUploading(true);
      try {
        if (photo && photo.size > MAX_PHOTO_BYTES)
          throw new Error("Photo too large (max 8 MB)");
        if (voice.blob && voice.blob.size > MAX_VOICE_BYTES)
          throw new Error("Voice note too long (max 10 MB)");

        const photoPath = photo ? await uploadMedia(photo, "photo") : null;
        const voicePath = voice.blob ? await uploadMedia(voice.blob, "voice") : null;

        return sendEncouragement({
          data: {
            childId,
            message: text.trim() || null,
            photoPath,
            voicePath,
          },
        });
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      resetForm();
      toast.success("Encouragement sent! 💛");
      qc.invalidateQueries({ queryKey: ["encouragement", childId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteEncouragement({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["encouragement", childId] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const selectedKid = kids.find((k) => k.id === childId);
  const hasContent = text.trim().length > 0 || !!photo || !!voice.blob;

  return (
    <div className="space-y-8">
      <Header subtitle="Send a message, photo, or voice note to your kids" />

      {kids.length === 0 ? (
        <EmptyState text="No kids linked yet. Invite them from the Family page." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {kids.map((k) => (
              <button
                key={k.id}
                onClick={() => setChildId(k.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  k.id === childId
                    ? "bg-gradient-primary text-primary-foreground shadow-pop"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {k.display_name}
              </button>
            ))}
          </div>

          <section className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 font-display font-bold">
              <Heart className="h-5 w-5 text-accent" />
              Write {selectedKid?.display_name ?? "your kid"} a note
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (hasContent && childId && !send.isPending) send.mutate();
              }}
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE))}
                placeholder="You worked so hard this week — I'm proud of you! 🌟"
                maxLength={MAX_MESSAGE}
                rows={4}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{text.length}/{MAX_MESSAGE}</span>
              </div>

              {/* Photo preview */}
              {photoPreview && (
                <div className="relative overflow-hidden rounded-2xl border border-border/60">
                  <img src={photoPreview} alt="Preview" className="max-h-64 w-full object-cover" />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 h-8 w-8"
                    onClick={() => setPhoto(null)}
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Voice preview */}
              {voice.url && !voice.recording && (
                <div className="space-y-2 rounded-2xl border border-border/60 p-2">
                  <div className="flex items-center gap-2">
                    <audio controls src={voice.url} className="flex-1" />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        lastTranscribedRef.current = null;
                        voice.reset();
                      }}
                      aria-label="Discard recording"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    {transcribing ? (
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Transcribing your voice note…
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Voice note attached — transcript added to your message
                      </span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={transcribing || !voice.blob}
                      onClick={() => voice.blob && runTranscription(voice.blob)}
                    >
                      <Wand2 className="h-3.5 w-3.5" /> Re-transcribe
                    </Button>
                  </div>
                </div>
              )}

              {voice.recording && (
                <div className="flex items-center gap-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
                  Recording… {String(Math.floor(voice.elapsed / 60)).padStart(1, "0")}:
                  {String(voice.elapsed % 60).padStart(2, "0")}
                </div>
              )}

              {/* Hidden file inputs */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto(f);
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto(f);
                }}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <ImageIcon className="h-4 w-4" /> Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" /> Camera
                </Button>
                {!voice.recording ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={voice.start}
                  >
                    <Mic className="h-4 w-4" /> {voice.blob ? "Re-record" : "Record"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={voice.stop}
                  >
                    <Square className="h-4 w-4" /> Stop
                  </Button>
                )}

                <div className="ml-auto">
                  <Button
                    type="submit"
                    disabled={
                      send.isPending || uploading || !hasContent || !childId || voice.recording
                    }
                    className="bg-gradient-primary text-primary-foreground border-0 shadow-pop"
                  >
                    <Send className="h-4 w-4" />
                    {uploading || send.isPending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </div>
            </form>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {selectedKid?.display_name ?? "Their"}&rsquo;s wall
            </h2>
            {messages.length === 0 ? (
              <EmptyState text="Nothing here yet. Send the first note above!" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {messages.map((m, i) => (
                  <MessageCard
                    key={m.id}
                    m={m}
                    index={i}
                    onDelete={() => {
                      if (confirm("Delete this message?")) del.mutate(m.id);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
