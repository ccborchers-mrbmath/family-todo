import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2, Check, X, Wallet, Clock, CalendarClock, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listFamilyData } from "@/lib/family.functions";
import {
  listAccount,
  addTransaction,
  deleteTransaction,
  decideExpense,
  listPendingExpenseRequests,
  listRecurring,
  upsertRecurring,
  deleteRecurring,
} from "@/lib/money.functions";
import { formatMoney } from "@/lib/money";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Money · Kinquest" }] }),
  component: AccountsPage,
});

function AccountsPage() {
  const qc = useQueryClient();
  const { data: family } = useQuery({ queryKey: ["family"], queryFn: () => listFamilyData() });
  const kids = (family?.members ?? []).filter((m) => m.role === "kid");

  const { data: pending = [] } = useQuery({
    queryKey: ["money", "pending"],
    queryFn: () => listPendingExpenseRequests(),
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => decideExpense({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["money"] });
      toast.success("Decision saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-cool shadow-glow">
          <Wallet className="h-5 w-5 text-primary-foreground" />
        </span>
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Money</h1>
          <p className="text-sm text-muted-foreground">Pocket money, rewards & spending</p>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="rounded-2xl border border-accent/40 bg-accent/10 p-4 space-y-3">
          <div className="font-display font-bold text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent" /> Spend requests waiting on you
          </div>
          {pending.map((p: any) => {
            const kid = kids.find((k) => k.id === p.child_id);
            return (
              <div key={p.id} className="rounded-xl bg-background/60 p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">
                    {kid?.display_name ?? "Kid"} · {formatMoney(p.amount)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.note}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: p.id, approve: false })}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-energy text-primary-foreground border-0"
                  onClick={() => decide.mutate({ id: p.id, approve: true })}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </section>
      )}

      {kids.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Invite kids from the Family page to start managing accounts.
        </div>
      )}

      {kids.length > 0 && (
        <Tabs defaultValue={kids[0].id} className="w-full">
          <TabsList className="bg-secondary/60">
            {kids.map((k) => (
              <TabsTrigger key={k.id} value={k.id}>
                {k.display_name}
              </TabsTrigger>
            ))}
          </TabsList>
          {kids.map((k) => (
            <TabsContent key={k.id} value={k.id} className="mt-6">
              <ChildAccountPanel childId={k.id} childName={k.display_name} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function ChildAccountPanel({ childId, childName }: { childId: string; childName: string }) {
  const qc = useQueryClient();
  const { data: account } = useQuery({
    queryKey: ["money", "account", childId],
    queryFn: () => listAccount({ data: { childId } }),
  });
  const { data: recurring = [] } = useQuery({
    queryKey: ["money", "recurring", childId],
    queryFn: () => listRecurring({ data: { childId } }),
  });

  const balance = account?.balance ?? 0;
  const pending = account?.pendingExpense ?? 0;
  const txns = (account?.txns ?? []) as any[];

  const income = txns.filter((t) => t.type === "income" && t.status === "approved");
  const expense = txns.filter((t) => t.type === "expense" && t.status === "approved");
  const sumIncome = income.reduce((a, t) => a + Number(t.amount), 0);
  const sumExpense = expense.reduce((a, t) => a + Number(t.amount), 0);

  const del = useMutation({
    mutationFn: (id: string) => deleteTransaction({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["money"] }),
  });

  const delRec = useMutation({
    mutationFn: (id: string) => deleteRecurring({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["money", "recurring"] }),
  });

  return (
    <div className="space-y-6">
      {/* Balance hero */}
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-card to-secondary/40 p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {childName}'s balance
        </div>
        <div className="mt-1 font-display text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          {formatMoney(balance)}
        </div>
        {pending > 0 && (
          <div className="text-xs text-accent mt-2">
            {formatMoney(pending)} in pending requests
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-success/10 p-3">
            <div className="text-xs text-muted-foreground">Income</div>
            <div className="font-semibold text-success">{formatMoney(sumIncome)}</div>
          </div>
          <div className="rounded-xl bg-destructive/10 p-3">
            <div className="text-xs text-muted-foreground">Expenses</div>
            <div className="font-semibold text-destructive">{formatMoney(sumExpense)}</div>
          </div>
        </div>
      </div>

      <AddTransactionForm childId={childId} />

      <RecurringSection
        childId={childId}
        items={recurring as any[]}
        onDelete={(id) => delRec.mutate(id)}
      />

      <TransactionList txns={txns} onDelete={(id) => del.mutate(id)} />
    </div>
  );
}

function AddTransactionForm({ childId }: { childId: string }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const add = useMutation({
    mutationFn: () =>
      addTransaction({
        data: {
          childId,
          type,
          amount: Number(amount),
          note: note.trim() || null,
          occurredOn: date,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["money"] });
      toast.success("Added");
      setAmount("");
      setNote("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="font-display font-bold text-sm mb-3 flex items-center gap-2">
        <Plus className="h-4 w-4 text-accent" /> Add a transaction
      </div>
      <form
        className="grid sm:grid-cols-[110px_120px_1fr_140px_auto] gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount && Number(amount) > 0) add.mutate();
        }}
      >
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Amount (R)</Label>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label className="text-xs">Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Birthday gift" />
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button type="submit" disabled={add.isPending || !amount} className="bg-gradient-primary text-primary-foreground border-0">
          Add
        </Button>
      </form>
    </section>
  );
}

function RecurringSection({
  childId,
  items,
  onDelete,
}: {
  childId: string;
  items: any[];
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display font-bold text-sm flex items-center gap-2">
          <Repeat className="h-4 w-4 text-accent" /> Recurring pocket money
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add schedule
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No recurring payments set up yet.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className="rounded-xl border border-border/40 bg-background/40 p-3 flex items-center gap-3">
              <CalendarClock className="h-4 w-4 text-accent" />
              <div className="flex-1 min-w-0 text-sm">
                <div className="font-medium">{formatMoney(r.amount)} — {describeRecurring(r)}</div>
                {r.note && <div className="text-xs text-muted-foreground truncate">{r.note}</div>}
                {!r.active && <span className="text-xs text-muted-foreground">paused</span>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <RecurringDialog open={open} onOpenChange={setOpen} childId={childId} />
    </section>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeRecurring(r: any) {
  if (r.recurrence === "weekly") return `Every ${WEEKDAYS[r.day_of_week ?? 1]}`;
  return `Day ${r.day_of_month ?? 1} of each month`;
}

function RecurringDialog({
  open,
  onOpenChange,
  childId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  childId: string;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [recurrence, setRecurrence] = useState<"weekly" | "monthly">("weekly");
  const [dow, setDow] = useState(1);
  const [dom, setDom] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) {
      setAmount(""); setNote(""); setRecurrence("weekly"); setDow(1); setDom(1);
      setStartDate(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const save = useMutation({
    mutationFn: () =>
      upsertRecurring({
        data: {
          childId,
          amount: Number(amount),
          note: note.trim() || null,
          recurrence,
          dayOfWeek: recurrence === "weekly" ? dow : null,
          dayOfMonth: recurrence === "monthly" ? dom : null,
          startDate,
          endDate: null,
          active: true,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["money"] });
      toast.success("Schedule saved");
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New pocket money schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount (R)</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Starts</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Repeat</Label>
            <div className="flex gap-2 mt-1">
              {(["weekly", "monthly"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRecurrence(r)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium border",
                    recurrence === r
                      ? "bg-gradient-primary text-primary-foreground border-transparent"
                      : "border-border bg-background",
                  )}
                >
                  {r === "weekly" ? "Weekly" : "Monthly"}
                </button>
              ))}
            </div>
          </div>
          {recurrence === "weekly" ? (
            <div>
              <Label className="text-xs">Day of the week</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {WEEKDAYS.map((w, i) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setDow(i)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium border",
                      dow === i
                        ? "bg-gradient-cool text-primary-foreground border-transparent"
                        : "border-border bg-background",
                    )}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Day of the month (1–31, clamps to month end)</Label>
              <Input type="number" min={1} max={31} value={dom} onChange={(e) => setDom(Number(e.target.value) || 1)} />
            </div>
          )}
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Weekly allowance" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !amount || Number(amount) <= 0}
            className="bg-gradient-primary text-primary-foreground border-0"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransactionList({ txns, onDelete }: { txns: any[]; onDelete: (id: string) => void }) {
  if (txns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No transactions yet.
      </div>
    );
  }

  const incomes = txns.filter((t) => t.type === "income");
  const expenses = txns.filter((t) => t.type === "expense");

  return (
    <section className="grid md:grid-cols-2 gap-4">
      <Column title="Income" rows={incomes} positive onDelete={onDelete} />
      <Column title="Expenses" rows={expenses} onDelete={onDelete} />
    </section>
  );
}

function Column({
  title,
  rows,
  positive,
  onDelete,
}: {
  title: string;
  rows: any[];
  positive?: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="font-display font-bold text-sm mb-3">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">Nothing yet.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id} className="rounded-xl border border-border/40 bg-background/40 p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm flex items-center gap-2">
                  <span className={cn("font-semibold", positive ? "text-success" : "text-destructive")}>
                    {positive ? "+" : "−"}{formatMoney(t.amount)}
                  </span>
                  <SourceChip source={t.source} />
                  <StatusChip status={t.status} />
                </div>
                {t.note && <div className="text-xs mt-0.5">{t.note}</div>}
                <div className="text-[10px] text-muted-foreground mt-0.5">{t.occurred_on}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceChip({ source }: { source: string }) {
  const map: Record<string, string> = {
    manual: "bg-secondary text-muted-foreground",
    task_reward: "bg-primary/20 text-primary",
    recurring: "bg-accent/20 text-accent",
    request: "bg-muted text-muted-foreground",
  };
  const label: Record<string, string> = {
    manual: "manual",
    task_reward: "chore",
    recurring: "pocket money",
    request: "request",
  };
  return (
    <span className={cn("text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-semibold", map[source])}>
      {label[source] ?? source}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "approved") return null;
  const map: Record<string, string> = {
    pending: "bg-accent/20 text-accent",
    rejected: "bg-destructive/20 text-destructive",
  };
  return (
    <span className={cn("text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-semibold", map[status])}>
      {status}
    </span>
  );
}
