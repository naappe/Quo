alter table public.quo_documents
  add column if not exists revision_root_id uuid references public.quo_documents(id) on delete set null,
  add column if not exists revision_no integer not null default 0,
  add column if not exists supersedes_document_id uuid references public.quo_documents(id) on delete set null,
  add column if not exists superseded_by_id uuid references public.quo_documents(id) on delete set null,
  add column if not exists amendment_reason text,
  add column if not exists void_reason text;

alter table public.quo_documents drop constraint if exists quo_documents_revision_no_check;
alter table public.quo_documents add constraint quo_documents_revision_no_check check (revision_no >= 0);

update public.quo_documents
set revision_root_id = id,
    revision_no = coalesce(revision_no,0)
where revision_root_id is null
  and document_type in ('quotation','proforma','invoice');

create index if not exists quo_documents_revision_root_idx on public.quo_documents(revision_root_id, revision_no, created_at);
create index if not exists quo_documents_supersedes_idx on public.quo_documents(supersedes_document_id);
create index if not exists quo_documents_superseded_by_idx on public.quo_documents(superseded_by_id);

drop index if exists public.quo_documents_active_deal_type_uidx;
create unique index quo_documents_active_deal_type_uidx
  on public.quo_documents(deal_id, document_type)
  where deleted_at is null
    and deal_id is not null
    and document_type in ('quotation','proforma','invoice')
    and status not in ('Cancelled','Superseded');

create or replace function public.quo_guard_issued_content()
returns trigger
language plpgsql
set search_path = public
as $$
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
     ) then
    raise exception 'Issued document content is locked. Use Amend to create a new revision.';
  end if;
  return new;
end;
$$;
revoke all on function public.quo_guard_issued_content() from public, anon, authenticated;
drop trigger if exists quo_documents_guard_issued_content on public.quo_documents;
create trigger quo_documents_guard_issued_content before update on public.quo_documents for each row execute function public.quo_guard_issued_content();

create or replace function public.quo_guard_workflow_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  root_deal uuid := coalesce(new.deal_id,old.deal_id,old.id);
  has_pi boolean;
  has_invoice boolean;
  internal_change boolean := coalesce(current_setting('quo.allow_document_revision',true),'0')='1';
begin
  if new.status is not distinct from old.status then return new; end if;
  if not internal_change and new.status in ('Cancelled','Superseded') then
    raise exception 'Use the Quo Void or Amend action for this status change';
  end if;
  if internal_change then return new; end if;

  if old.document_type='quotation' then
    select exists(select 1 from public.quo_documents d where d.deleted_at is null and d.status not in ('Cancelled','Superseded') and d.document_type='proforma' and (d.source_document_id=old.id or d.deal_id=root_deal)) into has_pi;
    if new.status='Confirmed' and not has_pi then raise exception 'Confirming a quotation must create its Proforma Invoice'; end if;
    if old.status='Confirmed' and new.status<>'Confirmed' and has_pi then raise exception 'This quotation has an active Proforma Invoice. Resolve that Proforma first.'; end if;
  elsif old.document_type='proforma' then
    select exists(select 1 from public.quo_documents d where d.deleted_at is null and d.status not in ('Cancelled','Superseded') and d.document_type='invoice' and (d.source_document_id=old.id or d.deal_id=root_deal)) into has_invoice;
    if new.status='Converted' and not has_invoice then raise exception 'Converted status requires a linked Invoice'; end if;
    if old.status='Converted' and new.status<>'Converted' and has_invoice then raise exception 'This Proforma has an active Invoice and must remain Converted'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.quo_validate_document_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item jsonb;
  src_deal uuid;
begin
  if new.document_type not in ('quotation','proforma','invoice','receipt') then raise exception 'Invalid document type'; end if;
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
$$;

create or replace function public.quo_amend_document(p_document_id uuid, p_reason text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  src public.quo_documents%rowtype;
  root public.quo_documents%rowtype;
  target public.quo_documents%rowtype;
  active_pi public.quo_documents%rowtype;
  active_invoice public.quo_documents%rowtype;
  root_id uuid;
  next_rev integer;
  reason_text text := nullif(trim(coalesce(p_reason,'')),'');
  new_number text;
  actor text := public.quo_current_actor_name();
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  if reason_text is null then raise exception 'Amendment reason is required'; end if;
  select * into src from public.quo_documents where id=p_document_id and deleted_at is null for update;
  if not found then raise exception 'Document not found'; end if;
  if src.document_type='receipt' then raise exception 'Receipts cannot be amended. Void the receipt and record the payment again.'; end if;
  if src.document_type not in ('quotation','proforma','invoice') then raise exception 'This document cannot be amended'; end if;
  if src.status='Draft' then raise exception 'Draft documents can be edited directly and do not need an amendment'; end if;
  if src.status in ('Cancelled','Superseded') then raise exception 'Cancelled or superseded documents cannot be amended'; end if;

  if src.document_type='quotation' then
    select * into active_pi from public.quo_documents p where p.deleted_at is null and p.document_type='proforma' and p.status not in ('Cancelled','Superseded') and (p.source_document_id=src.id or p.deal_id=coalesce(src.deal_id,src.id)) order by p.created_at desc limit 1 for update;
    if found then
      select * into active_invoice from public.quo_documents i where i.deleted_at is null and i.document_type='invoice' and i.status not in ('Cancelled','Superseded') and (i.source_document_id=active_pi.id or i.deal_id=coalesce(src.deal_id,src.id)) order by i.created_at desc limit 1;
      if found then raise exception 'This quotation already has an active Invoice. Amendments must be handled from the Invoice.'; end if;
    end if;
  elsif src.document_type='proforma' then
    select * into active_invoice from public.quo_documents i where i.deleted_at is null and i.document_type='invoice' and i.status not in ('Cancelled','Superseded') and (i.source_document_id=src.id or i.deal_id=coalesce(src.deal_id,src.id)) order by i.created_at desc limit 1;
    if found then raise exception 'This Proforma already has an active Invoice and cannot be amended'; end if;
  elsif src.document_type='invoice' then
    if coalesce(src.paid_amount,0) > 0.005 or exists(select 1 from public.quo_documents r where r.document_type='receipt' and r.source_document_id=src.id and r.deleted_at is null and r.status<>'Cancelled') then
      raise exception 'This Invoice has recorded payment activity. Do not amend it directly; use a Credit Note or Debit Note workflow.';
    end if;
  end if;

  root_id:=coalesce(src.revision_root_id,src.id);
  select * into root from public.quo_documents where id=root_id;
  if not found then root:=src; end if;
  select coalesce(max(d.revision_no),0)+1 into next_rev from public.quo_documents d where d.revision_root_id=root_id or d.id=root_id;
  new_number:=regexp_replace(root.document_number,'-R[0-9]+$','','i')||'-R'||next_rev::text;

  perform set_config('quo.allow_document_revision','1',true);
  if src.document_type='quotation' and active_pi.id is not null then
    update public.quo_documents set status='Superseded',amendment_reason='Superseded because '||src.document_number||' was amended: '||reason_text,updated_by_name=actor where id=active_pi.id;
  end if;
  update public.quo_documents set status='Superseded',amendment_reason=reason_text,updated_by_name=actor where id=src.id;

  insert into public.quo_documents(
    document_number,document_type,status,currency,creation_date,expires_on,
    customer_name,customer_phone,customer_address,event_name,service_enabled,service_type,service_from,service_to,service_pax,service_label,venue,
    items,gst_mode,gst_rate,discount,show_gst,include_menu,menu_title,menu_text,use_advance,advance_percent,advance_due,
    bank,account_no,slip_via,slip_contact,paid_amount,payment_reference,extra_terms,source_document_id,deal_id,payment_status,
    revision_root_id,revision_no,supersedes_document_id,amendment_reason,created_by_name,updated_by_name
  ) values (
    new_number,src.document_type,'Draft',src.currency,src.creation_date,src.expires_on,
    src.customer_name,src.customer_phone,src.customer_address,src.event_name,src.service_enabled,src.service_type,src.service_from,src.service_to,src.service_pax,src.service_label,src.venue,
    src.items,src.gst_mode,src.gst_rate,src.discount,src.show_gst,src.include_menu,src.menu_title,src.menu_text,src.use_advance,src.advance_percent,src.advance_due,
    src.bank,src.account_no,src.slip_via,src.slip_contact,0,null,src.extra_terms,src.source_document_id,coalesce(src.deal_id,src.id),case when src.document_type='invoice' then 'Unpaid' else 'Not Applicable' end,
    root_id,next_rev,src.id,reason_text,actor,actor
  ) returning * into target;

  update public.quo_documents set superseded_by_id=target.id,updated_by_name=actor where id=src.id;
  perform set_config('quo.allow_document_revision','0',true);
  return jsonb_build_object('created',true,'document',to_jsonb(target),'superseded_document',src.document_number,'revision',next_rev,'downstream_proforma_superseded',case when active_pi.id is null then null else active_pi.document_number end);
end;
$$;
revoke all on function public.quo_amend_document(uuid,text) from public, anon;
grant execute on function public.quo_amend_document(uuid,text) to authenticated;

create or replace function public.quo_void_document(p_document_id uuid, p_reason text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  src public.quo_documents%rowtype;
  reason_text text := nullif(trim(coalesce(p_reason,'')),'');
  root_deal uuid;
  actor text := public.quo_current_actor_name();
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  if reason_text is null then raise exception 'Void reason is required'; end if;
  select * into src from public.quo_documents where id=p_document_id and deleted_at is null for update;
  if not found then raise exception 'Document not found'; end if;
  if src.status in ('Cancelled','Superseded') then raise exception 'This document is already inactive'; end if;
  root_deal:=coalesce(src.deal_id,src.id);

  if src.document_type='quotation' and exists(select 1 from public.quo_documents p where p.deleted_at is null and p.document_type='proforma' and p.status not in ('Cancelled','Superseded') and (p.source_document_id=src.id or p.deal_id=root_deal)) then raise exception 'This quotation has an active Proforma. Resolve or amend the Proforma chain first.'; end if;
  if src.document_type='proforma' and exists(select 1 from public.quo_documents i where i.deleted_at is null and i.document_type='invoice' and i.status not in ('Cancelled','Superseded') and (i.source_document_id=src.id or i.deal_id=root_deal)) then raise exception 'This Proforma has an active Invoice and cannot be voided directly'; end if;
  if src.document_type='invoice' and (coalesce(src.paid_amount,0)>0.005 or exists(select 1 from public.quo_documents r where r.document_type='receipt' and r.source_document_id=src.id and r.deleted_at is null and r.status<>'Cancelled')) then raise exception 'This Invoice has payment activity. Void the receipt/payment first before voiding the Invoice.'; end if;

  perform set_config('quo.allow_document_revision','1',true);
  update public.quo_documents set status='Cancelled',void_reason=reason_text,updated_by_name=actor where id=src.id returning * into src;
  perform set_config('quo.allow_document_revision','0',true);
  return jsonb_build_object('document',to_jsonb(src),'voided',true);
end;
$$;
revoke all on function public.quo_void_document(uuid,text) from public, anon;
grant execute on function public.quo_void_document(uuid,text) to authenticated;

create or replace function public.quo_convert_document(p_source_id uuid, p_target_type text, p_actor text default 'White Saffron')
returns jsonb
language plpgsql
set search_path = public
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
  if src.status in ('Cancelled','Superseded') then raise exception 'Cancelled or superseded document cannot be converted'; end if;
  if src.document_type='quotation' and p_target_type<>'proforma' then raise exception 'Quotation must convert to Proforma Invoice first';
  elsif src.document_type='proforma' and p_target_type<>'invoice' then raise exception 'Proforma can convert only to Invoice';
  elsif src.document_type not in ('quotation','proforma') then raise exception 'This document cannot be converted'; end if;

  root_deal:=coalesce(src.deal_id,case when src.document_type='quotation' then src.id else src.source_document_id end,src.id);
  select * into existing from public.quo_documents d where d.deal_id=root_deal and d.document_type=p_target_type and d.deleted_at is null and d.status not in ('Cancelled','Superseded') order by d.created_at limit 1;
  if found then return jsonb_build_object('created',false,'document',to_jsonb(existing)); end if;

  select qs.invoice_terms,coalesce(qs.default_validity_days,15)::integer into v_invoice_terms,v_validity from public.quo_settings qs where qs.id=1;
  v_due:=v_today+greatest(v_validity,0);
  target_status:=case when p_target_type='proforma' then 'Awaiting Payment' else 'Draft' end;
  insert into public.quo_documents(document_number,document_type,status,currency,creation_date,expires_on,customer_name,customer_phone,customer_address,event_name,service_enabled,service_type,service_from,service_to,service_pax,service_label,venue,items,gst_mode,gst_rate,discount,show_gst,include_menu,menu_title,menu_text,use_advance,advance_percent,advance_due,bank,account_no,slip_via,slip_contact,paid_amount,payment_reference,extra_terms,source_document_id,deal_id,created_by_name,updated_by_name,payment_status)
  values('NEW',p_target_type,target_status,src.currency,v_today,v_due,src.customer_name,src.customer_phone,src.customer_address,src.event_name,src.service_enabled,src.service_type,src.service_from,src.service_to,src.service_pax,src.service_label,src.venue,src.items,src.gst_mode,src.gst_rate,src.discount,src.show_gst,src.include_menu,src.menu_title,src.menu_text,false,0,null,src.bank,src.account_no,src.slip_via,src.slip_contact,0,null,case when p_target_type='invoice' then nullif(trim(coalesce(v_invoice_terms,'')),'') else null end,src.id,root_deal,actor,actor,case when p_target_type='invoice' then 'Unpaid' else 'Not Applicable' end)
  returning * into target;
  if src.document_type='quotation' then update public.quo_documents set status='Confirmed',deal_id=root_deal where id=src.id; else update public.quo_documents set status='Converted',deal_id=root_deal where id=src.id; end if;
  return jsonb_build_object('created',true,'document',to_jsonb(target));
end;
$$;

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
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  select jsonb_build_object(
    'active_documents',(select count(*) from public.quo_documents where deleted_at is null and status not in ('Cancelled','Superseded')),
    'historical_revisions',(select count(*) from public.quo_documents where deleted_at is null and status='Superseded'),
    'active_customers',(select count(*) from public.quo_customers where is_active),
    'documents_without_customer',(select count(*) from public.quo_documents where deleted_at is null and status not in ('Cancelled','Superseded') and nullif(trim(customer_name),'') is not null and customer_id is null),
    'confirmed_quotes_without_proforma',(select count(*) from public.quo_documents q where q.deleted_at is null and q.document_type='quotation' and q.status='Confirmed' and not exists(select 1 from public.quo_documents p where p.deleted_at is null and p.status not in ('Cancelled','Superseded') and p.document_type='proforma' and (p.source_document_id=q.id or p.deal_id=q.deal_id))),
    'converted_proformas_without_invoice',(select count(*) from public.quo_documents p where p.deleted_at is null and p.document_type='proforma' and p.status='Converted' and not exists(select 1 from public.quo_documents i where i.deleted_at is null and i.status not in ('Cancelled','Superseded') and i.document_type='invoice' and (i.source_document_id=p.id or i.deal_id=p.deal_id))),
    'receipts_without_invoice',(select count(*) from public.quo_documents r where r.deleted_at is null and r.document_type='receipt' and r.status<>'Cancelled' and not exists(select 1 from public.quo_documents i where i.deleted_at is null and i.document_type='invoice' and i.id=r.source_document_id)),
    'duplicate_active_deal_types',(select count(*) from (select deal_id,document_type from public.quo_documents where deleted_at is null and deal_id is not null and document_type in ('quotation','proforma','invoice') and status not in ('Cancelled','Superseded') group by deal_id,document_type having count(*)>1) x)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.quo_system_health() from public, anon;
grant execute on function public.quo_system_health() to authenticated;