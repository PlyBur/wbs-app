-- Fix RLS policies on project_interactions and project_expenses.
-- The original migration 003 used the wrong pattern (team_members lookup)
-- instead of the owner_id pattern used by all other tables.

-- project_interactions
drop policy if exists "Project interactions workspace access" on project_interactions;
create policy "Project interactions workspace access" on project_interactions
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- project_expenses
drop policy if exists "Project expenses workspace access" on project_expenses;
create policy "Project expenses workspace access" on project_expenses
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
