import { useEffect, useRef, useState } from "react";
import { Mic, Square, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { transcribeVoice } from "@/lib/transcribe.functions";
import { cleanupText } from "@/lib/text-cleanup.functions";

type BaseProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  disabled?: boolean;
  autoCleanupAfterVoice?: boolean; // default true
};

type InputProps = BaseProps & {
  as?: "input";
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
};

type TextareaProps = BaseProps & {
  as: "textarea";
  rows?: number;
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
};

type Props = InputProps | TextareaProps;

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function SmartField(props: Props) {
  const {
    value,
    onChange,
    placeholder,
    className,
    maxLength,
    disabled,
    autoCleanupAfterVoice = true,
  } = props;
  const isTextarea = props.as === "textarea";

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState<null | "transcribing" | "cleaning">(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopStream = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopStream(), []);

  const appendText = (extra: string) => {
    const combined = value.trim() ? `${value.trim()}\n\n${extra}` : extra;
    onChange(maxLength ? combined.slice(0, maxLength) : combined);
  };

  const handleTranscribed = async (transcript: string) => {
    if (!transcript) {
      toast.info("Couldn't hear any speech in that recording.");
      return;
    }
    appendText(transcript);
    toast.success("Voice note transcribed");
  };

  const runTranscribe = async (blob: Blob) => {
    setBusy("transcribing");
    try {
      const audioBase64 = await blobToBase64(blob);
      const { text: transcript } = await transcribeVoice({
        data: { audioBase64, mime: blob.type || "audio/webm" },
      });
      await handleTranscribed(transcript);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const startRecording = async () => {
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
        stopStream();
        setRecording(false);
        void runTranscribe(b);
      };
      mr.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
  };

  const runCleanup = async () => {
    if (!value.trim() || busy) return;
    setBusy("cleaning");
    try {
      const { text } = await cleanupText({ data: { text: value } });
      if (text && text !== value) {
        onChange(maxLength ? text.slice(0, maxLength) : text);
        toast.success("Spelling & grammar polished");
      } else {
        toast.info("Looks good already ✨");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Auto-cleanup after transcription completes (handled inside handleTranscribed → appendText).
  // We trigger a cleanup pass right after transcription if enabled.
  const prevBusyRef = useRef<typeof busy>(null);
  useEffect(() => {
    if (
      autoCleanupAfterVoice &&
      prevBusyRef.current === "transcribing" &&
      busy === null &&
      value.trim().length > 0
    ) {
      void runCleanup();
    }
    prevBusyRef.current = busy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const micLabel = recording
    ? `Stop recording (${elapsed}s)`
    : busy === "transcribing"
      ? "Transcribing…"
      : "Record voice note";

  const micBtn = (
    <Button
      type="button"
      variant={recording ? "destructive" : "ghost"}
      size="icon"
      aria-label={micLabel}
      title={micLabel}
      disabled={disabled || (!!busy && !recording)}
      onClick={() => (recording ? stopRecording() : startRecording())}
      className="h-8 w-8 shrink-0"
    >
      {recording ? (
        <Square className="h-4 w-4" />
      ) : busy === "transcribing" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );

  const polishBtn = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Check spelling & grammar"
      title="Check spelling & grammar"
      disabled={disabled || !value.trim() || !!busy}
      onClick={runCleanup}
      className="h-8 w-8 shrink-0"
    >
      {busy === "cleaning" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Wand2 className="h-4 w-4" />
      )}
    </Button>
  );

  if (isTextarea) {
    const p = props as TextareaProps;
    return (
      <div className={`space-y-1.5 ${className ?? ""}`}>
        <Textarea
          value={value}
          onChange={(e) =>
            onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)
          }
          onBlur={p.onBlur}
          placeholder={placeholder}
          rows={p.rows ?? 3}
          disabled={disabled}
          className="resize-y"
        />
        <div className="flex items-center gap-1 justify-end">
          {recording && (
            <span className="mr-auto text-xs text-destructive font-medium">
              ● Recording {elapsed}s
            </span>
          )}
          {busy && !recording && (
            <span className="mr-auto text-xs text-muted-foreground">
              {busy === "transcribing" ? "Transcribing…" : "Polishing…"}
            </span>
          )}
          {polishBtn}
          {micBtn}
        </div>
      </div>
    );
  }

  const p = props as InputProps;
  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <Input
        value={value}
        onChange={(e) =>
          onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)
        }
        onBlur={p.onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
      {polishBtn}
      {micBtn}
    </div>
  );
}
