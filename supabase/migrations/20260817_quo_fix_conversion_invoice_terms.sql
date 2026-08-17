-- Applied after quo_commercial_workflow_integrity.
-- Fixes invoice_terms ambiguity and uses Maldives business date for conversions.

create or replace function public.quo_convert_document(
  p_source_id uuid,
  p_target_type text,
  p_actor text default 'White Saffron'
) returns jsonb
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
  v_today date := (timezone('Indian/Maldives', now()))::date;
begin
  select * into src from public.quo_documents where id=p_source_id and deleted_at is null for update;
  if not found then raise exception 'Source document not found'; end if;
  if src.status='Cancelled' then raise exception 'Cancelled document cannot be converted'; end if;
  if p_target_type not in ('proforma','invoice') then raise exception 'Invalid conversion target'; end if;
  if src.document_type='proforma' and p_target_type<>'invoice' then raise exception 'Proforma can convert only to Invoice'; end if;
  if src.document_type not in ('quotation','proforma') then raise exception 'This document cannot be converted'; end if;

  root_deal:=coalesce(src.deal_id,case when src.document_type='quotation' then src.id else src.source_document_id end,src.id);
  select * into existing from public.quo_documents d
   where d.deal_id=root_deal and d.document_type=p_target_type and d.deleted_at is null and d.status<>'Cancelled'
   order by d.created_at limit 1;
  if found then return jsonb_build_object('created',false,'document',to_jsonb(existing)); end if;

  if p_target_type='invoice' and src.document_type='quotation' and exists(
    select 1 from public.quo_documents d where d.deal_id=root_deal and d.document_type='proforma' and d.deleted_at is null and d.status<>'Cancelled'
  ) then raise exception 'A Proforma Invoice already exists for this quotation. Convert that Proforma to Invoice.'; end if;

  target_status:=case when p_target_type='proforma' then 'Awaiting Payment' else 'Draft' end;
  select qs.invoice_terms into v_invoice_terms from public.quo_settings qs where qs.id=1;

  insert into public.quo_documents(
    document_number,document_type,status,currency,creation_date,expires_on,
    customer_name,customer_phone,customer_address,event_name,service_enabled,service_type,service_from,service_to,service_pax,service_label,venue,
    items,gst_mode,gst_rate,discount,show_gst,include_menu,menu_title,menu_text,use_advance,advance_percent,advance_due,
    bank,account_no,slip_via,slip_contact,paid_amount,payment_reference,extra_terms,source_document_id,deal_id,created_by_name,updated_by_name,payment_status
  ) values (
    'NEW',p_target_type,target_status,src.currency,v_today,src.expires_on,
    src.customer_name,src.customer_phone,src.customer_address,src.event_name,src.service_enabled,src.service_type,src.service_from,src.service_to,src.service_pax,src.service_label,src.venue,
    src.items,src.gst_mode,src.gst_rate,src.discount,src.show_gst,src.include_menu,src.menu_title,src.menu_text,false,0,null,
    src.bank,src.account_no,src.slip_via,src.slip_contact,0,null,case when p_target_type='invoice' then coalesce(v_invoice_terms,src.extra_terms) else src.extra_terms end,
    src.id,root_deal,coalesce(nullif(trim(p_actor),''),'White Saffron'),coalesce(nullif(trim(p_actor),''),'White Saffron'),case when p_target_type='invoice' then 'Unpaid' else 'Not Applicable' end
  ) returning * into target;

  if src.document_type='quotation' then
    update public.quo_documents set status='Confirmed',deal_id=root_deal,updated_by_name=coalesce(nullif(trim(p_actor),''),'White Saffron') where id=src.id;
  elsif src.document_type='proforma' and p_target_type='invoice' then
    update public.quo_documents set status='Converted',deal_id=root_deal,updated_by_name=coalesce(nullif(trim(p_actor),''),'White Saffron') where id=src.id;
  end if;
  return jsonb_build_object('created',true,'document',to_jsonb(target));
end;
$$;

grant execute on function public.quo_convert_document(uuid,text,text) to anon,authenticated;
