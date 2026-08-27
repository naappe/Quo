-- Preserve the original document creation date across the commercial conversion chain.
-- Quotation -> Proforma -> Invoice must keep the source creation_date.
-- The converted document validity/due date continues to be calculated from the conversion day.

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

  if src.document_type='quotation' and p_target_type<>'proforma' then
    raise exception 'Quotation must convert to Proforma Invoice first';
  elsif src.document_type='proforma' and p_target_type<>'invoice' then
    raise exception 'Proforma can convert only to Invoice';
  elsif src.document_type not in ('quotation','proforma') then
    raise exception 'This document cannot be converted';
  end if;

  root_deal:=coalesce(src.deal_id,case when src.document_type='quotation' then src.id else src.source_document_id end,src.id);
  select * into existing from public.quo_documents d
   where d.deal_id=root_deal and d.document_type=p_target_type and d.deleted_at is null and d.status not in ('Cancelled','Superseded')
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
    'NEW',p_target_type,target_status,src.currency,src.creation_date,v_due,
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

revoke all on function public.quo_convert_document(uuid,text,text) from public, anon;
grant execute on function public.quo_convert_document(uuid,text,text) to authenticated;
