-- Add VAT registered flag and logo URL to workspaces
alter table workspaces add column if not exists vat_registered boolean not null default true;
alter table workspaces add column if not exists logo_url text;

-- Create logos storage bucket (run this too)
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to logos bucket
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Logo upload' and tablename = 'objects') then
    create policy "Logo upload" on storage.objects for insert to authenticated with check (bucket_id = 'logos');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Logo public read' and tablename = 'objects') then
    create policy "Logo public read" on storage.objects for select using (bucket_id = 'logos');
  end if;
end $$;
