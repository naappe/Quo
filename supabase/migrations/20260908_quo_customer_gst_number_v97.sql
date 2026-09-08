alter table public.quo_documents
  add column if not exists customer_gst_number text;

comment on column public.quo_documents.customer_gst_number is
  'Customer or organisation GST/TIN number printed on commercial documents. This is identification only and does not control seller GST calculation.';

create or replace function public.quo_copy_customer_gst_from_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.customer_gst_number,'')),'') is null
     and new.source_document_id is not null then
    select d.customer_gst_number
      into new.customer_gst_number
      from public.quo_documents d
     where d.id = new.source_document_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quo_copy_customer_gst_from_source on public.quo_documents;
create trigger trg_quo_copy_customer_gst_from_source
before insert or update of source_document_id, customer_gst_number
on public.quo_documents
for each row
execute function public.quo_copy_customer_gst_from_source();
