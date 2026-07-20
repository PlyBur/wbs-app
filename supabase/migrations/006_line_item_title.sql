-- Migration 006: Add title column to line item tables
-- title = short label (what description was before)
-- description = multi-line detail (what notes was before)

alter table quote_line_items add column if not exists title text;
alter table invoice_line_items add column if not exists title text;

-- Backfill: copy existing description → title so old records still display correctly
update quote_line_items set title = description where title is null;
update invoice_line_items set title = description where title is null;
