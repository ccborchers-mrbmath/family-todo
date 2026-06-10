import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/family.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
  });

  useEffect(() => {
    if (!data) return;
    const onOnboarding = router.state.location.pathname === "/onboarding";
    if (!data.family && !onOnboarding) {
      router.navigate({ to: "/onboarding", replace: true });
    }
  }, [data, router]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!data.family) {
    // onboarding renders standalone (no shell)
    return <Outlet />;
  }

  return (
    <AppShell role={data.role as "parent" | "kid" | null} displayName={data.profile?.display_name ?? ""}>
      <Outlet />
    </AppShell>
  );
}
