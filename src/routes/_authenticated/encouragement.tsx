import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo, useRef } from "react";
import type { ChangeEvent } from "react";
import { motion } from "framer-motion";
import { Heart, Sparkles, Send, Trash2, ImagePlus, Mic, Square, X } from "lucide-react";
import { getMe, listFamilyData } from "@/lib/family.functions";
import {
  listEncouragement,
  sendEncouragement,
  deleteEncouragement,
} from "@/lib/encouragement.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/encouragement")({
  head: () => ({ meta: [{ title: "Encouragement Wall · Kinquest" }] }),
  component: EncouragementPage,
});

const BUCKET = "encouragement-media";
const MAX_CHARS = 1000;

type WallMessage = {
  id: string;
  message: string | null;
  child_id: string;
  author_id: string;
  created_at: string;
  imageUrl: string | null;
  audioUrl: string | null;
};

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
  };
  return map[mime.split(";")[0]] ?? "bin";
}

async function uploadToWall(file: Blob, familyId: string, contentType: string) {
  const path = `${familyId}/${crypto.randomUUID()}.${extFromMime(contentType)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

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

function MessageCard({
  msg,
  author,
  index,
  onDelete,
}: {
  msg: WallMessage;
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

      {msg.imageUrl && (
        <img
          src={msg.imageUrl}
          alt="Encouragement"
          className="relative mb-3 max-h-72 w-full rounded-2xl object-cover"
        />
      )}

      {msg.message && (
        <p className="relative whitespace-pre-wrap text-base font-medium leading-relaxed">
          {msg.message}
        </p>
      )}

      {msg.audioUrl && (
        <audio controls src={msg.audioUrl} className="relative mt-3 w-full">
          Your browser doesn&rsquo;t support audio playback.
        </audio>
      )}

      <div className="relative mt-4 flex items-center justify-between text-xs opacity-80">
        <span>{author ? `From ${author}` : "From your family"}</span>
        <span>{new Date(msg.created_at).toLocaleDateString()}</span>
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
  const { data: messages = [] } = useQuery<WallMessage[]>({
    queryKey: ["encouragement", "me"],
    queryFn: () => listEncouragement({ data: {} }),
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
            <MessageCard key={m.id} msg={m} author={authorName[m.author_id]} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("audio/webm");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  function pickMime() {
    const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
    }
    return "audio/webm";
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mt = pickMime();
      setMimeType(mt);
      const rec = new MediaRecorder(stream, { mimeType: mt });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mt });
        setBlob(b);
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(b);
        });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Couldn't access the microphone. Check your browser permissions.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function clear() {
    setBlob(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return { recording, blob, previewUrl, mimeType, start, stop, clear };
}

function ParentWall() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const { data: family } = useQuery({ queryKey: ["family"], queryFn: () => listFamilyData() });
  const kids = useMemo(
    () => (family?.members ?? []).filter((m) => m.role === "kid"),
    [family],
  );
  const familyId = me?.profile?.family_id ?? null;

  const [childId, setChildId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();

  // Default to the first kid once the family loads.
  useEffect(() => {
    if (!childId && kids.length > 0) setChildId(kids[0].id);
  }, [kids, childId]);

  const { data: messages = [] } = useQuery<WallMessage[]>({
    queryKey: ["encouragement", childId],
    queryFn: () => listEncouragement({ data: { childId: childId! } }),
    enabled: !!childId,
  });

  function pickImage(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = ""; // allow re-picking the same file
    if (!f) return;
    setImageFile(f);
    setImagePreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function resetComposer() {
    setText("");
    clearImage();
    voice.clear();
  }

  const hasContent = !!text.trim() || !!imageFile || !!voice.blob;

  const send = useMutation({
    mutationFn: async () => {
      if (!childId) throw new Error("Pick a child first.");
      if (!familyId) throw new Error("No family.");
      let imagePath: string | null = null;
      let audioPath: string | null = null;
      if (imageFile) {
        imagePath = await uploadToWall(imageFile, familyId, imageFile.type || "image/jpeg");
      }
      if (voice.blob) {
        audioPath = await uploadToWall(voice.blob, familyId, voice.mimeType);
      }
      await sendEncouragement({
        data: { childId, message: text.trim() || null, imagePath, audioPath },
      });
    },
    onSuccess: () => {
      resetComposer();
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

  return (
    <div className="space-y-8">
      <Header subtitle="Send a compliment, good-luck wish, or kind word to your kids" />

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

          <section className="rounded-3xl border border-border/60 bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 font-display font-bold">
              <Heart className="h-5 w-5 text-accent" />
              Write {selectedKid?.display_name ?? "your kid"} a note
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (hasContent && childId && !voice.recording) send.mutate();
              }}
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="You worked so hard this week — I'm proud of you! Good luck on your test today 🌟"
                maxLength={MAX_CHARS}
                rows={3}
              />

              {/* Image preview */}
              {imagePreview && (
                <div className="relative w-fit">
                  <img
                    src={imagePreview}
                    alt="Selected"
                    className="max-h-48 rounded-2xl object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove photo"
                    onClick={clearImage}
                    className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-background/80 hover:bg-background"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Voice note preview */}
              {voice.previewUrl && (
                <div className="flex items-center gap-2">
                  <audio controls src={voice.previewUrl} className="w-full" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove voice note"
                    onClick={voice.clear}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={pickImage}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" /> Photo
                </Button>

                {voice.recording ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={voice.stop}
                    className="border-destructive/50 text-destructive"
                  >
                    <Square className="h-4 w-4" /> Stop recording
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={voice.start}>
                    <Mic className="h-4 w-4" /> {voice.blob ? "Re-record" : "Voice note"}
                  </Button>
                )}

                <div className="ml-auto flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {text.length}/{MAX_CHARS}
                  </span>
                  <Button
                    type="submit"
                    disabled={send.isPending || !hasContent || !childId || voice.recording}
                    className="bg-gradient-primary text-primary-foreground border-0 shadow-pop"
                  >
                    <Send className="h-4 w-4" /> {send.isPending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </div>
              {voice.recording && (
                <p className="text-xs text-destructive animate-pulse">● Recording…</p>
              )}
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
                    msg={m}
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
