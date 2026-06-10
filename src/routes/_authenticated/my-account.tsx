import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Wallet, TrendingUp, TrendingDown, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listAccount, requestExpense } from "@/lib/money.functions";
import { formatMoney } from "@/lib/money";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-account")({
  head: () => ({ meta: [{ title: "My Money · Kinquest" }] }),
  component: MyAccountPage,
});

function MyAccountPage() {
  const qc = useQueryClient();
  const { data: account } = useQuery({
    queryKey: ["money", "account", "me"],
    queryFn: () => listAccount({ data: {} }),
  });
  const [open, setOpen] = useState(false);

  const balance = account?.balance ?? 0;
  const pending = account?.pendingExpense ?? 0;
  const txns = (account?.txns ?? []) as any[];
  const incomes = txns.filter((t) => t.type === "income");
  const expenses = txns.filter((t) => t.type === "expense");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-cool shadow-glow">
          <Wallet className="h-5 w-5 text-primary-foreground" />
        </span>
        <h1 className="text-3xl font-display font-bold tracking-tight">My Money</h1>
      </div>

      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-card to-secondary/40 p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Balance</div>
        <div className="mt-1 font-display text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          {formatMoney(balance)}
        </div>
        {pending > 0 && (
          <div className="text-xs text-accent mt-2 flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatMoney(pending)} pending approval
          </div>
        )}
      </div>

      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-gradient-energy text-primary-foreground border-0 shadow-pop"
      >
        <Send className="h-4 w-4 mr-2" /> Ask to spend
      </Button>

      <div className="grid md:grid-cols-2 gap-4">
        <Column title="Income" icon={<TrendingUp className="h-4 w-4 text-success" />} rows={incomes} positive />
        <Column title="Expenses" icon={<TrendingDown className="h-4 w-4 text-destructive" />} rows={expenses} />
      </div>

      <RequestDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={() => qc.invalidateQueries({ queryKey: ["money"] })}
      />
    </div>
  );
}

function Column({
  title,
  icon,
  rows,
  positive,
}: {
  title: string;
  icon: React.ReactNode;
  rows: any[];
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="font-display font-bold text-sm mb-3 flex items-center gap-2">{icon} {title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">Nothing yet.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id} className="rounded-xl border border-border/40 bg-background/40 p-3">
              <div className="text-sm flex items-center gap-2">
                <span className={cn("font-semibold", positive ? "text-success" : "text-destructive")}>
                  {positive ? "+" : "−"}{formatMoney(t.amount)}
                </span>
                {t.status !== "approved" && (
                  <span
                    className={cn(
                      "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-semibold",
                      t.status === "pending" ? "bg-accent/20 text-accent" : "bg-destructive/20 text-destructive",
                    )}
                  >
                    {t.status}
                  </span>
                )}
              </div>
              {t.note && <div className="text-xs mt-0.5">{t.note}</div>}
              <div className="text-[10px] text-muted-foreground mt-0.5">{t.occurred_on}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const submit = useMutation({
    mutationFn: () => requestExpense({ data: { amount: Number(amount), note: note.trim() } }),
    onSuccess: () => {
      toast.success("Request sent to your parent");
      setAmount(""); setNote("");
      onOpenChange(false);
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask to spend</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Amount (R)</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">What for?</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="New game skin" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !amount || !note.trim() || Number(amount) <= 0}
            className="bg-gradient-primary text-primary-foreground border-0"
          >
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
