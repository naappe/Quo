-- Applied to Supabase project tmupbruwmwlrmewhoodn on 2026-08-17.
-- Adds deal linkage, separate payment state, validation, immutable receipts,
-- atomic invoice payments and atomic document conversion.

alter table public.quo_documents add column if not exists deal_id uuid;
alter table public.quo_documents add column if not exists payment_status text not null default 'Not Applicable';
create index if not exists quo_documents_deal_id_idx on public.quo_documents(deal_id);
create index if not exists quo_documents_source_document_id_idx on public.quo_documents(source_document_id);

update public.quo_documents set deal_id=id where document_type='quotation' and deal_id is null;
update public.quo_documents d set deal_id=coalesce(s.deal_id,s.id) from public.quo_documents s where d.source_document_id=s.id and d.deal_id is null;

create or replace function public.quo_calculate_document_total(p_items jsonb,p_discount numeric,p_gst_mode text,p_gst_rate numeric)
returns numeric language plpgsql immutable as $$
declare raw_total numeric:=0; discount_value numeric:=greatest(coalesce(p_discount,0),0); base numeric; rate numeric:=greatest(coalesce(p_gst_rate,0),0); item jsonb;
begin
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'Items must be a JSON array'; end if;
  for item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    raw_total:=raw_total+greatest(coalesce(nullif(item->>'qty','')::numeric,0),0)*greatest(coalesce(nullif(item->>'price','')::numeric,0),0);
  end loop;
  discount_value:=least(discount_value,raw_total); base:=raw_total-discount_value;
  if coalesce(p_gst_mode,'none')='exclusive' then return round(base+base*rate/100,2); end if;
  return round(base,2);
end;$$;

create or replace function public.quo_validate_document_integrity() returns trigger language plpgsql as $$
declare item jsonb; src_deal uuid;
begin
  if new.document_type not in ('quotation','proforma','invoice','receipt') then raise exception 'Invalid document type'; end if;
  if coalesce(new.discount,0)<0 then raise exception 'Discount cannot be negative'; end if;
  if coalesce(new.gst_rate,0)<0 or coalesce(new.gst_rate,0)>100 then raise exception 'GST rate must be between 0 and 100'; end if;
  if coalesce(new.service_pax,0)<0 then raise exception 'Guest count cannot be negative'; end if;
  if coalesce(new.paid_amount,0)<0 then raise exception 'Paid amount cannot be negative'; end if;
  if jsonb_typeof(coalesce(new.items,'[]'::jsonb))<>'array' then raise exception 'Items must be a JSON array'; end if;
  for item in select value from jsonb_array_elements(coalesce(new.items,'[]'::jsonb)) loop
    if coalesce(nullif(item->>'qty','')::numeric,0)<0 then raise exception 'Item quantity cannot be negative'; end if;
    if coalesce(nullif(item->>'price','')::numeric,0)<0 then raise exception 'Item rate cannot be negative'; end if;
  end loop;
  if new.document_type='quotation' and new.deal_id is null then new.deal_id:=new.id; end if;
  if new.deal_id is null and new.source_document_id is not null then select coalesce(deal_id,id) into src_deal from public.quo_documents where id=new.source_document_id; new.deal_id:=src_deal; end if;
  if new.document_type='invoice' and coalesce(new.payment_status,'Not Applicable')='Not Applicable' then new.payment_status:='Unpaid'; end if;
  if new.document_type<>'invoice' then new.payment_status:='Not Applicable'; end if;
  if new.payment_status not in ('Not Applicable','Unpaid','Part Paid','Paid') then raise exception 'Invalid payment status'; end if;
  return new;
end;$$;

drop trigger if exists quo_documents_validate_integrity on public.quo_documents;
create trigger quo_documents_validate_integrity before insert or update on public.quo_documents for each row execute function public.quo_validate_document_integrity();

create or replace function public.quo_protect_receipt_financials() returns trigger language plpgsql as $$
begin
  if old.document_type='receipt' and (
    new.items is distinct from old.items or new.currency is distinct from old.currency or new.creation_date is distinct from old.creation_date or
    new.customer_name is distinct from old.customer_name or new.customer_phone is distinct from old.customer_phone or new.customer_address is distinct from old.customer_address or
    new.source_document_id is distinct from old.source_document_id or new.deal_id is distinct from old.deal_id or new.payment_reference is distinct from old.payment_reference or
    new.paid_amount is distinct from old.paid_amount or new.discount is distinct from old.discount or new.gst_mode is distinct from old.gst_mode or new.gst_rate is distinct from old.gst_rate
  ) then raise exception 'Issued receipt financial details are immutable. Void the receipt instead.'; end if;
  return new;
end;$$;

drop trigger if exists quo_documents_protect_receipt_financials on public.quo_documents;
create trigger quo_documents_protect_receipt_financials before update on public.quo_documents for each row execute function public.quo_protect_receipt_financials();

create or replace function public.quo_reconcile_invoice_from_receipts() returns trigger language plpgsql security definer set search_path=public as $$
declare invoice_id uuid; inv public.quo_documents%rowtype; total_value numeric; received numeric; new_payment_status text;
begin
  invoice_id:=coalesce(new.source_document_id,old.source_document_id); if invoice_id is null then return coalesce(new,old); end if;
  select * into inv from public.quo_documents where id=invoice_id and document_type='invoice' for update; if not found then return coalesce(new,old); end if;
  total_value:=public.quo_calculate_document_total(inv.items,inv.discount,inv.gst_mode,inv.gst_rate);
  select coalesce(sum(public.quo_calculate_document_total(r.items,r.discount,r.gst_mode,r.gst_rate)),0) into received from public.quo_documents r where r.document_type='receipt' and r.source_document_id=invoice_id and r.deleted_at is null and r.status<>'Cancelled';
  received:=least(received,total_value); new_payment_status:=case when total_value>0 and received>=total_value then 'Paid' when received>0 then 'Part Paid' else 'Unpaid' end;
  update public.quo_documents set paid_amount=received,payment_status=new_payment_status where id=invoice_id; return coalesce(new,old);
end;$$;

drop trigger if exists quo_receipt_reconcile_invoice on public.quo_documents;
create trigger quo_receipt_reconcile_invoice after insert or update of deleted_at,status on public.quo_documents for each row when (new.document_type='receipt') execute function public.quo_reconcile_invoice_from_receipts();

-- Atomic payment and conversion RPCs are defined in the production migration.
-- See Supabase migration history for the full function definitions:
-- public.quo_record_invoice_payment(...)
-- public.quo_convert_document(...)
