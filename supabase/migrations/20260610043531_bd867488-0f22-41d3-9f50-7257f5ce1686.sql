
-- Enums
CREATE TYPE public.app_role AS ENUM ('parent', 'kid');
CREATE TYPE public.recurrence_type AS ENUM ('once', 'daily', 'weekly', 'monthly', 'custom');
CREATE TYPE public.instance_status AS ENUM ('pending', 'submitted', 'approved', 'rejected');

-- Families
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- get_my_family_id helper
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT family_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Family invites
CREATE TABLE public.family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'kid',
  claimed_at TIMESTAMPTZ,
  claimed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, email)
);
CREATE INDEX ON public.family_invites (lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_invites TO authenticated;
GRANT ALL ON public.family_invites TO service_role;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  recurrence_type public.recurrence_type NOT NULL DEFAULT 'once',
  recurrence_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.tasks (family_id, assignee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Task instances
CREATE TABLE public.task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  status public.instance_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verifier_id UUID REFERENCES auth.users(id),
  reject_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, due_date)
);
CREATE INDEX ON public.task_instances (family_id, due_date);
CREATE INDEX ON public.task_instances (assignee_id, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_instances TO authenticated;
GRANT ALL ON public.task_instances TO service_role;
ALTER TABLE public.task_instances ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- New user trigger: create profile, claim invite if email matches
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.family_invites%ROWTYPE;
  v_display_name TEXT;
  v_avatar TEXT;
  v_email TEXT;
BEGIN
  v_email := lower(NEW.email);
  v_display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_avatar := NEW.raw_user_meta_data->>'avatar_url';

  SELECT * INTO v_invite FROM public.family_invites
    WHERE lower(email) = v_email AND claimed_at IS NULL
    ORDER BY created_at ASC LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.profiles (id, family_id, display_name, email, avatar_url)
      VALUES (NEW.id, v_invite.family_id, COALESCE(v_invite.display_name, v_display_name), NEW.email, v_avatar);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_invite.role);
    UPDATE public.family_invites SET claimed_at = now(), claimed_by = NEW.id WHERE id = v_invite.id;
  ELSE
    INSERT INTO public.profiles (id, display_name, email, avatar_url)
      VALUES (NEW.id, v_display_name, NEW.email, v_avatar);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES

-- families: members read; user can insert family they create
CREATE POLICY "Members read family" ON public.families FOR SELECT TO authenticated
  USING (id = public.get_my_family_id());
CREATE POLICY "Create own family" ON public.families FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Parents update family" ON public.families FOR UPDATE TO authenticated
  USING (id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));

-- profiles: read own family, update own
CREATE POLICY "Read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR family_id = public.get_my_family_id());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
-- INSERT happens via trigger as security definer

-- user_roles: read own and family members
CREATE POLICY "Read roles in family" ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.family_id = public.get_my_family_id())
  );

-- family_invites: parents in same family manage
CREATE POLICY "Parents read invites" ON public.family_invites FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Parents create invites" ON public.family_invites FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Parents delete invites" ON public.family_invites FOR DELETE TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));

-- tasks: family members read; parents manage
CREATE POLICY "Family reads tasks" ON public.tasks FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());
CREATE POLICY "Parents insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent') AND created_by = auth.uid());
CREATE POLICY "Parents update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Parents delete tasks" ON public.tasks FOR DELETE TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));

-- task_instances: family reads; kids submit own; parents verify
CREATE POLICY "Family reads instances" ON public.task_instances FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());
CREATE POLICY "Insert instances in family" ON public.task_instances FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id());
CREATE POLICY "Kids submit own; parents verify" ON public.task_instances FOR UPDATE TO authenticated
  USING (
    family_id = public.get_my_family_id() AND (
      (assignee_id = auth.uid())
      OR public.has_role(auth.uid(), 'parent')
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_instances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
