
-- 1) Lock down user_roles writes (prevent self-privilege escalation)
-- RLS denies by default when no policy permits, but add explicit restrictive policies for clarity & defense-in-depth.
CREATE POLICY "Block role inserts from clients"
  ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Block role updates from clients"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Block role deletes from clients"
  ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);

-- 2) Tighten EXECUTE on SECURITY DEFINER helpers — restrict to authenticated only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_family_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_family_id() TO authenticated, service_role;

-- handle_new_user / handle_task_reward / touch_updated_at are trigger functions; revoke direct execute.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_task_reward() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- 3) Realtime authorization: restrict realtime.messages subscriptions to authenticated users
-- whose family owns the topic. We use topic format "family:<family_id>" going forward,
-- but also permit table-change topics scoped by family via realtime.topic().
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own family realtime" ON realtime.messages;
CREATE POLICY "Authenticated can read own family realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() = 'family:' || COALESCE(public.get_my_family_id()::text, '')
  );
