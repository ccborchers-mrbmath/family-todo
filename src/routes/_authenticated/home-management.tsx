import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Check, ChevronDown, ChevronUp, User, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SmartField } from "@/components/SmartField";
import { getMe, listFamilyData } from "@/lib/family.functions";
import {
  listHomeManagement,
  saveVision,
  addHomeTask,
  toggleHomeTask,
  deleteHomeTask,
  updateHomeTask,
} from "@/lib/home-management.functions";
import { toast } from "sonner";

type FamilyMember = { id: string; display_name: string | null; email: string | null; role?: string | null };
const UNASSIGNED = "__unassigned__";


export const Route = createFileRoute("/_authenticated/home-management")({
  head: () => ({ meta: [{ title: "Home Management · Kinquest" }] }),
  component: HomeManagementPage,
});

type SectionNode = {
  key?: string; // stable key when this node has vision/tasks
  title: string;
  level: number; // heading level for display
  vision?: boolean;
  tasks?: boolean;
  children?: SectionNode[];
};

// Structure derived from the requested document outline.
const STRUCTURE: SectionNode[] = [
  { title: "Vision", level: 2, key: "root", vision: true },
  {
    title: "Shelter",
    level: 2,
    children: [
      {
        title: "Security",
        level: 3,
        children: [
          { title: "Security against threat", level: 4, key: "shelter.security.threat", vision: true, tasks: true },
          { title: "Security against theft", level: 4, key: "shelter.security.theft", vision: true, tasks: true },
        ],
      },
      { title: "Cleanliness", level: 3, key: "shelter.cleanliness", vision: true, tasks: true },
      { title: "Order", level: 3, key: "shelter.order", vision: true, tasks: true },
      { title: "Structural Integrity", level: 3, key: "shelter.structural", vision: true, tasks: true },
      { title: "Warmth", level: 3, key: "shelter.warmth", vision: true, tasks: true },
    ],
  },
  {
    title: "Food",
    level: 2,
    children: [
      { title: "Stock", level: 3, key: "food.stock", vision: true, tasks: true },
      { title: "Preservation", level: 3, key: "food.preservation", vision: true, tasks: true },
      { title: "Ease of Availability", level: 3, key: "food.availability", vision: true, tasks: true },
    ],
  },
  {
    title: "Clothing",
    level: 2,
    children: [
      { title: "Stock", level: 3, key: "clothing.stock", vision: true, tasks: true },
      { title: "Readiness", level: 3, key: "clothing.readiness", vision: true, tasks: true },
    ],
  },
];

function HomeManagementPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const { data, isLoading } = useQuery({
    queryKey: ["home-management"],
    queryFn: () => listHomeManagement(),
    enabled: me?.role === "parent",
  });
  const { data: family } = useQuery({
    queryKey: ["family"],
    queryFn: () => listFamilyData(),
    enabled: me?.role === "parent",
  });

  useEffect(() => {
    if (me && me.role !== "parent") {
      throw redirect({ to: "/dashboard" });
    }
  }, [me]);

  if (me?.role !== "parent") {
    return (
      <div className="rounded-2xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
        This page is only available to parents.
      </div>
    );
  }

  const members: FamilyMember[] = (family?.members ?? []) as FamilyMember[];
  const memberMap = useMemo(() => {
    const m = new Map<string, FamilyMember>();
    for (const mem of members) m.set(mem.id, mem);
    return m;
  }, [members]);

  const visionMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of data?.visions ?? []) m.set(v.section_key, v.content ?? "");
    return m;
  }, [data]);

  const tasksBySection = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const t of data?.tasks ?? []) {
      const arr = m.get(t.section_key) ?? [];
      arr.push(t);
      m.set(t.section_key, arr);
    }
    return m;
  }, [data]);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Fundamentals of Home Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set your vision and manage the ongoing tasks that keep the home running.
        </p>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-8">
          {STRUCTURE.map((node, idx) => (
            <div key={node.title} className="space-y-6">
              <SectionBlock
                node={node}
                visionMap={visionMap}
                tasksBySection={tasksBySection}
                members={members}
                memberMap={memberMap}
                meId={me?.profile?.id ?? ""}
                onChanged={() => qc.invalidateQueries({ queryKey: ["home-management"] })}
              />
              {idx === 0 && (
                <ActiveTaskSummary
                  tasks={data?.tasks ?? []}
                  memberMap={memberMap}
                  onChanged={() => qc.invalidateQueries({ queryKey: ["home-management"] })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function SectionBlock({
  node,
  visionMap,
  tasksBySection,
  members,
  memberMap,
  meId,
  onChanged,
}: {
  node: SectionNode;
  visionMap: Map<string, string>;
  tasksBySection: Map<string, any[]>;
  members: FamilyMember[];
  memberMap: Map<string, FamilyMember>;
  meId: string;
  onChanged: () => void;
}) {
  const headingClass =
    node.level === 2
      ? "text-2xl font-display font-bold tracking-tight"
      : node.level === 3
        ? "text-xl font-display font-semibold"
        : "text-lg font-semibold";
  const heading =
    node.level === 2 ? (
      <h2 className={headingClass}>{node.title}</h2>
    ) : node.level === 3 ? (
      <h3 className={headingClass}>{node.title}</h3>
    ) : (
      <h4 className={headingClass}>{node.title}</h4>
    );

  return (
    <section className="space-y-4">
      {heading}
      {node.key && (node.vision || node.tasks) && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
          {node.vision && <VisionEditor sectionKey={node.key} initial={visionMap.get(node.key) ?? ""} onSaved={onChanged} />}
          {node.tasks && (
            <TaskListEditor
              sectionKey={node.key}
              tasks={tasksBySection.get(node.key) ?? []}
              members={members}
              memberMap={memberMap}
              meId={meId}
              onChanged={onChanged}
            />
          )}
        </div>
      )}
      {node.children && (
        <div className={node.level >= 3 ? "pl-4 border-l border-border/40 space-y-6" : "space-y-6"}>
          {node.children.map((child) => (
            <SectionBlock
              key={child.title}
              node={child}
              visionMap={visionMap}
              tasksBySection={tasksBySection}
              members={members}
              memberMap={memberMap}
              meId={meId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </section>
  );
}


function VisionEditor({
  sectionKey,
  initial,
  onSaved,
}: {
  sectionKey: string;
  initial: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  useEffect(() => setValue(initial), [initial]);

  const save = useMutation({
    mutationFn: () => saveVision({ data: { sectionKey, content: value } }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vision</div>
      <SmartField
        as="textarea"
        value={value}
        onChange={setValue}
        onBlur={() => value !== initial && save.mutate()}
        placeholder="Describe the vision for this area…"
        rows={3}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{saved ? "Saved" : "Auto-saves when you click away"}</span>
        {value !== initial && (
          <Button size="sm" variant="ghost" onClick={() => save.mutate()} disabled={save.isPending}>
            Save now
          </Button>
        )}
      </div>
    </div>
  );
}

function TaskListEditor({
  sectionKey,
  tasks,
  members,
  memberMap,
  meId,
  onChanged,
}: {
  sectionKey: string;
  tasks: any[];
  members: FamilyMember[];
  memberMap: Map<string, FamilyMember>;
  meId: string;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>(UNASSIGNED);

  const add = useMutation({
    mutationFn: () =>
      addHomeTask({
        data: {
          sectionKey,
          title: title.trim(),
          timeframe: timeframe.trim() || null,
          dueDate: dueDate || null,
          assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
        },
      }),
    onSuccess: () => {
      setTitle("");
      setTimeframe("");
      setDueDate("");
      setAssigneeId(UNASSIGNED);
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggle = useMutation({
    mutationFn: (t: { id: string; completed: boolean }) => toggleHomeTask({ data: t }),
    onSuccess: onChanged,
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteHomeTask({ data: { id } }),
    onSuccess: onChanged,
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: (v: {
      id: string;
      title: string;
      timeframe: string | null;
      dueDate: string | null;
      assigneeId: string | null;
    }) => updateHomeTask({ data: v }),
    onSuccess: () => {
      toast.success("Task updated");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const active = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Task list</div>

      <div className="flex flex-col sm:flex-row gap-2">
        <SmartField
          value={title}
          onChange={setTitle}
          placeholder="New task…"
          className="flex-1"
        />
        <SmartField
          value={timeframe}
          onChange={setTimeframe}
          placeholder="Timeframe (e.g. Weekly)"
          className="sm:w-56"
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="sm:w-44"
          aria-label="Due date"
        />
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="sm:w-48" aria-label="Assign to">
            <SelectValue placeholder="Assign to…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned (me)</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {(m.display_name || m.email || "Member") + (m.id === meId ? " (me)" : "")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => title.trim() && add.mutate()}
          disabled={!title.trim() || add.isPending}
          className="bg-gradient-primary text-primary-foreground border-0"
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-3">
          <TaskRows
            rows={active}
            members={members}
            memberMap={memberMap}
            meId={meId}
            onToggle={(id, c) => toggle.mutate({ id, completed: c })}
            onDelete={(id) => del.mutate(id)}
            onUpdate={(v) => update.mutate(v)}
          />
        </TabsContent>
        <TabsContent value="completed" className="mt-3">
          <TaskRows
            rows={completed}
            members={members}
            memberMap={memberMap}
            meId={meId}
            onToggle={(id, c) => toggle.mutate({ id, completed: c })}
            onDelete={(id) => del.mutate(id)}
            onUpdate={(v) => update.mutate(v)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}


function ActiveTaskSummary({
  tasks,
  memberMap,
  onChanged,
}: {
  tasks: any[];
  memberMap: Map<string, FamilyMember>;
  onChanged: () => void;
}) {

  const [showToday, setShowToday] = useState(true);
  const [showWeek, setShowWeek] = useState(true);
  const [showLong, setShowLong] = useState(true);

  const toggle = useMutation({
    mutationFn: (t: { id: string; completed: boolean }) => toggleHomeTask({ data: t }),
    onSuccess: onChanged,
    onError: (e) => toast.error((e as Error).message),
  });

  const { today, thisWeek, longTerm } = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endToday = new Date(startToday.getTime() + 24 * 60 * 60 * 1000);
    const endWeek = new Date(startToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const today: any[] = [];
    const thisWeek: any[] = [];
    const longTerm: any[] = [];

    for (const t of tasks) {
      if (t.completed) continue;
      if (!t.due_date) {
        longTerm.push(t);
        continue;
      }
      // Parse as local date (YYYY-MM-DD)
      const [y, m, d] = t.due_date.split("-").map(Number);
      const due = new Date(y, m - 1, d);
      if (due < endToday) today.push(t);
      else if (due < endWeek) thisWeek.push(t);
      else longTerm.push(t);
    }
    const sortFn = (a: any, b: any) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    today.sort(sortFn);
    thisWeek.sort(sortFn);
    longTerm.sort(sortFn);
    return { today, thisWeek, longTerm };
  }, [tasks]);

  const totalActive = today.length + thisWeek.length + longTerm.length;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-semibold">Active tasks</h2>
          <p className="text-xs text-muted-foreground">
            {totalActive === 0 ? "No active tasks yet." : `${totalActive} active across the home`}
          </p>
        </div>
      </div>

      <SummaryGroup
        label="Due today"
        count={today.length}
        show={showToday}
        onToggle={setShowToday}
        tasks={today}
        memberMap={memberMap}
        onCheck={(id, c) => toggle.mutate({ id, completed: c })}
      />
      <SummaryGroup
        label="Due this week"
        count={thisWeek.length}
        show={showWeek}
        onToggle={setShowWeek}
        tasks={thisWeek}
        memberMap={memberMap}
        onCheck={(id, c) => toggle.mutate({ id, completed: c })}
      />
      <SummaryGroup
        label="Medium to long term"
        count={longTerm.length}
        show={showLong}
        onToggle={setShowLong}
        tasks={longTerm}
        memberMap={memberMap}
        onCheck={(id, c) => toggle.mutate({ id, completed: c })}
      />
    </div>
  );
}


function SummaryGroup({
  label,
  count,
  show,
  onToggle,
  tasks,
  memberMap,
  onCheck,
}: {
  label: string;
  count: number;
  show: boolean;
  onToggle: (v: boolean) => void;
  tasks: any[];
  memberMap: Map<string, FamilyMember>;
  onCheck: (id: string, completed: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          {show ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">({count})</span>
        </div>
        <Switch checked={show} onCheckedChange={onToggle} aria-label={`Show ${label}`} />
      </div>
      {show && (
        <div className="px-3 pb-3">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
              Nothing here yet.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {tasks.map((t) => {
                const assignee = t.assignee_id ? memberMap.get(t.assignee_id) : null;
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/60 px-3 py-2"
                  >
                    <Checkbox
                      checked={t.completed}
                      onCheckedChange={(v) => onCheck(t.id, !!v)}
                      aria-label="Toggle complete"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{t.title}</div>
                      {assignee && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3" />
                          {assignee.display_name || assignee.email}
                        </div>
                      )}
                    </div>
                    {t.due_date && (
                      <div className="text-[11px] text-accent font-medium whitespace-nowrap">
                        {formatDueDate(t.due_date)}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function formatDueDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, day);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


type UpdatePayload = {
  id: string;
  title: string;
  timeframe: string | null;
  dueDate: string | null;
  assigneeId: string | null;
};

function TaskRows({
  rows,
  members,
  memberMap,
  meId,
  onToggle,
  onDelete,
  onUpdate,
}: {
  rows: any[];
  members: FamilyMember[];
  memberMap: Map<string, FamilyMember>;
  meId: string;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (v: UpdatePayload) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
        Nothing here yet.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((t) => {
        const assignee = t.assignee_id ? memberMap.get(t.assignee_id) : null;
        if (editingId === t.id) {
          return (
            <li key={t.id} className="rounded-xl border border-border/60 bg-background/40 px-3 py-3">
              <TaskEditRow
                task={t}
                members={members}
                meId={meId}
                onCancel={() => setEditingId(null)}
                onSave={(v) => {
                  onUpdate(v);
                  setEditingId(null);
                }}
              />
            </li>
          );
        }
        return (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
          >
            <Checkbox
              checked={t.completed}
              onCheckedChange={(v) => onToggle(t.id, !!v)}
              aria-label="Toggle complete"
            />
            <div className="min-w-0 flex-1">
              <div className={`text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {t.timeframe && (
                  <div className="text-[11px] text-accent font-medium">{t.timeframe}</div>
                )}
                {t.due_date && (
                  <div className="text-[11px] text-accent font-medium">{formatDueDate(t.due_date)}</div>
                )}
                {assignee && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {assignee.display_name || assignee.email}
                  </div>
                )}
              </div>
            </div>
            {t.completed && <Check className="h-4 w-4 text-green-500" />}
            <Button variant="ghost" size="icon" onClick={() => setEditingId(t.id)} aria-label="Edit task">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)} aria-label="Delete task">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function TaskEditRow({
  task,
  members,
  meId,
  onCancel,
  onSave,
}: {
  task: any;
  members: FamilyMember[];
  meId: string;
  onCancel: () => void;
  onSave: (v: UpdatePayload) => void;
}) {
  const [title, setTitle] = useState<string>(task.title ?? "");
  const [timeframe, setTimeframe] = useState<string>(task.timeframe ?? "");
  const [dueDate, setDueDate] = useState<string>(task.due_date ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(task.assignee_id ?? UNASSIGNED);

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <SmartField value={title} onChange={setTitle} placeholder="Task title" className="flex-1" />
      <SmartField
        value={timeframe}
        onChange={setTimeframe}
        placeholder="Timeframe"
        className="sm:w-56"
      />
      <Input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="sm:w-44"
        aria-label="Due date"
      />
      <Select value={assigneeId} onValueChange={setAssigneeId}>
        <SelectTrigger className="sm:w-48" aria-label="Assign to">
          <SelectValue placeholder="Assign to…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned (me)</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {(m.display_name || m.email || "Member") + (m.id === meId ? " (me)" : "")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button
          onClick={() =>
            title.trim() &&
            onSave({
              id: task.id,
              title: title.trim(),
              timeframe: timeframe.trim() || null,
              dueDate: dueDate || null,
              assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
            })
          }
          disabled={!title.trim()}
          className="bg-gradient-primary text-primary-foreground border-0"
        >
          <Check className="h-4 w-4" /> Save
        </Button>
        <Button variant="ghost" onClick={onCancel} aria-label="Cancel edit">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

