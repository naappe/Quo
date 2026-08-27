-- Applied to Supabase project tmupbruwmwlrmewhoodn on 2026-08-27.
-- Store payment method on receipt records. Reference number is optional for all supported methods.

alter table public.quo_documents add column if not exists payment_method text;

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

  insert into public.quo_documents(
    document_number,document_type,status,currency,creation_date,
    customer_name,customer_phone,customer_address,items,gst_mode,gst_rate,discount,
    paid_amount,payment_method,payment_reference,source_document_id,deal_id,
    created_by_name,updated_by_name,extra_terms
  ) values (
    'NEW','receipt','Issued',inv.currency,p_payment_date,
    inv.customer_name,inv.customer_phone,inv.customer_address,item,'none',0,0,
    round(p_amount,2),method_value,reference_value,inv.id,coalesce(inv.deal_id,inv.id),
    coalesce(nullif(trim(p_actor),''),'White Saffron'),coalesce(nullif(trim(p_actor),''),'White Saffron'),
    'Payment received against '||inv.document_number||'. Method: '||method_value||
      case when reference_value is null then '.' else '. Reference: '||reference_value||'.' end
  ) returning * into receipt;

  select * into inv from public.quo_documents where id=p_invoice_id;
  return jsonb_build_object('invoice',to_jsonb(inv),'receipt',to_jsonb(receipt));
end;
$$;
