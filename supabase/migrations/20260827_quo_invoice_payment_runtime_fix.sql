-- Quo invoice payment runtime fix, 2026-08-27.
-- 1) Allow the approved payment RPC to create its internal payment record.
-- 2) Repair receipt reconciliation after quo_invoice_effective_total() was removed in v74.

create or replace function public.quo_record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_method text,
  p_reference text default null,
  p_actor text default 'White Saffron'
)
returns jsonb
language plpgsql
set search_path=public
as $$
declare
  inv public.quo_documents%rowtype;
  receipt public.quo_documents%rowtype;
  total_value numeric;
  balance_value numeric;
  item jsonb;
  method_value text;
  reference_value text := nullif(trim(coalesce(p_reference,'')),'');
begin
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_payment_date is null then raise exception 'Payment date is required'; end if;

  method_value := case lower(trim(coalesce(p_method,'')))
    when 'bank transfer' then 'Bank Transfer'
    when 'transfer' then 'Bank Transfer'
    when 'cash' then 'Cash'
    when 'card' then 'Card'
    when 'cheque' then 'Cheque'
    when 'check' then 'Cheque'
    else null
  end;
  if method_value is null then raise exception 'Payment method must be Bank Transfer, Cash, Card or Cheque'; end if;

  select * into inv
  from public.quo_documents
  where id=p_invoice_id and document_type='invoice' and deleted_at is null
  for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status='Cancelled' then raise exception 'Cancelled invoice cannot receive payment'; end if;

  total_value:=public.quo_calculate_document_total(inv.items,inv.discount,inv.gst_mode,inv.gst_rate);
  balance_value:=greatest(total_value-coalesce(inv.paid_amount,0),0);
  if p_amount>balance_value+0.005 then raise exception 'Payment exceeds invoice balance'; end if;

  item:=jsonb_build_array(jsonb_build_object(
    'description','Payment received for '||inv.document_number,
    'qty',1,'unit','Payment','price',round(p_amount,2)
  ));

  perform set_config('quo.allow_receipt_insert','1',true);
  insert into public.quo_documents(
    document_number,document_type,status,currency,creation_date,
    customer_name,customer_phone,customer_address,items,gst_mode,gst_rate,discount,
    paid_amount,payment_method,payment_reference,source_document_id,deal_id,created_by_name,updated_by_name,extra_terms
  ) values (
    'NEW','receipt','Issued',inv.currency,p_payment_date,
    inv.customer_name,inv.customer_phone,inv.customer_address,item,'none',0,0,
    round(p_amount,2),method_value,reference_value,inv.id,coalesce(inv.deal_id,inv.id),
    coalesce(nullif(trim(p_actor),''),'White Saffron'),coalesce(nullif(trim(p_actor),''),'White Saffron'),
    'Payment received against '||inv.document_number||'. Method: '||method_value||case when reference_value is null then '.' else '. Reference: '||reference_value||'.' end
  ) returning * into receipt;
  perform set_config('quo.allow_receipt_insert','0',true);

  select * into inv from public.quo_documents where id=p_invoice_id;
  return jsonb_build_object('invoice',to_jsonb(inv),'receipt',to_jsonb(receipt));
exception when others then
  perform set_config('quo.allow_receipt_insert','0',true);
  raise;
end;
$$;

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

  select * into inv
  from public.quo_documents
  where id=invoice_id and document_type='invoice'
  for update;
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
  new_payment_status:=case
    when total_value<=0.005 then 'Paid'
    when received>=total_value-0.005 then 'Paid'
    when received>0.005 then 'Part Paid'
    else 'Unpaid'
  end;

  perform set_config('quo.allow_financial_reconcile','1',true);
  update public.quo_documents
     set paid_amount=received,
         payment_status=new_payment_status
   where id=invoice_id;
  perform set_config('quo.allow_financial_reconcile','0',true);

  return coalesce(new,old);
exception when others then
  perform set_config('quo.allow_financial_reconcile','0',true);
  raise;
end;
$$;
