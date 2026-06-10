import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, CheckCircle2, ShieldCheck, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kinquest — Family chores, leveled up" },
      {
        name: "description",
        content:
          "A family task & chore manager built for parents and teens. Set routines, check them off, celebrate the wins.",
      },
      { property: "og:title", content: "Kinquest — Family chores, leveled up" },
      {
        property: "og:description",
        content: "Set routines, check them off, celebrate the wins. Built for parents and teens.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Kinquest</span>
        </div>
        <Button asChild variant="ghost">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-10 pb-20">
        <section className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-lime animate-pulse" />
            Family management, leveled up
          </span>
          <h1 className="mt-6 text-5xl md:text-7xl font-display font-bold tracking-tight leading-[1.05]">
            Chores your{" "}
            <span className="text-gradient-primary">teens actually</span> check off.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            Set daily and weekly routines, assign one-off tasks, and verify the wins.
            Confetti included.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground border-0 shadow-pop hover:opacity-90">
              <Link to="/auth">Get started — it's free</Link>
            </Button>
          </div>
        </section>

        <section className="mt-24 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Repeat,
              title: "Flexible recurrence",
              body: "Daily, weekly by weekday, monthly, or every N days. Whatever the rhythm.",
              grad: "bg-gradient-primary",
            },
            {
              icon: CheckCircle2,
              title: "Satisfying check-off",
              body: "Big tap target, spring animation, confetti. It feels good to finish.",
              grad: "bg-gradient-cool",
            },
            {
              icon: ShieldCheck,
              title: "Parent verifies",
              body: "When they tick it, you see it. Approve, or send it back with a note.",
              grad: "bg-gradient-energy",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur p-6 hover:-translate-y-0.5 transition-transform"
            >
              <div className={`grid h-12 w-12 place-items-center rounded-2xl ${f.grad} shadow-pop`}>
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="mt-4 text-xl font-bold font-display">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
