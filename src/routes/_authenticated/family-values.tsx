import { createFileRoute } from "@tanstack/react-router";
import { FamilyValuesView } from "@/components/FamilyValuesEditor";

export const Route = createFileRoute("/_authenticated/family-values")({
  head: () => ({ meta: [{ title: "Family Values · Kinquest" }] }),
  component: () => (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Family Values</h1>
        <p className="text-sm text-muted-foreground mt-1">The values and rules of our house.</p>
      </div>
      <FamilyValuesView editable={false} />
    </div>
  ),
});
