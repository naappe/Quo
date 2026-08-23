-- Quo v74 cleanup: remove unused Credit Note / Debit Note paths.
-- Production contains no credit_note/debit_note documents, so the schema can return
-- to the four document types actually used by Quo.

do $$
begin
  if exists (
    select 1 from public.quo_documents
    where document_type in ('credit_note','debit_note')
  ) then
    raise exception 'Cannot remove credit/debit support while adjustment documents exist';
  end if;
end $$;

drop trigger if exists quo_adjustment_reconcile_invoice on public.quo_documents;
drop trigger if exists quo_documents_guard_adjustment_chain on public.quo_documents;

drop function if exists public.quo_invoice_finance_snapshot(uuid);
drop function if exists public.quo_invoice_aging();
drop function if exists public.quo_create_adjustment_note(uuid,text,numeric,text,text);
drop function if exists public.quo_reconcile_invoice_from_adjustments();
drop function if exists public.quo_guard_invoice_adjustment_chain();
drop function if exists public.quo_invoice_effective_total(uuid);

alter table public.quo_documents
  drop constraint if exists quo_documents_document_type_check;
alter table public.quo_documents
  add constraint quo_documents_document_type_check
  check (document_type in ('quotation','proforma','invoice','receipt'));

create or replace function public.next_quo_document_number_v2(
  p_type text,
  p_year integer default null
)
returns text
language plpgsql
security definer
set search_path=public
as $function$
declare
  y integer := coalesce(p_year, extract(year from current_date)::integer);
  n integer;
  prefix text;
begin
  if p_type not in ('quotation','proforma','invoice','receipt') then
    raise exception 'Invalid document type';
  end if;

  insert into public.quo_number_counters_v2(document_type, year, last_number)
  values (p_type, y, 1)
  on conflict (document_type, year)
  do update set last_number = public.quo_number_counters_v2.last_number + 1
  returning last_number into n;

  select case p_type
    when 'quotation' then quotation_prefix
    when 'proforma' then proforma_prefix
    when 'invoice' then invoice_prefix
    else receipt_prefix
  end into prefix
  from public.quo_settings where id=1;

  prefix := coalesce(
    nullif(trim(prefix),''),
    case p_type when 'quotation' then 'QT' when 'proforma' then 'PI' when 'invoice' then 'INV' else 'RC' end
  );
  prefix := upper(regexp_replace(prefix,'[^A-Za-z0-9]','','g'));
  return prefix || '-' || y::text || '-' || lpad(n::text,4,'0');
end;
$function$;

create or replace function public.quo_validate_document_integrity()
returns trigger
language plpgsql
set search_path=public
as $function$
declare
  item jsonb;
  src_deal uuid;
begin
  if new.document_type not in ('quotation','proforma','invoice','receipt') then
    raise exception 'Invalid document type';
  end if;
  if coalesce(new.discount,0) < 0 then raise exception 'Discount cannot be negative'; end if;
  if coalesce(new.gst_rate,0) < 0 or coalesce(new.gst_rate,0) > 100 then raise exception 'GST rate must be between 0 and 100'; end if;
  if coalesce(new.service_pax,0) < 0 then raise exception 'Guest count cannot be negative'; end if;
  if coalesce(new.paid_amount,0) < 0 then raise exception 'Paid amount cannot be negative'; end if;
  if coalesce(new.revision_no,0) < 0 then raise exception 'Revision number cannot be negative'; end if;
  if jsonb_typeof(coalesce(new.items,'[]'::jsonb)) <> 'array' then raise exception 'Items must be a JSON array'; end if;

  for item in select value from jsonb_array_elements(coalesce(new.items,'[]'::jsonb)) loop
    if coalesce(nullif(item->>'qty','')::numeric,0) < 0 then raise exception 'Item quantity cannot be negative'; end if;
    if coalesce(nullif(item->>'price','')::numeric,0) < 0 then raise exception 'Item rate cannot be negative'; end if;
  end loop;

  if new.document_type='quotation' and new.deal_id is null then new.deal_id:=new.id; end if;
  if new.deal_id is null and new.source_document_id is not null then
    select coalesce(deal_id,id) into src_deal from public.quo_documents where id=new.source_document_id;
    new.deal_id:=src_deal;
  end if;
  if new.document_type in ('quotation','proforma','invoice') and new.revision_root_id is null then new.revision_root_id:=new.id; end if;
  if new.document_type='invoice' and coalesce(new.payment_status,'Not Applicable')='Not Applicable' then new.payment_status:='Unpaid'; end if;
  if new.document_type<>'invoice' then new.payment_status:='Not Applicable'; end if;
  if new.payment_status not in ('Not Applicable','Unpaid','Part Paid','Paid') then raise exception 'Invalid payment status'; end if;
  return new;
end;
$function$;

create or replace function public.quo_guard_issued_content()
returns trigger
language plpgsql
set search_path=public
as $function$
begin
  if tg_op <> 'UPDATE' then return new; end if;

  if (
      new.revision_root_id is distinct from old.revision_root_id
      or new.revision_no is distinct from old.revision_no
      or new.supersedes_document_id is distinct from old.supersedes_document_id
      or new.superseded_by_id is distinct from old.superseded_by_id
      or new.amendment_reason is distinct from old.amendment_reason
      or new.void_reason is distinct from old.void_reason
     )
     and coalesce(current_setting('quo.allow_document_revision',true),'0') <> '1' then
    raise exception 'Revision metadata is managed by the Quo amendment workflow';
  end if;

  if old.document_type in ('quotation','proforma','invoice')
     and old.status <> 'Draft'
     and coalesce(current_setting('quo.allow_document_revision',true),'0') <> '1'
     and (
       new.creation_date is distinct from old.creation_date
       or new.expires_on is distinct from old.expires_on
       or new.currency is distinct from old.currency
       or new.customer_name is distinct from old.customer_name
       or new.customer_phone is distinct from old.customer_phone
       or new.customer_address is distinct from old.customer_address
       or new.event_name is distinct from old.event_name
       or new.service_enabled is distinct from old.service_enabled
       or new.service_type is distinct from old.service_type
       or new.service_from is distinct from old.service_from
       or new.service_to is distinct from old.service_to
       or new.service_pax is distinct from old.service_pax
       or new.service_label is distinct from old.service_label
       or new.venue is distinct from old.venue
       or new.items is distinct from old.items
       or new.gst_mode is distinct from old.gst_mode
       or new.gst_rate is distinct from old.gst_rate
       or new.discount is distinct from old.discount
       or new.show_gst is distinct from old.show_gst
       or new.include_menu is distinct from old.include_menu
       or new.menu_title is distinct from old.menu_title
       or new.menu_text is distinct from old.menu_text
       or new.use_advance is distinct from old.use_advance
       or new.advance_percent is distinct from old.advance_percent
       or new.advance_due is distinct from old.advance_due
       or new.bank is distinct from old.bank
       or new.account_no is distinct from old.account_no
       or new.slip_via is distinct from old.slip_via
       or new.slip_contact is distinct from old.slip_contact
       or new.extra_terms is distinct from old.extra_terms
       or new.payment_reference is distinct from old.payment_reference
     ) then
    raise exception 'Issued document content is locked. Use the controlled document workflow.';
  end if;
  return new;
end;
$function$;

create or replace function public.quo_log_document_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare
  root_deal uuid;
  actor uuid;
  actor_text text;
  amount_value numeric;
begin
  root_deal:=coalesce(new.deal_id,new.id);
  actor:=coalesce(new.updated_by,new.created_by);
  actor_text:=coalesce(nullif(trim(new.updated_by_name),''),nullif(trim(new.created_by_name),''),'System');

  if tg_op='INSERT' then
    insert into public.quo_document_events(document_id,deal_id,event_type,event_at,actor_id,actor_name,details)
    values(new.id,root_deal,'created',coalesce(new.created_at,now()),coalesce(new.created_by,actor),coalesce(nullif(trim(new.created_by_name),''),actor_text),jsonb_build_object('document_number',new.document_number,'document_type',new.document_type,'status',new.status));

    if new.source_document_id is not null then
      if new.document_type in ('proforma','invoice') then
        insert into public.quo_document_events(document_id,deal_id,event_type,event_at,actor_id,actor_name,related_document_id,details)
        values(new.source_document_id,root_deal,'converted',coalesce(new.created_at,now()),actor,actor_text,new.id,jsonb_build_object('to_number',new.document_number,'to_type',new.document_type));
      elsif new.document_type='receipt' then
        amount_value:=public.quo_calculate_document_total(new.items,new.discount,new.gst_mode,new.gst_rate);
        insert into public.quo_document_events(document_id,deal_id,event_type,event_at,actor_id,actor_name,related_document_id,details)
        values(new.source_document_id,root_deal,'payment_recorded',coalesce(new.created_at,now()),actor,actor_text,new.id,jsonb_build_object('receipt_number',new.document_number,'amount',amount_value,'payment_reference',new.payment_reference));
      end if;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.quo_document_events(document_id,deal_id,event_type,event_at,actor_id,actor_name,details)
    values(new.id,root_deal,case when new.status='Cancelled' then 'voided' when new.status='Superseded' then 'superseded' else 'status_changed' end,coalesce(new.updated_at,now()),actor,actor_text,jsonb_strip_nulls(jsonb_build_object('from_status',old.status,'to_status',new.status,'reason',case when new.status='Cancelled' then new.void_reason when new.status='Superseded' then new.amendment_reason else null end)));
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.quo_document_events(document_id,deal_id,event_type,event_at,actor_id,actor_name,details)
    values(new.id,root_deal,'payment_status_changed',coalesce(new.updated_at,now()),actor,actor_text,jsonb_build_object('from_status',old.payment_status,'to_status',new.payment_status,'paid_amount',new.paid_amount));
  end if;
  return new;
end;
$function$;

create or replace function public.quo_system_health()
returns jsonb
language plpgsql
stable
set search_path=public
as $function$
declare v_result jsonb;
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  select jsonb_build_object(
    'active_documents',(select count(*) from public.quo_documents where deleted_at is null and status not in ('Cancelled','Superseded')),
    'historical_revisions',(select count(*) from public.quo_documents where deleted_at is null and status='Superseded'),
    'active_customers',(select count(*) from public.quo_customers where is_active),
    'documents_without_customer',(select count(*) from public.quo_documents where deleted_at is null and status not in ('Cancelled','Superseded') and nullif(trim(customer_name),'') is not null and customer_id is null),
    'confirmed_quotes_without_proforma',(select count(*) from public.quo_documents q where q.deleted_at is null and q.document_type='quotation' and q.status='Confirmed' and not exists(select 1 from public.quo_documents p where p.deleted_at is null and p.status not in ('Cancelled','Superseded') and p.document_type='proforma' and (p.source_document_id=q.id or p.deal_id=q.deal_id))),
    'converted_proformas_without_invoice',(select count(*) from public.quo_documents p where p.deleted_at is null and p.document_type='proforma' and p.status='Converted' and not exists(select 1 from public.quo_documents i where i.deleted_at is null and i.status not in ('Cancelled','Superseded') and i.document_type='invoice' and (i.source_document_id=p.id or i.deal_id=p.deal_id))),
    'receipts_without_invoice',(select count(*) from public.quo_documents r where r.deleted_at is null and r.document_type='receipt' and r.status<>'Cancelled' and not exists(select 1 from public.quo_documents i where i.deleted_at is null and i.document_type='invoice' and i.id=r.source_document_id)),
    'duplicate_active_deal_types',(select count(*) from (select deal_id,document_type from public.quo_documents where deleted_at is null and deal_id is not null and document_type in ('quotation','proforma','invoice') and status not in ('Cancelled','Superseded') group by deal_id,document_type having count(*)>1) x),
    'timeline_events',(select count(*) from public.quo_document_events)
  ) into v_result;
  return v_result;
end;
$function$;
