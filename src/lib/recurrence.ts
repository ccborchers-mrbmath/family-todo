// Pure helpers for expanding recurrence into concrete due-dates.
// Client-safe (no server-only imports).

export type RecurrenceType = "once" | "daily" | "weekly" | "monthly" | "custom";

export interface RecurrenceConfig {
  weekdays?: number[]; // 0=Sun .. 6=Sat
  dayOfMonth?: number; // 1..31
  intervalDays?: number; // for custom
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export function expandOccurrences(
  type: RecurrenceType,
  config: RecurrenceConfig,
  startDate: string,
  endDate: string | null,
  windowFrom: string,
  windowTo: string,
): string[] {
  const start = parseISODate(startDate);
  const hardEnd = endDate ? parseISODate(endDate) : null;
  const from = parseISODate(windowFrom);
  const to = parseISODate(windowTo);

  const lo = start > from ? start : from;
  const hi = hardEnd && hardEnd < to ? hardEnd : to;
  if (lo > hi) return [];

  const results: string[] = [];

  if (type === "once") {
    if (start >= lo && start <= hi) results.push(toISODate(start));
    return results;
  }

  if (type === "daily") {
    for (let d = new Date(lo); d <= hi; d = addDays(d, 1)) results.push(toISODate(d));
    return results;
  }

  if (type === "weekly") {
    const weekdays = config.weekdays ?? [];
    if (weekdays.length === 0) return results;
    for (let d = new Date(lo); d <= hi; d = addDays(d, 1)) {
      if (weekdays.includes(d.getUTCDay())) results.push(toISODate(d));
    }
    return results;
  }

  if (type === "monthly") {
    const dom = config.dayOfMonth ?? start.getUTCDate();
    for (let d = new Date(lo); d <= hi; d = addDays(d, 1)) {
      if (d.getUTCDate() === dom) results.push(toISODate(d));
    }
    return results;
  }

  if (type === "custom") {
    const interval = Math.max(1, config.intervalDays ?? 1);
    // step from start
    let d = new Date(start);
    while (d < lo) d = addDays(d, interval);
    while (d <= hi) {
      results.push(toISODate(d));
      d = addDays(d, interval);
    }
    return results;
  }

  return results;
}

export function describeRecurrence(type: RecurrenceType, config: RecurrenceConfig): string {
  switch (type) {
    case "once":
      return "One time";
    case "daily":
      return "Every day";
    case "weekly": {
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const days = (config.weekdays ?? []).map((d) => names[d]).join(", ");
      return days ? `Weekly · ${days}` : "Weekly";
    }
    case "monthly":
      return `Monthly · day ${config.dayOfMonth ?? "?"}`;
    case "custom":
      return `Every ${config.intervalDays ?? 1} day${(config.intervalDays ?? 1) > 1 ? "s" : ""}`;
  }
}
