import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Sign in · Kinquest" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/dashboard", replace: true });
    });
  }, [router]);

  async function signInGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Sign in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/70 backdrop-blur p-8 shadow-glow">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Kinquest</span>
        </Link>
        <h1 className="text-2xl font-display font-bold text-center">Sign in to your family</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Use the Google account your parent invited (or your own to start a family).
        </p>
        <Button
          onClick={signInGoogle}
          disabled={loading}
          className="mt-8 w-full bg-gradient-primary text-primary-foreground border-0 shadow-pop hover:opacity-90"
          size="lg"
        >
          {loading ? "Opening Google…" : "Continue with Google"}
        </Button>
      </div>
    </div>
  );
}
