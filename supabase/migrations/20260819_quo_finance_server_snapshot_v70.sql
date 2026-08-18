create index if not exists quo_documents_source_type_active_idx
  on public.quo_documents(source_document_id, document_type)
  where deleted_at is null;

create or replace function public.quo_invoice_finance_snapshot(p_invoice_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  inv public.quo_documents%rowtype;
  effective numeric;
  paid numeric;
  notes jsonb;
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  select * into inv from public.quo_documents where id=p_invoice_id and document_type='invoice' and deleted_at is null;
  if not found then raise exception 'Invoice not found'; end if;
  effective:=coalesce(public.quo_invoice_effective_total(inv.id),0);
  paid:=coalesce(inv.paid_amount,0);
  select coalesce(jsonb_agg(to_jsonb(n) order by n.creation_date,n.created_at),'[]'::jsonb)
    into notes
    from public.quo_documents n
   where n.source_document_id=inv.id
     and n.document_type in ('credit_note','debit_note')
     and n.deleted_at is null;
  return jsonb_build_object(
    'invoice',to_jsonb(inv),
    'effective_total',effective,
    'paid_amount',paid,
    'balance',greatest(effective-paid,0),
    'credit_balance',greatest(paid-effective,0),
    'notes',notes
  );
end;
$$;
revoke all on function public.quo_invoice_finance_snapshot(uuid) from public, anon;
grant execute on function public.quo_invoice_finance_snapshot(uuid) to authenticated;

create or replace function public.quo_invoice_aging()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_today date:=(timezone('Indian/Maldives',now()))::date;
  v_rows jsonb;
  v_summary jsonb;
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;

  with finance as (
    select i.id,i.document_number,i.customer_id,i.customer_name,i.currency,i.creation_date,i.expires_on,
           coalesce(i.paid_amount,0) paid_amount,
           coalesce(public.quo_invoice_effective_total(i.id),0) effective_total
      from public.quo_documents i
     where i.document_type='invoice'
       and i.deleted_at is null
       and i.status not in ('Cancelled','Superseded')
  ), outstanding as (
    select *,greatest(effective_total-paid_amount,0) balance,
      case
        when expires_on is null then 'no_due'
        when expires_on>v_today then 'not_due'
        when expires_on=v_today then 'today'
        when v_today-expires_on between 1 and 7 then 'd1_7'
        when v_today-expires_on between 8 and 30 then 'd8_30'
        else 'd31_plus'
      end bucket,
      case when expires_on is null then null else v_today-expires_on end days_overdue
    from finance
    where effective_total-paid_amount>0.005
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'document_number',document_number,'customer_id',customer_id,'customer_name',customer_name,
    'currency',currency,'creation_date',creation_date,'due_date',expires_on,'paid_amount',paid_amount,
    'effective_total',effective_total,'balance',balance,'bucket',bucket,'days_overdue',days_overdue
  ) order by coalesce(expires_on,'9999-12-31'::date),document_number),'[]'::jsonb)
  into v_rows from outstanding;

  with finance as (
    select i.id,i.customer_name,coalesce(i.paid_amount,0) paid_amount,coalesce(public.quo_invoice_effective_total(i.id),0) effective_total,i.expires_on
      from public.quo_documents i
     where i.document_type='invoice' and i.deleted_at is null and i.status not in ('Cancelled','Superseded')
  ), outstanding as (
    select customer_name,greatest(effective_total-paid_amount,0) balance,
      case when expires_on is null then 'no_due' when expires_on>v_today then 'not_due' when expires_on=v_today then 'today' when v_today-expires_on between 1 and 7 then 'd1_7' when v_today-expires_on between 8 and 30 then 'd8_30' else 'd31_plus' end bucket
    from finance where effective_total-paid_amount>0.005
  ), by_customer as (
    select coalesce(nullif(trim(customer_name),''),'Unknown') customer,sum(balance) balance from outstanding group by 1 order by balance desc limit 1
  )
  select jsonb_build_object(
    'as_of',v_today,
    'total_outstanding',coalesce((select sum(balance) from outstanding),0),
    'total_count',(select count(*) from outstanding),
    'not_due',jsonb_build_object('amount',coalesce((select sum(balance) from outstanding where bucket='not_due'),0),'count',(select count(*) from outstanding where bucket='not_due')),
    'no_due',jsonb_build_object('amount',coalesce((select sum(balance) from outstanding where bucket='no_due'),0),'count',(select count(*) from outstanding where bucket='no_due')),
    'today',jsonb_build_object('amount',coalesce((select sum(balance) from outstanding where bucket='today'),0),'count',(select count(*) from outstanding where bucket='today')),
    'd1_7',jsonb_build_object('amount',coalesce((select sum(balance) from outstanding where bucket='d1_7'),0),'count',(select count(*) from outstanding where bucket='d1_7')),
    'd8_30',jsonb_build_object('amount',coalesce((select sum(balance) from outstanding where bucket='d8_30'),0),'count',(select count(*) from outstanding where bucket='d8_30')),
    'd31_plus',jsonb_build_object('amount',coalesce((select sum(balance) from outstanding where bucket='d31_plus'),0),'count',(select count(*) from outstanding where bucket='d31_plus')),
    'top_customer',coalesce((select jsonb_build_object('name',customer,'amount',balance) from by_customer),jsonb_build_object('name','-','amount',0))
  ) into v_summary;

  return jsonb_build_object('summary',v_summary,'rows',v_rows);
end;
$$;
revoke all on function public.quo_invoice_aging() from public, anon;
grant execute on function public.quo_invoice_aging() to authenticated;
