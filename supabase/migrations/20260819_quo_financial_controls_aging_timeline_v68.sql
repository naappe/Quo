alter table public.quo_documents drop constraint if exists quo_documents_document_type_check;
alter table public.quo_documents add constraint quo_documents_document_type_check
  check (document_type in ('quotation','proforma','invoice','receipt','credit_note','debit_note'));

alter table public.quo_number_counters_v2 drop constraint if exists quo_number_counters_v2_document_type_check;
alter table public.quo_number_counters_v2 add constraint quo_number_counters_v2_document_type_check
  check (document_type in ('quotation','proforma','invoice','receipt','credit_note','debit_note'));

create or replace function public.next_quo_document_number_v2(p_type text, p_year integer default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer := coalesce(p_year, extract(year from current_date)::integer);
  n integer;
  prefix text;
begin
  if p_type not in ('quotation','proforma','invoice','receipt','credit_note','debit_note') then
    raise exception 'Invalid document type';
  end if;
  insert into public.quo_number_counters_v2(document_type, year, last_number)
  values (p_type, y, 1)
  on conflict (document_type, year)
  do update set last_number = public.quo_number_counters_v2.last_number + 1
  returning last_number into n;
  if p_type='credit_note' then prefix:='CN';
  elsif p_type='debit_note' then prefix:='DN';
  else
    select case p_type
      when 'quotation' then quotation_prefix
      when 'proforma' then proforma_prefix
      when 'invoice' then invoice_prefix
      else receipt_prefix
    end into prefix from public.quo_settings where id=1;
  end if;
  prefix := coalesce(nullif(trim(prefix),''), case p_type when 'quotation' then 'QT' when 'proforma' then 'PI' when 'invoice' then 'INV' when 'receipt' then 'RC' when 'credit_note' then 'CN' else 'DN' end);
  prefix := upper(regexp_replace(prefix,'[^A-Za-z0-9]','','g'));
  return prefix || '-' || y::text || '-' || lpad(n::text,4,'0');
end;
$$;

create or replace function public.quo_validate_document_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare item jsonb; src_deal uuid; src_type text;
begin
  if new.document_type not in ('quotation','proforma','invoice','receipt','credit_note','debit_note') then raise exception 'Invalid document type'; end if;
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
  if new.document_type in ('credit_note','debit_note') then
    if new.source_document_id is null then raise exception 'Adjustment note must reference an Invoice'; end if;
    select document_type into src_type from public.quo_documents where id=new.source_document_id;
    if src_type is distinct from 'invoice' then raise exception 'Adjustment note source must be an Invoice'; end if;
  end if;
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
$$;

create or replace function public.quo_guard_issued_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then return new; end if;
  if (new.revision_root_id is distinct from old.revision_root_id or new.revision_no is distinct from old.revision_no or new.supersedes_document_id is distinct from old.supersedes_document_id or new.superseded_by_id is distinct from old.superseded_by_id or new.amendment_reason is distinct from old.amendment_reason or new.void_reason is distinct from old.void_reason)
     and coalesce(current_setting('quo.allow_document_revision',true),'0') <> '1' then
    raise exception 'Revision metadata is managed by the Quo amendment workflow';
  end if;
  if old.document_type in ('quotation','proforma','invoice','credit_note','debit_note') and old.status <> 'Draft'
     and coalesce(current_setting('quo.allow_document_revision',true),'0') <> '1'
     and (new.creation_date is distinct from old.creation_date or new.expires_on is distinct from old.expires_on or new.currency is distinct from old.currency or new.customer_name is distinct from old.customer_name or new.customer_phone is distinct from old.customer_phone or new.customer_address is distinct from old.customer_address or new.event_name is distinct from old.event_name or new.service_enabled is distinct from old.service_enabled or new.service_type is distinct from old.service_type or new.service_from is distinct from old.service_from or new.service_to is distinct from old.service_to or new.service_pax is distinct from old.service_pax or new.service_label is distinct from old.service_label or new.venue is distinct from old.venue or new.items is distinct from old.items or new.gst_mode is distinct from old.gst_mode or new.gst_rate is distinct from old.gst_rate or new.discount is distinct from old.discount or new.show_gst is distinct from old.show_gst or new.include_menu is distinct from old.include_menu or new.menu_title is distinct from old.menu_title or new.menu_text is distinct from old.menu_text or new.use_advance is distinct from old.use_advance or new.advance_percent is distinct from old.advance_percent or new.advance_due is distinct from old.advance_due or new.bank is distinct from old.bank or new.account_no is distinct from old.account_no or new.slip_via is distinct from old.slip_via or new.slip_contact is distinct from old.slip_contact or new.extra_terms is distinct from old.extra_terms or new.payment_reference is distinct from old.payment_reference) then
    raise exception 'Issued document content is locked. Use the controlled document workflow.';
  end if;
  return new;
end;
$$;

create or replace function public.quo_invoice_effective_total(p_invoice_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select greatest(public.quo_calculate_document_total(i.items,i.discount,i.gst_mode,i.gst_rate)
    + coalesce((select sum(public.quo_calculate_document_total(n.items,n.discount,n.gst_mode,n.gst_rate)) from public.quo_documents n where n.document_type='debit_note' and n.source_document_id=i.id and n.deleted_at is null and n.status<>'Cancelled'),0)
    - coalesce((select sum(public.quo_calculate_document_total(n.items,n.discount,n.gst_mode,n.gst_rate)) from public.quo_documents n where n.document_type='credit_note' and n.source_document_id=i.id and n.deleted_at is null and n.status<>'Cancelled'),0),0)
  from public.quo_documents i where i.id=p_invoice_id and i.document_type='invoice' and i.deleted_at is null;
$$;
revoke all on function public.quo_invoice_effective_total(uuid) from public, anon;
grant execute on function public.quo_invoice_effective_total(uuid) to authenticated;

create or replace function public.quo_reconcile_invoice_from_receipts()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare invoice_id uuid; inv public.quo_documents%rowtype; total_value numeric; received numeric; new_payment_status text;
begin
  invoice_id:=coalesce(new.source_document_id,old.source_document_id);
  if invoice_id is null then return coalesce(new,old); end if;
  select * into inv from public.quo_documents where id=invoice_id and document_type='invoice' for update;
  if not found then return coalesce(new,old); end if;
  total_value:=coalesce(public.quo_invoice_effective_total(invoice_id),0);
  select coalesce(sum(public.quo_calculate_document_total(r.items,r.discount,r.gst_mode,r.gst_rate)),0) into received from public.quo_documents r where r.document_type='receipt' and r.source_document_id=invoice_id and r.deleted_at is null and r.status<>'Cancelled';
  new_payment_status:=case when total_value<=0.005 then 'Paid' when received>=total_value-0.005 then 'Paid' when received>0.005 then 'Part Paid' else 'Unpaid' end;
  perform set_config('quo.allow_financial_reconcile','1',true);
  update public.quo_documents set paid_amount=received,payment_status=new_payment_status where id=invoice_id;
  perform set_config('quo.allow_financial_reconcile','0',true);
  return coalesce(new,old);
end;
$$;
revoke all on function public.quo_reconcile_invoice_from_receipts() from public, anon, authenticated;

create or replace function public.quo_reconcile_invoice_from_adjustments()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare invoice_id uuid; inv public.quo_documents%rowtype; total_value numeric; received numeric; new_payment_status text;
begin
  invoice_id:=coalesce(new.source_document_id,old.source_document_id);
  if invoice_id is null then return coalesce(new,old); end if;
  select * into inv from public.quo_documents where id=invoice_id and document_type='invoice' for update;
  if not found then return coalesce(new,old); end if;
  total_value:=coalesce(public.quo_invoice_effective_total(invoice_id),0);
  select coalesce(sum(public.quo_calculate_document_total(r.items,r.discount,r.gst_mode,r.gst_rate)),0) into received from public.quo_documents r where r.document_type='receipt' and r.source_document_id=invoice_id and r.deleted_at is null and r.status<>'Cancelled';
  new_payment_status:=case when total_value<=0.005 then 'Paid' when received>=total_value-0.005 then 'Paid' when received>0.005 then 'Part Paid' else 'Unpaid' end;
  perform set_config('quo.allow_financial_reconcile','1',true);
  update public.quo_documents set paid_amount=received,payment_status=new_payment_status where id=invoice_id;
  perform set_config('quo.allow_financial_reconcile','0',true);
  return coalesce(new,old);
end;
$$;
revoke all on function public.quo_reconcile_invoice_from_adjustments() from public, anon, authenticated;
drop trigger if exists quo_adjustment_reconcile_invoice on public.quo_documents;
create trigger quo_adjustment_reconcile_invoice after insert or update of deleted_at,status on public.quo_documents for each row when (new.document_type in ('credit_note','debit_note')) execute function public.quo_reconcile_invoice_from_adjustments();

create or replace function public.quo_guard_invoice_adjustment_chain()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.document_type='invoice' and (((new.status is distinct from old.status) and new.status in ('Cancelled','Superseded')) or (old.deleted_at is null and new.deleted_at is not null)) and exists(select 1 from public.quo_documents n where n.source_document_id=old.id and n.document_type in ('credit_note','debit_note') and n.deleted_at is null and n.status<>'Cancelled') then
    raise exception 'This Invoice has active Credit/Debit Notes. Void those adjustment notes first.';
  end if;
  if old.document_type in ('credit_note','debit_note') and old.deleted_at is null and new.deleted_at is not null then raise exception 'Adjustment Notes must be voided, not deleted.'; end if;
  return new;
end;
$$;
revoke all on function public.quo_guard_invoice_adjustment_chain() from public, anon, authenticated;
drop trigger if exists quo_documents_guard_adjustment_chain on public.quo_documents;
create trigger quo_documents_guard_adjustment_chain before update on public.quo_documents for each row execute function public.quo_guard_invoice_adjustment_chain();

create or replace function public.quo_record_invoice_payment(p_invoice_id uuid,p_amount numeric,p_payment_date date,p_method text,p_reference text default null,p_actor text default 'White Saffron')
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare inv public.quo_documents%rowtype; receipt public.quo_documents%rowtype; total_value numeric; balance_value numeric; item jsonb; ref_text text; method_value text; reference_value text:=nullif(trim(coalesce(p_reference,'')),''); actor text:=public.quo_current_actor_name(); v_today date:=(timezone('Indian/Maldives',now()))::date;
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_payment_date is null then raise exception 'Payment date is required'; end if;
  if p_payment_date>v_today then raise exception 'Payment date cannot be in the future'; end if;
  method_value:=case lower(trim(coalesce(p_method,''))) when 'bank transfer' then 'Bank Transfer' when 'cash' then 'Cash' when 'card' then 'Card' when 'other' then 'Other' else null end;
  if method_value is null then raise exception 'Payment method must be Bank Transfer, Cash, Card or Other'; end if;
  if method_value in ('Bank Transfer','Card') and reference_value is null then raise exception 'Transaction/reference is required for %',method_value; end if;
  if method_value='Other' and reference_value is null then raise exception 'Describe the other payment method or reference'; end if;
  select * into inv from public.quo_documents where id=p_invoice_id and document_type='invoice' and deleted_at is null for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status in ('Cancelled','Superseded') then raise exception 'Inactive invoice cannot receive payment'; end if;
  total_value:=coalesce(public.quo_invoice_effective_total(inv.id),0);
  balance_value:=greatest(total_value-coalesce(inv.paid_amount,0),0);
  if balance_value<=0.005 then raise exception 'This Invoice has no balance due'; end if;
  if p_amount>balance_value+0.005 then raise exception 'Payment exceeds invoice balance'; end if;
  ref_text:=case when reference_value is null then method_value else method_value||' - '||reference_value end;
  item:=jsonb_build_array(jsonb_build_object('description','Payment received for '||inv.document_number,'qty',1,'unit','Payment','price',round(p_amount,2)));
  perform set_config('quo.allow_receipt_insert','1',true);
  insert into public.quo_documents(document_number,document_type,status,currency,creation_date,customer_name,customer_phone,customer_address,items,gst_mode,gst_rate,discount,paid_amount,payment_reference,source_document_id,deal_id,created_by_name,updated_by_name,extra_terms)
  values ('NEW','receipt','Issued',inv.currency,p_payment_date,inv.customer_name,inv.customer_phone,inv.customer_address,item,'none',0,0,round(p_amount,2),ref_text,inv.id,coalesce(inv.deal_id,inv.id),actor,actor,'Payment received against '||inv.document_number||'. Method: '||method_value||case when reference_value is null then '.' else '. Reference: '||reference_value||'.' end)
  returning * into receipt;
  perform set_config('quo.allow_receipt_insert','0',true);
  select * into inv from public.quo_documents where id=p_invoice_id;
  return jsonb_build_object('invoice',to_jsonb(inv),'receipt',to_jsonb(receipt),'effective_total',total_value);
end;
$$;
revoke all on function public.quo_record_invoice_payment(uuid,numeric,date,text,text,text) from public, anon;
grant execute on function public.quo_record_invoice_payment(uuid,numeric,date,text,text,text) to authenticated;

create or replace function public.quo_create_adjustment_note(p_invoice_id uuid,p_note_type text,p_amount numeric,p_reason text,p_reference text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare inv public.quo_documents%rowtype; note public.quo_documents%rowtype; amount_value numeric:=round(coalesce(p_amount,0),2); reason_text text:=nullif(trim(coalesce(p_reason,'')),''); reference_text text:=nullif(trim(coalesce(p_reference,'')),''); before_total numeric; item jsonb; actor text:=public.quo_current_actor_name(); v_today date:=(timezone('Indian/Maldives',now()))::date;
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  if p_note_type not in ('credit_note','debit_note') then raise exception 'Note type must be Credit Note or Debit Note'; end if;
  if amount_value<=0 then raise exception 'Adjustment amount must be greater than zero'; end if;
  if reason_text is null then raise exception 'Adjustment reason is required'; end if;
  select * into inv from public.quo_documents where id=p_invoice_id and document_type='invoice' and deleted_at is null for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status in ('Cancelled','Superseded') then raise exception 'Inactive invoice cannot be adjusted'; end if;
  before_total:=coalesce(public.quo_invoice_effective_total(inv.id),0);
  if p_note_type='credit_note' and amount_value>before_total+0.005 then raise exception 'Credit Note cannot exceed the current adjusted Invoice total'; end if;
  item:=jsonb_build_array(jsonb_build_object('description',case when p_note_type='credit_note' then 'Credit adjustment - ' else 'Debit adjustment - ' end||reason_text,'qty',1,'unit','Adjustment','price',amount_value));
  insert into public.quo_documents(document_number,document_type,status,currency,creation_date,customer_name,customer_phone,customer_address,items,gst_mode,gst_rate,discount,show_gst,include_menu,use_advance,paid_amount,payment_reference,extra_terms,source_document_id,deal_id,created_by_name,updated_by_name,payment_status)
  values ('NEW',p_note_type,'Issued',inv.currency,v_today,inv.customer_name,inv.customer_phone,inv.customer_address,item,'none',0,0,false,false,false,0,reference_text,reason_text,inv.id,coalesce(inv.deal_id,inv.id),actor,actor,'Not Applicable') returning * into note;
  select * into inv from public.quo_documents where id=p_invoice_id;
  return jsonb_build_object('created',true,'document',to_jsonb(note),'invoice',to_jsonb(inv),'effective_total',public.quo_invoice_effective_total(inv.id));
end;
$$;
revoke all on function public.quo_create_adjustment_note(uuid,text,numeric,text,text) from public, anon;
grant execute on function public.quo_create_adjustment_note(uuid,text,numeric,text,text) to authenticated;

create table if not exists public.quo_document_events(
  id bigint generated by default as identity primary key,
  document_id uuid not null references public.quo_documents(id) on delete cascade,
  deal_id uuid,
  event_type text not null,
  event_at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  related_document_id uuid references public.quo_documents(id) on delete set null,
  details jsonb not null default '{}'::jsonb
);
create index if not exists quo_document_events_document_idx on public.quo_document_events(document_id,event_at desc);
create index if not exists quo_document_events_deal_idx on public.quo_document_events(deal_id,event_at desc);
alter table public.quo_document_events enable row level security;
drop policy if exists quo_document_events_select_active on public.quo_document_events;
create policy quo_document_events_select_active on public.quo_document_events for select to authenticated using ((select public.quo_is_active_user()));
revoke insert,update,delete on public.quo_document_events from anon, authenticated;
grant select on public.quo_document_events to authenticated;

create or replace function public.quo_log_document_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare root_deal uuid; actor uuid; actor_text text; amount_value numeric;
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
      elsif new.document_type in ('credit_note','debit_note') then
        amount_value:=public.quo_calculate_document_total(new.items,new.discount,new.gst_mode,new.gst_rate);
        insert into public.quo_document_events(document_id,deal_id,event_type,event_at,actor_id,actor_name,related_document_id,details)
        values(new.source_document_id,root_deal,case when new.document_type='credit_note' then 'credit_note_created' else 'debit_note_created' end,coalesce(new.created_at,now()),actor,actor_text,new.id,jsonb_build_object('note_number',new.document_number,'amount',amount_value,'reason',new.extra_terms,'reference',new.payment_reference));
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
$$;
revoke all on function public.quo_log_document_event() from public, anon, authenticated;
drop trigger if exists quo_documents_activity_log on public.quo_documents;
create trigger quo_documents_activity_log after insert or update on public.quo_documents for each row execute function public.quo_log_document_event();

insert into public.quo_document_events(document_id,deal_id,event_type,event_at,actor_id,actor_name,details)
select d.id,coalesce(d.deal_id,d.id),'created',coalesce(d.created_at,now()),d.created_by,coalesce(nullif(trim(d.created_by_name),''),'Historical'),jsonb_build_object('document_number',d.document_number,'document_type',d.document_type,'status',d.status,'backfilled',true)
from public.quo_documents d where not exists(select 1 from public.quo_document_events e where e.document_id=d.id and e.event_type='created');

insert into public.quo_document_events(document_id,deal_id,event_type,event_at,actor_id,actor_name,related_document_id,details)
select r.source_document_id,coalesce(r.deal_id,r.source_document_id),'payment_recorded',coalesce(r.created_at,now()),r.created_by,coalesce(nullif(trim(r.created_by_name),''),'Historical'),r.id,jsonb_build_object('receipt_number',r.document_number,'amount',public.quo_calculate_document_total(r.items,r.discount,r.gst_mode,r.gst_rate),'payment_reference',r.payment_reference,'backfilled',true)
from public.quo_documents r where r.document_type='receipt' and r.source_document_id is not null and not exists(select 1 from public.quo_document_events e where e.related_document_id=r.id and e.event_type='payment_recorded');

create or replace function public.quo_system_health()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
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
    'adjustment_notes_without_invoice',(select count(*) from public.quo_documents n where n.deleted_at is null and n.document_type in ('credit_note','debit_note') and n.status<>'Cancelled' and not exists(select 1 from public.quo_documents i where i.deleted_at is null and i.document_type='invoice' and i.id=n.source_document_id)),
    'duplicate_active_deal_types',(select count(*) from (select deal_id,document_type from public.quo_documents where deleted_at is null and deal_id is not null and document_type in ('quotation','proforma','invoice') and status not in ('Cancelled','Superseded') group by deal_id,document_type having count(*)>1) x),
    'timeline_events',(select count(*) from public.quo_document_events)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.quo_system_health() from public, anon;
grant execute on function public.quo_system_health() to authenticated;
