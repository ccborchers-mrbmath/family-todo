import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Sparkles, ShieldCheck, X, CalendarDays } from "lucide-react";
import { getMe, listFamilyData } from "@/lib/family.functions";
import { listInstances, submitInstance } from "@/lib/tasks.functions";
import { supabase } from "@/integrations/supabase/client";
import { Celebration } from "@/components/Celebration";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Kinquest" }] }),
  component: Dashboard,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function weekFromTodayISO() {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function Dashboard() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  if (!me) return null;
  return me.role === "parent" ? <ParentDash /> : <KidDash />;
}

function KidDash() {
  const qc = useQueryClient();
  const [celebrate, setCelebrate] = useState(false);
  const from = todayISO();
  const to = weekFromTodayISO();

  const { data: instances = [] } = useQuery({
    queryKey: ["instances", "me", from, to],
    queryFn: () => listInstances({ data: { from, to } }),
  });

  useEffect(() => {
    const ch = supabase
      .channel("kid-instances")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_instances" },
        () => qc.invalidateQueries({ queryKey: ["instances"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const submit = useMutation({
    mutationFn: (id: string) => submitInstance({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["instances"] });
      const prev = qc.getQueryData<typeof instances>(["instances", "me", from, to]);
      qc.setQueryData(["instances", "me", from, to], (old: typeof instances | undefined) =>
        (old ?? []).map((i) =>
          i.id === id ? { ...i, status: "submitted", completed_at: new Date().toISOString() } : i,
        ),
      );
      setCelebrate(true);
      return { prev };
    },
    onError: (e, _id, ctx) => {
      toast.error((e as Error).message);
      if (ctx?.prev) qc.setQueryData(["instances", "me", from, to], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["instances"] }),
  });

  const today = useMemo(() => instances.filter((i) => i.due_date === from), [instances, from]);
  const upcoming = useMemo(() => instances.filter((i) => i.due_date > from), [instances, from]);
  const rejected = useMemo(() => instances.filter((i) => i.status === "rejected"), [instances]);

  return (
    <div className="space-y-8">
      <Celebration open={celebrate} onDone={() => setCelebrate(false)} />

      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Today</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {today.length} task{today.length === 1 ? "" : "s"} to crush
        </p>
      </div>

      {rejected.length > 0 && (
        <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <X className="h-4 w-4 text-destructive" />
            <span className="font-semibold text-sm">Sent back to redo</span>
          </div>
          <ul className="space-y-2">
            {rejected.map((i) => (
              <li key={i.id} className="text-sm">
                <span className="font-medium">{i.tasks?.title}</span>
                {i.reject_note && <span className="text-muted-foreground"> — {i.reject_note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3">
        {today.length === 0 && (
          <EmptyState text="Nothing due today. Enjoy the breather." />
        )}
        {today.map((i) => (
          <KidTaskCard key={i.id} instance={i} onComplete={() => submit.mutate(i.id)} />
        ))}
      </div>

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-accent" /> Coming up
          </h2>
          <div className="grid gap-2">
            {upcoming.map((i) => (
              <div
                key={i.id}
                className="rounded-xl border border-border/60 bg-card/40 px-4 py-3 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium text-sm">{i.tasks?.title}</div>
                  <div className="text-xs text-muted-foreground">{i.due_date}</div>
                </div>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function KidTaskCard({
  instance,
  onComplete,
}: {
  instance: { id: string; status: string; tasks?: { title?: string; description?: string | null } | null };
  onComplete: () => void;
}) {
  const done = instance.status !== "pending";
  const statusBadge =
    instance.status === "submitted"
      ? { label: "Awaiting verify", icon: ShieldCheck, cls: "bg-accent/20 text-accent" }
      : instance.status === "approved"
        ? { label: "Approved", icon: Sparkles, cls: "bg-success/20 text-success" }
        : null;

  return (
    <motion.div
      layout
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-4",
        done && "opacity-70",
      )}
    >
      <button
        onClick={done ? undefined : onComplete}
        disabled={done}
        aria-label="Mark complete"
        className={cn(
          "relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl transition-all",
          done
            ? "bg-gradient-energy shadow-pop"
            : "border-2 border-border bg-background hover:border-primary hover:bg-secondary/60",
        )}
      >
        {done && <Check className="h-7 w-7 text-primary-foreground" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={cn("font-semibold", done && "line-through")}>{instance.tasks?.title}</div>
        {instance.tasks?.description && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{instance.tasks.description}</div>
        )}
      </div>
      {statusBadge && (
        <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full", statusBadge.cls)}>
          {statusBadge.label}
        </span>
      )}
    </motion.div>
  );
}

function ParentDash() {
  const qc = useQueryClient();
  const from = todayISO();
  const to = weekFromTodayISO();

  const { data: family } = useQuery({ queryKey: ["family"], queryFn: () => listFamilyData() });
  const { data: instances = [] } = useQuery({
    queryKey: ["instances", "family", from, to],
    queryFn: () => listInstances({ data: { from, to } }),
  });

  useEffect(() => {
    const ch = supabase
      .channel("parent-instances")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_instances" },
        () => qc.invalidateQueries({ queryKey: ["instances"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const kids = (family?.members ?? []).filter((m) => m.role === "kid");
  const pendingVerify = instances.filter((i) => i.status === "submitted");

  const todayByKid = kids.map((k) => {
    const list = instances.filter((i) => i.assignee_id === k.id && i.due_date === from);
    const done = list.filter((i) => i.status !== "pending").length;
    return { kid: k, list, done };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Today across {family?.members.length ?? 0}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pendingVerify.length} waiting for your verification
          </p>
        </div>
      </div>

      {pendingVerify.length > 0 && (
        <section className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <div className="flex items-center gap-2 mb-2 text-accent font-semibold text-sm">
            <ShieldCheck className="h-4 w-4" /> Awaiting your verification
          </div>
          <Button asChild size="sm" className="bg-gradient-cool text-primary-foreground border-0">
            <a href="/verify">Review {pendingVerify.length}</a>
          </Button>
        </section>
      )}

      {kids.length === 0 && (
        <EmptyState text="No kids linked yet. Invite them from the Family page." />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {todayByKid.map(({ kid, list, done }) => (
          <div key={kid.id} className="rounded-3xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-display font-bold text-lg">{kid.display_name}</div>
                <div className="text-xs text-muted-foreground">
                  {done}/{list.length} done today
                </div>
              </div>
              <div className="text-2xl">
                {list.length > 0 && done === list.length ? "🎯" : null}
              </div>
            </div>
            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tasks scheduled today.</div>
            ) : (
              <ul className="space-y-1.5">
                {list.map((i) => (
                  <li key={i.id} className="flex items-center justify-between text-sm">
                    <span className={cn(i.status !== "pending" && "text-muted-foreground line-through")}>
                      {i.tasks?.title}
                    </span>
                    <StatusChip status={i.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    submitted: "bg-accent/20 text-accent",
    approved: "bg-success/20 text-success",
    rejected: "bg-destructive/20 text-destructive",
  };
  return (
    <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full", map[status])}>
      {status}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
