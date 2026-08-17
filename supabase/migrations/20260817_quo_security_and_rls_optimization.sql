-- Quo-only database hardening and RLS performance cleanup.
alter table public.quo_number_counters_v2 enable row level security;
create index if not exists quo_documents_created_by_idx on public.quo_documents(created_by);
create index if not exists quo_documents_updated_by_idx on public.quo_documents(updated_by);

alter function public.quo_calculate_document_total(jsonb,numeric,text,numeric) set search_path=public;
alter function public.quo_validate_document_integrity() set search_path=public;
alter function public.quo_protect_receipt_financials() set search_path=public;
alter function public.quo_touch_document() set search_path=public;
alter function public.quo_protect_document_identity() set search_path=public;

revoke execute on function public.next_quo_document_number_v2(text,integer) from public,anon,authenticated;
revoke execute on function public.quo_assign_document_number() from public,anon,authenticated;
revoke execute on function public.quo_reconcile_invoice_from_receipts() from public,anon,authenticated;

alter function public.quo_convert_document(uuid,text,text) security invoker;
alter function public.quo_record_invoice_payment(uuid,numeric,date,text,text,text) security invoker;
grant execute on function public.quo_convert_document(uuid,text,text) to anon,authenticated;
grant execute on function public.quo_record_invoice_payment(uuid,numeric,date,text,text,text) to anon,authenticated;

drop policy if exists quo_documents_select_active_users on public.quo_documents;
create policy quo_documents_select_active_users on public.quo_documents for select to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id=(select auth.uid()) and ur.is_active)
);

drop policy if exists quo_documents_insert_active_users on public.quo_documents;
create policy quo_documents_insert_active_users on public.quo_documents for insert to authenticated with check (
  created_by=(select auth.uid()) and exists (
    select 1 from public.user_roles ur where ur.user_id=(select auth.uid()) and ur.is_active and ur.role=any(array['admin'::text,'manager'::text,'staff'::text])
  )
);

drop policy if exists quo_documents_update_active_users on public.quo_documents;
create policy quo_documents_update_active_users on public.quo_documents for update to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id=(select auth.uid()) and ur.is_active and ur.role=any(array['admin'::text,'manager'::text,'staff'::text]))
) with check (
  updated_by=(select auth.uid()) and exists (
    select 1 from public.user_roles ur where ur.user_id=(select auth.uid()) and ur.is_active and ur.role=any(array['admin'::text,'manager'::text,'staff'::text])
  )
);
