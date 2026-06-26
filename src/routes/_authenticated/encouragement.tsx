import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Heart, Sparkles, Send, Trash2 } from "lucide-react";
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
  message,
  author,
  createdAt,
  index,
  onDelete,
}: {
  message: string;
  author?: string;
  createdAt: string;
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
      <p className="relative whitespace-pre-wrap text-base font-medium leading-relaxed">{message}</p>
      <div className="relative mt-4 flex items-center justify-between text-xs opacity-80">
        <span>{author ? `From ${author}` : "From your family"}</span>
        <span>{new Date(createdAt).toLocaleDateString()}</span>
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
            <MessageCard
              key={m.id}
              message={m.message}
              author={authorName[m.author_id]}
              createdAt={m.created_at}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ParentWall() {
  const qc = useQueryClient();
  const { data: family } = useQuery({ queryKey: ["family"], queryFn: () => listFamilyData() });
  const kids = useMemo(
    () => (family?.members ?? []).filter((m) => m.role === "kid"),
    [family],
  );

  const [childId, setChildId] = useState<string | null>(null);
  const [text, setText] = useState("");

  // Default to the first kid once the family loads.
  useEffect(() => {
    if (!childId && kids.length > 0) setChildId(kids[0].id);
  }, [kids, childId]);

  const { data: messages = [] } = useQuery({
    queryKey: ["encouragement", childId],
    queryFn: () => listEncouragement({ data: { childId: childId! } }),
    enabled: !!childId,
  });

  const send = useMutation({
    mutationFn: () => sendEncouragement({ data: { childId: childId!, message: text } }),
    onSuccess: () => {
      setText("");
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
                if (text.trim() && childId) send.mutate();
              }}
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="You worked so hard this week — I'm proud of you! Good luck on your test today 🌟"
                maxLength={500}
                rows={3}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{text.length}/500</span>
                <Button
                  type="submit"
                  disabled={send.isPending || !text.trim() || !childId}
                  className="bg-gradient-primary text-primary-foreground border-0 shadow-pop"
                >
                  <Send className="h-4 w-4" /> Send
                </Button>
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
                    message={m.message}
                    createdAt={m.created_at}
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
