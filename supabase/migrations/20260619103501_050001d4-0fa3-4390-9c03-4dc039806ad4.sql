-- Add per-instance reward override and update reward trigger to use it
ALTER TABLE public.task_instances
  ADD COLUMN IF NOT EXISTS reward_override numeric(10,2);

CREATE OR REPLACE FUNCTION public.handle_task_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reward numeric(10,2);
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT COALESCE(NEW.reward_override, t.reward_amount)
      INTO v_reward
      FROM public.tasks t
      WHERE t.id = NEW.task_id;
    IF v_reward IS NOT NULL AND v_reward > 0 THEN
      INSERT INTO public.account_transactions
        (family_id, child_id, type, amount, note, source, status, occurred_on, task_instance_id, created_by, reviewed_by, reviewed_at)
      VALUES
        (NEW.family_id, NEW.assignee_id, 'income', v_reward,
         'Reward: ' || (SELECT title FROM public.tasks WHERE id = NEW.task_id),
         'task_reward', 'approved', CURRENT_DATE, NEW.id,
         COALESCE(NEW.verifier_id, NEW.assignee_id), NEW.verifier_id, now())
      ON CONFLICT (task_instance_id) WHERE task_instance_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;
  IF NEW.status <> 'approved' AND OLD.status = 'approved' THEN
    DELETE FROM public.account_transactions
      WHERE task_instance_id = NEW.id AND source = 'task_reward';
  END IF;
  RETURN NEW;
END;
$function$;