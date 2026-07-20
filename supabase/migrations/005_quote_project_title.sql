-- Add project_title to quotes so descriptive names flow through to projects
alter table quotes add column if not exists project_title text;
