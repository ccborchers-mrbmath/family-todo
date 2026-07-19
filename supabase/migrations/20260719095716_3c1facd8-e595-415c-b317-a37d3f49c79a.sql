
ALTER TABLE public.home_management_tasks
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS home_management_tasks_assignee_idx ON public.home_management_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS home_management_tasks_linked_task_idx ON public.home_management_tasks(linked_task_id);

CREATE OR REPLACE FUNCTION public.sync_home_task_from_instance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.home_management_tasks
      SET completed = true, completed_at = now()
      WHERE linked_task_id = NEW.task_id AND completed = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_home_task_from_instance ON public.task_instances;
CREATE TRIGGER sync_home_task_from_instance
AFTER UPDATE ON public.task_instances
FOR EACH ROW EXECUTE FUNCTION public.sync_home_task_from_instance();
