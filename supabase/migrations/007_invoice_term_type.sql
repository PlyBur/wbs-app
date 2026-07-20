-- Migration 007: Track which payment term an invoice belongs to
-- term_type: 'deposit' | 'progress' | 'final' | null (null = full/regular invoice)
alter table invoices add column if not exists term_type text;
alter table invoices add column if not exists term_label text;
