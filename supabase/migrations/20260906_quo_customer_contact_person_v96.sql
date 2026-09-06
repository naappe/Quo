alter table public.quo_documents
  add column if not exists customer_contact_name text;

comment on column public.quo_documents.customer_contact_name is
  'Per-document contact person for the customer or organisation. Kept separate because one organisation may have different requesters.';
