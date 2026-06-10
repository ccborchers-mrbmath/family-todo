
-- 1. Add reward_amount to tasks
ALTER TABLE public.tasks ADD COLUMN reward_amount numeric(10,2) NOT NULL DEFAULT 0;

-- 2. Account transactions
CREATE TYPE public.txn_type AS ENUM ('income', 'expense');
CREATE TYPE public.txn_source AS ENUM ('manual', 'task_reward', 'recurring', 'request');
CREATE TYPE public.txn_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.account_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL,
  type public.txn_type NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  note text,
  source public.txn_source NOT NULL DEFAULT 'manual',
  status public.txn_status NOT NULL DEFAULT 'approved',
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  task_instance_id uuid REFERENCES public.task_instances(id) ON DELETE SET NULL,
  recurring_id uuid,
  created_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_txn_per_task_instance ON public.account_transactions(task_instance_id) WHERE task_instance_id IS NOT NULL;
CREATE INDEX idx_txn_child ON public.account_transactions(child_id, occurred_on DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transactions TO authenticated;
GRANT ALL ON public.account_transactions TO service_role;

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

-- Anyone in the family can read; child can only see their own
CREATE POLICY "Family members read own/child transactions" ON public.account_transactions
  FOR SELECT TO authenticated
  USING (
    family_id = public.get_my_family_id()
    AND (public.has_role(auth.uid(), 'parent') OR child_id = auth.uid())
  );

-- Parents full write
CREATE POLICY "Parents manage transactions" ON public.account_transactions
  FOR ALL TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'))
  WITH CHECK (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));

-- Kids can insert pending expense requests for themselves
CREATE POLICY "Kid creates own expense request" ON public.account_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id = public.get_my_family_id()
    AND child_id = auth.uid()
    AND type = 'expense'
    AND source = 'request'
    AND status = 'pending'
  );

-- 3. Recurring pocket money
CREATE TYPE public.pm_recurrence AS ENUM ('weekly', 'monthly');

CREATE TABLE public.recurring_pocket_money (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  note text,
  recurrence public.pm_recurrence NOT NULL,
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month int CHECK (day_of_month BETWEEN 1 AND 31),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  last_run_on date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_pocket_money TO authenticated;
GRANT ALL ON public.recurring_pocket_money TO service_role;

ALTER TABLE public.recurring_pocket_money ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family read pocket money" ON public.recurring_pocket_money
  FOR SELECT TO authenticated
  USING (
    family_id = public.get_my_family_id()
    AND (public.has_role(auth.uid(), 'parent') OR child_id = auth.uid())
  );

CREATE POLICY "Parents manage pocket money" ON public.recurring_pocket_money
  FOR ALL TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'))
  WITH CHECK (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));

-- 4. Trigger: when a task_instance is approved and reward > 0, create an income txn
CREATE OR REPLACE FUNCTION public.handle_task_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward numeric(10,2);
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT reward_amount INTO v_reward FROM public.tasks WHERE id = NEW.task_id;
    IF v_reward IS NOT NULL AND v_reward > 0 THEN
      INSERT INTO public.account_transactions
        (family_id, child_id, type, amount, note, source, status, occurred_on, task_instance_id, created_by, reviewed_by, reviewed_at)
      VALUES
        (NEW.family_id, NEW.assignee_id, 'income', v_reward,
         'Reward: ' || (SELECT title FROM public.tasks WHERE id = NEW.task_id),
         'task_reward', 'approved', CURRENT_DATE, NEW.id,
         COALESCE(NEW.verifier_id, NEW.assignee_id), NEW.verifier_id, now())
      ON CONFLICT (task_instance_id) DO NOTHING;
    END IF;
  END IF;
  -- if it gets un-approved (rejected after approval), remove the reward
  IF NEW.status <> 'approved' AND OLD.status = 'approved' THEN
    DELETE FROM public.account_transactions
      WHERE task_instance_id = NEW.id AND source = 'task_reward';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_reward
AFTER UPDATE ON public.task_instances
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_reward();
