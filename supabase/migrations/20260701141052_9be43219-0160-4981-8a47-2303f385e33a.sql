
-- push_devices: one row per browser/device the user has enabled notifications on
CREATE TABLE public.push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  fcm_token TEXT NOT NULL UNIQUE,
  platform TEXT,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX push_devices_user_id_idx ON public.push_devices(user_id);
CREATE INDEX push_devices_family_id_idx ON public.push_devices(family_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own devices"
  ON public.push_devices FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Parents can view family devices"
  ON public.push_devices FOR SELECT
  TO authenticated
  USING (
    family_id IS NOT NULL
    AND family_id = public.get_my_family_id()
    AND public.has_role(auth.uid(), 'parent')
  );

-- notification_prefs: per-user notification preferences
CREATE TABLE public.notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  task_events BOOLEAN NOT NULL DEFAULT true,
  reward_events BOOLEAN NOT NULL DEFAULT true,
  encouragement_events BOOLEAN NOT NULL DEFAULT true,
  spend_events BOOLEAN NOT NULL DEFAULT true,
  paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prefs"
  ON public.notification_prefs FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER notification_prefs_touch
  BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
