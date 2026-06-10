import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listInstances, verifyInstance } from "@/lib/tasks.functions";
import { listFamilyData } from "@/lib/family.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/verify")({
  head: () => ({ meta: [{ title: "Verify · Kinquest" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const qc = useQueryClient();
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 14);
  const fromS = from.toISOString().slice(0, 10);
  const toS = today.toISOString().slice(0, 10);

  const { data: family } = useQuery({ queryKey: ["family"], queryFn: () => listFamilyData() });
  const memberMap = new Map((family?.members ?? []).map((m) => [m.id, m.display_name]));

  const { data: instances = [] } = useQuery({
    queryKey: ["instances", "family", fromS, toS],
    queryFn: () => listInstances({ data: { from: fromS, to: toS } }),
  });

  useEffect(() => {
    const ch = supabase
      .channel("verify-instances")
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

  const submitted = instances.filter((i) => i.status === "submitted");

  const verify = useMutation({
    mutationFn: (v: { id: string; approve: boolean; note?: string }) =>
      verifyInstance({ data: { id: v.id, approve: v.approve, note: v.note ?? null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instances"] });
      toast.success("Saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-accent" /> Verify
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {submitted.length} completion{submitted.length === 1 ? "" : "s"} waiting for your call
        </p>
      </div>

      <div className="grid gap-3">
        {submitted.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            All caught up. Nothing to verify.
          </div>
        )}
        {submitted.map((i) => (
          <div key={i.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-bold">{i.tasks?.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {memberMap.get(i.assignee_id) ?? "Kid"} · marked done{" "}
                  {i.completed_at ? new Date(i.completed_at).toLocaleString() : ""}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => verify.mutate({ id: i.id, approve: true })}
                className="bg-gradient-energy text-primary-foreground border-0 shadow-pop"
              >
                <Check className="h-4 w-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setRejecting(i.id);
                  setNote("");
                }}
              >
                <X className="h-4 w-4" /> Send back
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back to redo</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Optional note — what needs to be fixed?"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejecting) {
                  verify.mutate({ id: rejecting, approve: false, note: note.trim() || undefined });
                  setRejecting(null);
                }
              }}
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
