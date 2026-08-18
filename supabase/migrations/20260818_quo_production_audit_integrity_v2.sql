-- Quo production audit hardening, 2026-08-18.
-- Enforces the commercial chain, immutable payment state, safe Trash restore,
-- authenticated audit actors, and server-only receipt creation.

create or replace function public.quo_current_actor_name()
returns text
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(
    (select nullif(trim(coalesce(qu.display_name,qu.username)), '')
       from public.quo_users qu
      where qu.user_id=auth.uid() and qu.is_active
      limit 1),
    'White Saffron'
  );
$$;

revoke execute on function public.quo_current_actor_name() from public, anon;
grant execute on function public.quo_current_actor_name() to authenticated, service_role;

create or replace function public.quo_stamp_document_actor()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  actor text;
begin
  if uid is not null then
    select nullif(trim(coalesce(qu.display_name,qu.username)), '') into actor
      from public.quo_users qu
     where qu.user_id=uid and qu.is_active
     limit 1;
    if actor is null then raise exception 'Active Quo user required'; end if;
    if tg_op='INSERT' then
      new.created_by:=uid;
      new.created_by_name:=actor;
    else
      new.created_by:=old.created_by;
      new.created_by_name:=old.created_by_name;
    end if;
    new.updated_by:=uid;
    new.updated_by_name:=actor;
  elsif tg_op='UPDATE' then
    new.created_by:=old.created_by;
    new.created_by_name:=old.created_by_name;
  end if;
  return new;
end;
$$;

drop trigger if exists quo_documents_audit_actor on public.quo_documents;
create trigger quo_documents_audit_actor
before insert or update on public.quo_documents
for each row execute function public.quo_stamp_document_actor();

create or replace function public.quo_guard_document_state()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op='INSERT' then
    if new.document_type='receipt'
       and auth.uid() is not null
       and coalesce(current_setting('quo.allow_receipt_insert',true),'0')<>'1' then
      raise exception 'Receipts can only be created by recording an Invoice payment';
    end if;
    if new.document_type='invoice' then
      new.paid_amount:=0;
      new.payment_status:='Unpaid';
    end if;
    return new;
  end if;

  if new.deleted_at is distinct from old.deleted_at
     and coalesce(current_setting('quo.allow_deleted_at_change',true),'0')<>'1' then
    raise exception 'Use the Quo delete/restore workflow';
  end if;

  if old.document_type='invoice'
     and (new.paid_amount is distinct from old.paid_amount
          or new.payment_status is distinct from old.payment_status)
     and coalesce(current_setting('quo.allow_financial_reconcile',true),'0')<>'1' then
    raise exception 'Invoice payment state is managed only by recorded receipts';
  end if;

  return new;
end;
$$;

drop trigger if exists quo_documents_guard_state on public.quo_documents;
create trigger quo_documents_guard_state
before insert or update on public.quo_documents
for each row execute function public.quo_guard_document_state();

create or replace function public.quo_guard_workflow_status()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  root_deal uuid := coalesce(new.deal_id,old.deal_id,old.id);
  has_pi boolean;
  has_invoice boolean;
begin
  if new.status is not distinct from old.status then return new; end if;

  if old.document_type='quotation' then
    select exists(
      select 1 from public.quo_documents d
       where d.deleted_at is null and d.status<>'Cancelled'
         and d.document_type='proforma'
         and (d.source_document_id=old.id or d.deal_id=root_deal)
    ) into has_pi;
    if new.status='Confirmed' and not has_pi then
      raise exception 'Confirming a quotation must create its Proforma Invoice';
    end if;
    if old.status='Confirmed' and new.status<>'Confirmed' and has_pi then
      raise exception 'This quotation has an active Proforma Invoice. Resolve that Proforma first.';
    end if;
  elsif old.document_type='proforma' then
    select exists(
      select 1 from public.quo_documents d
       where d.deleted_at is null and d.status<>'Cancelled'
         and d.document_type='invoice'
         and (d.source_document_id=old.id or d.deal_id=root_deal)
    ) into has_invoice;
    if new.status='Converted' and not has_invoice then
      raise exception 'Converted status requires a linked Invoice';
    end if;
    if old.status='Converted' and new.status<>'Converted' and has_invoice then
      raise exception 'This Proforma has an active Invoice and must remain Converted';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists quo_documents_guard_workflow_status on public.quo_documents;
create trigger quo_documents_guard_workflow_status
before update of status on public.quo_documents
for each row execute function public.quo_guard_workflow_status();

create unique index if not exists quo_documents_active_deal_type_uidx
on public.quo_documents(deal_id,document_type)
where deleted_at is null
  and deal_id is not null
  and document_type in ('quotation','proforma','invoice')
  and status<>'Cancelled';

create or replace function public.quo_reconcile_invoice_from_receipts()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  invoice_id uuid;
  inv public.quo_documents%rowtype;
  total_value numeric;
  received numeric;
  new_payment_status text;
begin
  invoice_id:=coalesce(new.source_document_id,old.source_document_id);
  if invoice_id is null then return coalesce(new,old); end if;
  select * into inv from public.quo_documents where id=invoice_id and document_type='invoice' for update;
  if not found then return coalesce(new,old); end if;
  total_value:=public.quo_calculate_document_total(inv.items,inv.discount,inv.gst_mode,inv.gst_rate);
  select coalesce(sum(public.quo_calculate_document_total(r.items,r.discount,r.gst_mode,r.gst_rate)),0)
    into received
    from public.quo_documents r
   where r.document_type='receipt'
     and r.source_document_id=invoice_id
     and r.deleted_at is null
     and r.status<>'Cancelled';
  received:=least(received,total_value);
  new_payment_status:=case when total_value>0 and received>=total_value then 'Paid' when received>0 then 'Part Paid' else 'Unpaid' end;
  perform set_config('quo.allow_financial_reconcile','1',true);
  update public.quo_documents set paid_amount=received,payment_status=new_payment_status where id=invoice_id;
  perform set_config('quo.allow_financial_reconcile','0',true);
  return coalesce(new,old);
end;
$$;

create or replace function public.quo_soft_delete_document(p_document_id uuid, p_actor text default 'White Saffron')
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  d public.quo_documents%rowtype;
  root_deal uuid;
  actor text:=public.quo_current_actor_name();
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  select * into d from public.quo_documents where id=p_document_id and deleted_at is null for update;
  if not found then raise exception 'Document not found or already deleted'; end if;
  root_deal:=coalesce(d.deal_id,d.id);

  if d.document_type='quotation' and exists(
    select 1 from public.quo_documents x where x.deleted_at is null and x.status<>'Cancelled'
      and x.document_type in ('proforma','invoice') and x.deal_id=root_deal
  ) then raise exception 'This quotation has linked commercial documents. Delete or cancel the later documents first.';
  end if;

  if d.document_type='proforma' and exists(
    select 1 from public.quo_documents x where x.deleted_at is null and x.status<>'Cancelled'
      and x.document_type='invoice' and (x.source_document_id=d.id or x.deal_id=root_deal)
  ) then raise exception 'This Proforma has a linked Invoice. Delete or cancel the Invoice first.';
  end if;

  if d.document_type='invoice' and exists(
    select 1 from public.quo_documents x where x.deleted_at is null and x.status<>'Cancelled'
      and x.document_type='receipt' and x.source_document_id=d.id
  ) then raise exception 'This Invoice has active Receipts. Delete the Receipts first.';
  end if;

  perform set_config('quo.allow_deleted_at_change','1',true);
  update public.quo_documents set deleted_at=now(),deleted_by_name=actor where id=p_document_id;
  perform set_config('quo.allow_deleted_at_change','0',true);
  return jsonb_build_object('id',d.id,'document_number',d.document_number,'document_type',d.document_type);
end;
$$;

revoke execute on function public.quo_soft_delete_document(uuid,text) from public, anon;
grant execute on function public.quo_soft_delete_document(uuid,text) to authenticated;

create or replace function public.quo_restore_document(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  d public.quo_documents%rowtype;
  src public.quo_documents%rowtype;
  root_deal uuid;
  restore_status text;
begin
  if not public.quo_is_admin() then raise exception 'Admin access required'; end if;
  select * into d from public.quo_documents where id=p_document_id and deleted_at is not null for update;
  if not found then raise exception 'Deleted document not found'; end if;
  root_deal:=coalesce(d.deal_id,d.id);
  restore_status:=d.status;

  if d.document_type in ('quotation','proforma','invoice') and d.status<>'Cancelled' and exists(
    select 1 from public.quo_documents x where x.id<>d.id and x.deleted_at is null and x.status<>'Cancelled'
      and x.document_type=d.document_type and x.deal_id is not distinct from d.deal_id and d.deal_id is not null
  ) then raise exception 'Another active % already exists for this deal', d.document_type;
  end if;

  if d.source_document_id is not null then
    select * into src from public.quo_documents where id=d.source_document_id;
    if not found then raise exception 'Source document no longer exists'; end if;
    if src.deleted_at is not null then raise exception 'Restore the source document % first', src.document_number; end if;
  end if;

  if d.document_type='receipt' then
    if d.source_document_id is null then raise exception 'Receipt has no related Invoice'; end if;
    if not exists(select 1 from public.quo_documents i where i.id=d.source_document_id and i.document_type='invoice' and i.deleted_at is null) then
      raise exception 'Restore the related Invoice first';
    end if;
  end if;

  if d.document_type='quotation' and exists(
    select 1 from public.quo_documents x where x.deleted_at is null and x.status<>'Cancelled' and x.document_type='proforma' and x.deal_id=root_deal
  ) then restore_status:='Confirmed'; end if;

  if d.document_type='proforma' and exists(
    select 1 from public.quo_documents x where x.deleted_at is null and x.status<>'Cancelled' and x.document_type='invoice' and (x.source_document_id=d.id or x.deal_id=root_deal)
  ) then restore_status:='Converted'; end if;

  perform set_config('quo.allow_deleted_at_change','1',true);
  update public.quo_documents set deleted_at=null,deleted_by_name=null,status=restore_status where id=d.id;
  perform set_config('quo.allow_deleted_at_change','0',true);

  if d.document_type='proforma' and d.source_document_id is not null then
    update public.quo_documents set status='Confirmed' where id=d.source_document_id and document_type='quotation' and deleted_at is null;
  elsif d.document_type='invoice' and d.source_document_id is not null then
    update public.quo_documents set status='Converted' where id=d.source_document_id and document_type='proforma' and deleted_at is null;
  end if;

  return jsonb_build_object('id',d.id,'document_number',d.document_number,'document_type',d.document_type);
end;
$$;

revoke execute on function public.quo_restore_document(uuid) from public, anon, authenticated;
grant execute on function public.quo_restore_document(uuid) to authenticated;

create or replace function public.quo_convert_document(p_source_id uuid,p_target_type text,p_actor text default 'White Saffron')
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  src public.quo_documents%rowtype;
  target public.quo_documents%rowtype;
  existing public.quo_documents%rowtype;
  root_deal uuid;
  target_status text;
  v_invoice_terms text;
  v_validity integer:=15;
  v_today date:=(timezone('Indian/Maldives',now()))::date;
  v_due date;
  actor text:=public.quo_current_actor_name();
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  select * into src from public.quo_documents where id=p_source_id and deleted_at is null for update;
  if not found then raise exception 'Source document not found'; end if;
  if src.status='Cancelled' then raise exception 'Cancelled document cannot be converted'; end if;

  if src.document_type='quotation' and p_target_type<>'proforma' then
    raise exception 'Quotation must convert to Proforma Invoice first';
  elsif src.document_type='proforma' and p_target_type<>'invoice' then
    raise exception 'Proforma can convert only to Invoice';
  elsif src.document_type not in ('quotation','proforma') then
    raise exception 'This document cannot be converted';
  end if;

  root_deal:=coalesce(src.deal_id,case when src.document_type='quotation' then src.id else src.source_document_id end,src.id);
  select * into existing from public.quo_documents d
   where d.deal_id=root_deal and d.document_type=p_target_type and d.deleted_at is null and d.status<>'Cancelled'
   order by d.created_at limit 1;
  if found then return jsonb_build_object('created',false,'document',to_jsonb(existing)); end if;

  select qs.invoice_terms,coalesce(qs.default_validity_days,15)::integer into v_invoice_terms,v_validity
    from public.quo_settings qs where qs.id=1;
  v_due:=v_today+greatest(v_validity,0);
  target_status:=case when p_target_type='proforma' then 'Awaiting Payment' else 'Draft' end;

  insert into public.quo_documents(
    document_number,document_type,status,currency,creation_date,expires_on,
    customer_name,customer_phone,customer_address,event_name,service_enabled,service_type,service_from,service_to,service_pax,service_label,venue,
    items,gst_mode,gst_rate,discount,show_gst,include_menu,menu_title,menu_text,use_advance,advance_percent,advance_due,
    bank,account_no,slip_via,slip_contact,paid_amount,payment_reference,extra_terms,source_document_id,deal_id,created_by_name,updated_by_name,payment_status
  ) values (
    'NEW',p_target_type,target_status,src.currency,v_today,v_due,
    src.customer_name,src.customer_phone,src.customer_address,src.event_name,src.service_enabled,src.service_type,src.service_from,src.service_to,src.service_pax,src.service_label,src.venue,
    src.items,src.gst_mode,src.gst_rate,src.discount,src.show_gst,src.include_menu,src.menu_title,src.menu_text,false,0,null,
    src.bank,src.account_no,src.slip_via,src.slip_contact,0,null,
    case when p_target_type='invoice' then nullif(trim(coalesce(v_invoice_terms,'')),'') else null end,
    src.id,root_deal,actor,actor,case when p_target_type='invoice' then 'Unpaid' else 'Not Applicable' end
  ) returning * into target;

  if src.document_type='quotation' then
    update public.quo_documents set status='Confirmed',deal_id=root_deal where id=src.id;
  else
    update public.quo_documents set status='Converted',deal_id=root_deal where id=src.id;
  end if;
  return jsonb_build_object('created',true,'document',to_jsonb(target));
end;
$$;

revoke execute on function public.quo_convert_document(uuid,text,text) from public, anon;
grant execute on function public.quo_convert_document(uuid,text,text) to authenticated;

create or replace function public.quo_record_invoice_payment(p_invoice_id uuid,p_amount numeric,p_payment_date date,p_method text,p_reference text default null,p_actor text default 'White Saffron')
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  inv public.quo_documents%rowtype;
  receipt public.quo_documents%rowtype;
  total_value numeric;
  balance_value numeric;
  item jsonb;
  ref_text text;
  method_value text;
  reference_value text:=nullif(trim(coalesce(p_reference,'')),'');
  actor text:=public.quo_current_actor_name();
  v_today date:=(timezone('Indian/Maldives',now()))::date;
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_payment_date is null then raise exception 'Payment date is required'; end if;
  if p_payment_date>v_today then raise exception 'Payment date cannot be in the future'; end if;

  method_value:=case lower(trim(coalesce(p_method,'')))
    when 'bank transfer' then 'Bank Transfer'
    when 'cash' then 'Cash'
    when 'card' then 'Card'
    when 'other' then 'Other'
    else null end;
  if method_value is null then raise exception 'Payment method must be Bank Transfer, Cash, Card or Other'; end if;
  if method_value in ('Bank Transfer','Card') and reference_value is null then raise exception 'Transaction/reference is required for %',method_value; end if;
  if method_value='Other' and reference_value is null then raise exception 'Describe the other payment method or reference'; end if;

  select * into inv from public.quo_documents
   where id=p_invoice_id and document_type='invoice' and deleted_at is null for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status='Cancelled' then raise exception 'Cancelled invoice cannot receive payment'; end if;

  total_value:=public.quo_calculate_document_total(inv.items,inv.discount,inv.gst_mode,inv.gst_rate);
  balance_value:=greatest(total_value-coalesce(inv.paid_amount,0),0);
  if p_amount>balance_value+0.005 then raise exception 'Payment exceeds invoice balance'; end if;

  ref_text:=case when reference_value is null then method_value else method_value||' - '||reference_value end;
  item:=jsonb_build_array(jsonb_build_object('description','Payment received for '||inv.document_number,'qty',1,'unit','Payment','price',round(p_amount,2)));

  perform set_config('quo.allow_receipt_insert','1',true);
  insert into public.quo_documents(
    document_number,document_type,status,currency,creation_date,
    customer_name,customer_phone,customer_address,items,gst_mode,gst_rate,discount,
    paid_amount,payment_reference,source_document_id,deal_id,created_by_name,updated_by_name,extra_terms
  ) values (
    'NEW','receipt','Issued',inv.currency,p_payment_date,
    inv.customer_name,inv.customer_phone,inv.customer_address,item,'none',0,0,
    round(p_amount,2),ref_text,inv.id,coalesce(inv.deal_id,inv.id),actor,actor,
    'Payment received against '||inv.document_number||'. Method: '||method_value||case when reference_value is null then '.' else '. Reference: '||reference_value||'.' end
  ) returning * into receipt;
  perform set_config('quo.allow_receipt_insert','0',true);

  select * into inv from public.quo_documents where id=p_invoice_id;
  return jsonb_build_object('invoice',to_jsonb(inv),'receipt',to_jsonb(receipt));
end;
$$;

revoke execute on function public.quo_record_invoice_payment(uuid,numeric,date,text,text,text) from public, anon;
grant execute on function public.quo_record_invoice_payment(uuid,numeric,date,text,text,text) to authenticated;

-- The login screen may issue read-only bootstrap requests before a session is restored.
-- RLS still returns no Quo rows to anon. Anonymous writes remain revoked.
grant select on public.quo_documents to anon;
grant select on public.quo_settings to anon;
revoke insert,update,delete on public.quo_documents from anon;
revoke insert,update,delete on public.quo_settings from anon;
revoke select,insert,update,delete on public.quo_users from anon;

grant select,insert,update on public.quo_documents to authenticated;
grant select,update on public.quo_settings to authenticated;
grant select on public.quo_users to authenticated;
