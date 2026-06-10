import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecurrenceEditor } from "@/components/RecurrenceEditor";
import { listFamilyData } from "@/lib/family.functions";
import { createTask } from "@/lib/tasks.functions";
import type { RecurrenceConfig, RecurrenceType } from "@/lib/recurrence";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  head: () => ({ meta: [{ title: "New task · Kinquest" }] }),
  component: NewTask,
});

function NewTask() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: family } = useQuery({ queryKey: ["family"], queryFn: () => listFamilyData() });
  const kids = (family?.members ?? []).filter((m) => m.role === "kid");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [rType, setRType] = useState<RecurrenceType>("daily");
  const [rConfig, setRConfig] = useState<RecurrenceConfig>({});
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      createTask({
        data: {
          title: title.trim(),
          description: description.trim() || null,
          assigneeId,
          recurrenceType: rType,
          recurrenceConfig: rConfig,
          startDate,
          endDate: endDate || null,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      await qc.invalidateQueries({ queryKey: ["instances"] });
      toast.success("Task created");
      router.navigate({ to: "/tasks" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSubmit = title.trim() && assigneeId && startDate;

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-display font-bold tracking-tight mb-6">New task</h1>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mut.mutate();
        }}
      >
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Empty the dishwasher" />
        </div>

        <div>
          <Label htmlFor="desc">Description (optional)</Label>
          <Textarea id="desc" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>

        <div>
          <Label>Assign to</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger>
              <SelectValue placeholder={kids.length ? "Pick a kid" : "Invite a kid first"} />
            </SelectTrigger>
            <SelectContent>
              {kids.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <RecurrenceEditor type={rType} config={rConfig} onChange={(t, c) => { setRType(t); setRConfig(c); }} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="start">Starts</Label>
            <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="end">Ends (optional)</Label>
            <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => router.navigate({ to: "/tasks" })}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit || mut.isPending}
            className="flex-1 bg-gradient-primary text-primary-foreground border-0 shadow-pop"
          >
            {mut.isPending ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </div>
  );
}
