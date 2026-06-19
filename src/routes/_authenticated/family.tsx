import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Trash2, UserPlus, CheckCircle2, Clock, FlaskConical, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listFamilyData, inviteKid, deleteInvite, getMe, removeKid, resetKid } from "@/lib/family.functions";
import { createTestKids } from "@/lib/test-accounts.functions";
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

  const remove = useMutation({
    mutationFn: (id: string) => removeKid({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed from family.");
      qc.invalidateQueries({ queryKey: ["family"] });
      qc.invalidateQueries({ queryKey: ["instances"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const reset = useMutation({
    mutationFn: (id: string) => resetKid({ data: { id } }),
    onSuccess: () => {
      toast.success("Fresh start — tasks and rewards cleared.");
      qc.invalidateQueries({ queryKey: ["family"] });
      qc.invalidateQueries({ queryKey: ["instances"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [testCreds, setTestCreds] = useState<{ name: string; email: string; password: string }[] | null>(null);
  const makeTestKids = useMutation({
    mutationFn: () => createTestKids(),
    onSuccess: (res) => {
      setTestCreds(res.kids);
      toast.success("Two test kid accounts created.");
      qc.invalidateQueries({ queryKey: ["family"] });
    },
    onError: (e) => toast.error((e as Error).message),
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
            {isParent && m.role === "kid" && m.id !== me?.profile?.id && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Reset ${m.display_name}`}
                  disabled={reset.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        `Reset ${m.display_name} for a fresh start?\n\nThis clears all their tasks, completed history, account balance, and recurring allowance. They stay in the family.`,
                      )
                    ) {
                      reset.mutate(m.id);
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4 text-accent" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${m.display_name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        `Remove ${m.display_name} from the family?\n\nThis deletes their tasks, account ledger, and recurring allowance. Their sign-in account is kept and can be re-invited later.`,
                      )
                    ) {
                      remove.mutate(m.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
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

          <section className="rounded-3xl border border-dashed border-accent/40 bg-accent/5 p-5 space-y-3">
            <div className="flex items-center gap-2 font-display font-bold">
              <FlaskConical className="h-5 w-5 text-accent" /> Test child accounts
            </div>
            <p className="text-xs text-muted-foreground">
              Creates two ready-to-use kid accounts linked to your family. Sign in as them in a separate browser or incognito window via the "Use test account" link on the sign-in page to see the kid experience in real time.
            </p>
            <Button
              onClick={() => makeTestKids.mutate()}
              disabled={makeTestKids.isPending}
              className="bg-gradient-cool text-primary-foreground border-0"
            >
              {makeTestKids.isPending ? "Creating…" : "Create two test kids"}
            </Button>

            {testCreds && (
              <div className="mt-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Save these now — passwords are not shown again
                </div>
                {testCreds.map((c) => {
                  const line = `${c.email} / ${c.password}`;
                  return (
                    <div key={c.email} className="rounded-xl border border-border/60 bg-card p-3 text-sm">
                      <div className="font-semibold">{c.name}</div>
                      <div className="font-mono text-xs break-all mt-1">{c.email}</div>
                      <div className="font-mono text-xs break-all">pw: {c.password}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(line);
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
