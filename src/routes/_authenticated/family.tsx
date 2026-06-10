import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Trash2, UserPlus, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listFamilyData, inviteKid, deleteInvite, getMe } from "@/lib/family.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({ meta: [{ title: "Family · Kinquest" }] }),
  component: FamilyPage,
});

function FamilyPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const { data } = useQuery({ queryKey: ["family"], queryFn: () => listFamilyData() });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const invite = useMutation({
    mutationFn: () => inviteKid({ data: { email, displayName: name } }),
    onSuccess: () => {
      toast.success("Invite saved. They'll be linked when they sign in with Google.");
      setEmail(""); setName("");
      qc.invalidateQueries({ queryKey: ["family"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteInvite({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["family"] }),
  });

  const isParent = me?.role === "parent";

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Family</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data?.members.length ?? 0} member{(data?.members.length ?? 0) === 1 ? "" : "s"}
        </p>
      </div>

      <section className="grid gap-3">
        {(data?.members ?? []).map((m) => (
          <div key={m.id} className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary font-bold text-primary-foreground">
              {m.display_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{m.display_name}</div>
              <div className="text-xs text-muted-foreground truncate">{m.email}</div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-secondary text-muted-foreground">
              {m.role}
            </span>
          </div>
        ))}
      </section>

      {isParent && (
        <>
          <section className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 font-display font-bold">
              <UserPlus className="h-5 w-5 text-accent" /> Invite a kid
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the exact Google email they'll sign in with. When they sign in, they're auto-linked as a kid in your family.
            </p>
            <form
              className="grid sm:grid-cols-[1fr_1fr_auto] gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (email && name) invite.mutate();
              }}
            >
              <div>
                <Label htmlFor="kn" className="text-xs">Display name</Label>
                <Input id="kn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" maxLength={60} />
              </div>
              <div>
                <Label htmlFor="ke" className="text-xs">Google email</Label>
                <Input id="ke" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sam@gmail.com" />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={invite.isPending || !email || !name} className="bg-gradient-primary text-primary-foreground border-0 shadow-pop">
                  Invite
                </Button>
              </div>
            </form>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Invites</h2>
            <div className="space-y-2">
              {(data?.invites ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground">No pending invites.</div>
              )}
              {(data?.invites ?? []).map((i) => (
                <div key={i.id} className="rounded-xl border border-border/60 bg-card/60 p-3 flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{i.display_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{i.email}</div>
                  </div>
                  {i.claimed_at ? (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> claimed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> pending
                    </span>
                  )}
                  {!i.claimed_at && (
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(i.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
