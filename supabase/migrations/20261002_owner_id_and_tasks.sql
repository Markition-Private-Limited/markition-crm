-- Add owner_id to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON public.projects(owner_id);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  description   text,
  project_id    uuid        REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  assignee      text,
  created_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  priority      text        NOT NULL DEFAULT 'Medium',
  due_date      date,
  status        text        NOT NULL DEFAULT 'Open',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_project_id_idx  ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS tasks_status_idx      ON public.tasks(status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_authenticated_all" ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
