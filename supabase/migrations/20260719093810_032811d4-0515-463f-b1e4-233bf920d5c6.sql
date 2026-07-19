
CREATE TABLE public.home_management_visions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, section_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_management_visions TO authenticated;
GRANT ALL ON public.home_management_visions TO service_role;
ALTER TABLE public.home_management_visions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents in family can read visions" ON public.home_management_visions
  FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Parents in family can insert visions" ON public.home_management_visions
  FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Parents in family can update visions" ON public.home_management_visions
  FOR UPDATE TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'))
  WITH CHECK (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Parents in family can delete visions" ON public.home_management_visions
  FOR DELETE TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE TRIGGER trg_home_visions_updated BEFORE UPDATE ON public.home_management_visions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.home_management_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  title text NOT NULL,
  timeframe text,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_management_tasks TO authenticated;
GRANT ALL ON public.home_management_tasks TO service_role;
ALTER TABLE public.home_management_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents in family can read hm tasks" ON public.home_management_tasks
  FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Parents in family can insert hm tasks" ON public.home_management_tasks
  FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Parents in family can update hm tasks" ON public.home_management_tasks
  FOR UPDATE TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'))
  WITH CHECK (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Parents in family can delete hm tasks" ON public.home_management_tasks
  FOR DELETE TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE TRIGGER trg_home_tasks_updated BEFORE UPDATE ON public.home_management_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_home_visions_family ON public.home_management_visions(family_id, section_key);
CREATE INDEX idx_home_tasks_family_section ON public.home_management_tasks(family_id, section_key);
