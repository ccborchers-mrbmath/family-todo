import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecurrenceConfig, RecurrenceType } from "@/lib/recurrence";

const TYPES: { v: RecurrenceType; label: string }[] = [
  { v: "once", label: "Once" },
  { v: "daily", label: "Daily" },
  { v: "weekly", label: "Weekly" },
  { v: "monthly", label: "Monthly" },
  { v: "custom", label: "Custom" },
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  type: RecurrenceType;
  config: RecurrenceConfig;
  onChange: (type: RecurrenceType, config: RecurrenceConfig) => void;
}

export function RecurrenceEditor({ type, config, onChange }: Props) {
  function toggleWeekday(d: number) {
    const cur = new Set(config.weekdays ?? []);
    if (cur.has(d)) cur.delete(d);
    else cur.add(d);
    onChange(type, { ...config, weekdays: Array.from(cur).sort() });
  }

  return (
    <div className="space-y-3">
      <Label>Recurrence</Label>
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Button
            key={t.v}
            type="button"
            variant={type === t.v ? "default" : "secondary"}
            size="sm"
            className={cn(type === t.v && "bg-gradient-primary text-primary-foreground border-0")}
            onClick={() => onChange(t.v, {})}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {type === "weekly" && (
        <div className="flex gap-2">
          {WEEKDAYS.map((d, i) => {
            const active = (config.weekdays ?? []).includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleWeekday(i)}
                className={cn(
                  "h-10 w-10 rounded-full font-semibold text-sm transition-all",
                  active
                    ? "bg-gradient-primary text-primary-foreground shadow-pop"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      )}

      {type === "monthly" && (
        <div className="max-w-[140px]">
          <Label className="text-xs text-muted-foreground">Day of month</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={config.dayOfMonth ?? ""}
            onChange={(e) => onChange(type, { ...config, dayOfMonth: Number(e.target.value) || undefined })}
          />
        </div>
      )}

      {type === "custom" && (
        <div className="max-w-[180px]">
          <Label className="text-xs text-muted-foreground">Every N days</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={config.intervalDays ?? ""}
            onChange={(e) => onChange(type, { ...config, intervalDays: Number(e.target.value) || undefined })}
          />
        </div>
      )}
    </div>
  );
}
