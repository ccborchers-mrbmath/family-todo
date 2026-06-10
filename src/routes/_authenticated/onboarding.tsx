import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFamily } from "@/lib/family.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const mut = useMutation({
    mutationFn: (data: { name: string }) => createFamily({ data }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      router.navigate({ to: "/dashboard", replace: true });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/70 backdrop-blur p-8 shadow-glow">
        <div className="flex items-center gap-2 justify-center mb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Kinquest</span>
        </div>
        <h1 className="text-2xl font-display font-bold text-center">Create your family</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          You'll be the parent. Next step you can invite your kids by their Google email.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            mut.mutate({ name: name.trim() });
          }}
        >
          <div>
            <Label htmlFor="family-name">Family name</Label>
            <Input
              id="family-name"
              autoFocus
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="The Murphys"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-gradient-primary text-primary-foreground border-0 shadow-pop"
            size="lg"
            disabled={mut.isPending || !name.trim()}
          >
            {mut.isPending ? "Creating…" : "Create family"}
          </Button>
        </form>
      </div>
    </div>
  );
}
