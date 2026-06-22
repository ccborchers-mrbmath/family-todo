import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listTasks, deleteTask, listInstances } from "@/lib/tasks.functions";
import { listFamilyData, getMe } from "@/lib/family.functions";
import { describeRecurrence, type RecurrenceConfig, type RecurrenceType } from "@/lib/recurrence";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({ meta: [{ title: "Tasks · Kinquest" }] }),
  component: TasksPage,
});

function TasksPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => listTasks() });
  const { data: family } = useQuery({ queryKey: ["family"], queryFn: () => listFamilyData() });

  const today = new Date().toISOString().slice(0, 10);
  const from = "2000-01-01";
  const to = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: instances = [] } = useQuery({
    queryKey: ["instances", "all", from, to],
    queryFn: () => listInstances({ data: { from, to } }),
  });

  const memberMap = new Map((family?.members ?? []).map((m) => [m.id, m.display_name]));
  const isParent = me?.role === "parent";

  const del = useMutation({
    mutationFn: (id: string) => deleteTask({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const { completed, active } = useMemo(() => {
    const byTask = new Map<string, { total: number; approved: number; pendingFuture: number }>();
    for (const i of instances) {
      const entry = byTask.get(i.task_id) ?? { total: 0, approved: 0, pendingFuture: 0 };
      entry.total += 1;
      if (i.status === "approved") entry.approved += 1;
      if (i.status !== "approved" && i.due_date >= today) entry.pendingFuture += 1;
      byTask.set(i.task_id, entry);
    }
    const completed: typeof tasks = [];
    const active: typeof tasks = [];
    for (const t of tasks) {
      const stats = byTask.get(t.id);
      const isOnce = t.recurrence_type === "once";
      const isCompleted = isOnce
        ? !!stats && stats.approved > 0
        : !t.active || (!!stats && stats.total > 0 && stats.pendingFuture === 0 && (!t.end_date || t.end_date < today));
      if (isCompleted) completed.push(t);
      else active.push(t);
    }
    return { completed, active };
  }, [tasks, instances, today]);

  function renderList(list: typeof tasks) {
    if (list.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Nothing here.
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {list.map((t) => (
          <div key={t.id} className="rounded-2xl border border-border/60 bg-card p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-display font-bold">{t.title}</div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {memberMap.get(t.assignee_id) ?? "—"}
                </span>
              </div>
              {t.description && <div className="text-sm text-muted-foreground mt-1">{t.description}</div>}
              <div className="text-xs text-accent mt-2 font-medium flex items-center gap-2 flex-wrap">
                <span>{describeRecurrence(t.recurrence_type as RecurrenceType, (t.recurrence_config as RecurrenceConfig) ?? {})}</span>
                {Number(t.reward_amount) > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-energy text-primary-foreground text-[10px] font-bold">
                    R{Number(t.reward_amount).toFixed(2)} reward
                  </span>
                )}
              </div>
            </div>
            {isParent && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm(`Delete "${t.title}"?`)) del.mutate(t.id);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isParent ? "Create and manage chores & one-off tasks." : "Your assigned tasks."}
          </p>
        </div>
        {isParent && (
          <Button asChild className="bg-gradient-primary text-primary-foreground border-0 shadow-pop">
            <Link to="/tasks/new">
              <Plus className="h-4 w-4" /> New task
            </Link>
          </Button>
        )}
      </div>

      {isParent ? (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">{renderList(active)}</TabsContent>
          <TabsContent value="completed" className="mt-4">{renderList(completed)}</TabsContent>
        </Tabs>
      ) : (
        renderList(tasks)
      )}
    </div>
  );
}
