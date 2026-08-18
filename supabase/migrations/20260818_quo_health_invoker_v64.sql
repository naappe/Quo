create or replace function public.quo_system_health()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.quo_is_active_user() then
    raise exception 'Active Quo user required';
  end if;

  select jsonb_build_object(
    'active_documents', (select count(*) from public.quo_documents where deleted_at is null),
    'active_customers', (select count(*) from public.quo_customers where is_active),
    'documents_without_customer', (select count(*) from public.quo_documents where deleted_at is null and nullif(trim(customer_name),'') is not null and customer_id is null),
    'confirmed_quotes_without_proforma', (
      select count(*) from public.quo_documents q
      where q.deleted_at is null and q.document_type='quotation' and q.status='Confirmed'
        and not exists (select 1 from public.quo_documents p where p.deleted_at is null and p.document_type='proforma' and p.source_document_id=q.id)
    ),
    'converted_proformas_without_invoice', (
      select count(*) from public.quo_documents p
      where p.deleted_at is null and p.document_type='proforma' and p.status='Converted'
        and not exists (select 1 from public.quo_documents i where i.deleted_at is null and i.document_type='invoice' and i.source_document_id=p.id)
    ),
    'receipts_without_invoice', (
      select count(*) from public.quo_documents r
      where r.deleted_at is null and r.document_type='receipt'
        and not exists (select 1 from public.quo_documents i where i.deleted_at is null and i.document_type='invoice' and i.id=r.source_document_id)
    ),
    'duplicate_active_deal_types', (
      select count(*) from (
        select deal_id, document_type
        from public.quo_documents
        where deleted_at is null and deal_id is not null and document_type in ('quotation','proforma','invoice') and status <> 'Cancelled'
        group by deal_id, document_type
        having count(*) > 1
      ) x
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.quo_system_health() from public, anon;
grant execute on function public.quo_system_health() to authenticated;
