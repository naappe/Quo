-- Quo v76: Supply Usage should normally be recorded against the final Invoice.
-- A Quotation is available only while that commercial chain has no active Invoice.

create or replace function public.quo_supply_usage_document_options(p_limit integer default 1000)
returns table(
  document_id uuid,
  document_number text,
  document_type text,
  customer_name text,
  event_name text,
  document_status text,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path=public,pg_temp
as $func$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.quo_is_admin() then raise exception 'Administrator access required'; end if;

  return query
  select
    d.id,
    d.document_number,
    d.document_type,
    d.customer_name,
    d.event_name,
    d.status,
    coalesce(d.updated_at,d.created_at)
  from public.quo_documents d
  where d.deleted_at is null
    and d.status not in ('Cancelled','Superseded')
    and (
      d.document_type='invoice'
      or (
        d.document_type='quotation'
        and not exists (
          select 1
          from public.quo_documents i
          where i.deleted_at is null
            and i.status not in ('Cancelled','Superseded')
            and i.document_type='invoice'
            and (
              i.source_document_id=d.id
              or (
                coalesce(d.deal_id,d.id) is not null
                and i.deal_id=coalesce(d.deal_id,d.id)
              )
            )
        )
      )
    )
  order by case when d.document_type='invoice' then 0 else 1 end,
           coalesce(d.updated_at,d.created_at) desc,
           d.document_number desc
  limit greatest(1,least(coalesce(p_limit,1000),2000));
end;
$func$;

create or replace function public.quo_add_supply_usage_lines(
  p_document_id uuid,
  p_used_on date,
  p_lines jsonb
)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $func$
declare
  v_line jsonb;
  v_vendor text;
  v_name text;
  v_unit text;
  v_note text;
  v_qty numeric;
  v_count integer:=0;
  v_type text;
  v_deal uuid;
  v_invoice_no text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.quo_is_admin() then raise exception 'Administrator access required'; end if;

  select d.document_type,coalesce(d.deal_id,d.id)
    into v_type,v_deal
  from public.quo_documents d
  where d.id=p_document_id
    and d.deleted_at is null
    and d.status not in ('Cancelled','Superseded')
    and d.document_type in ('quotation','invoice');

  if v_type is null then
    raise exception 'Select an existing Final Invoice or eligible Quotation';
  end if;

  if v_type='quotation' then
    select i.document_number
      into v_invoice_no
    from public.quo_documents i
    where i.deleted_at is null
      and i.status not in ('Cancelled','Superseded')
      and i.document_type='invoice'
      and (
        i.source_document_id=p_document_id
        or (v_deal is not null and i.deal_id=v_deal)
      )
    order by coalesce(i.updated_at,i.created_at) desc
    limit 1;

    if v_invoice_no is not null then
      raise exception 'This quotation already has Final Invoice %. Select that Invoice for Supply Usage.',v_invoice_no;
    end if;
  end if;

  if jsonb_typeof(coalesce(p_lines,'[]'::jsonb))<>'array' then
    raise exception 'Supply lines must be a list';
  end if;
  if jsonb_array_length(coalesce(p_lines,'[]'::jsonb))<1 then
    raise exception 'Add at least one supply line';
  end if;
  if jsonb_array_length(p_lines)>50 then
    raise exception 'A maximum of 50 supply lines can be saved at once';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_vendor:=btrim(coalesce(v_line->>'vendor',''));
    v_name:=btrim(coalesce(v_line->>'supply',''));
    v_unit:=upper(btrim(coalesce(v_line->>'unit','PCS')));
    v_note:=nullif(btrim(coalesce(v_line->>'note','')),'');

    begin
      v_qty:=nullif(btrim(coalesce(v_line->>'quantity','')),'')::numeric;
    exception when others then
      raise exception 'Enter a valid quantity for %',coalesce(nullif(v_name,''),'the supply line');
    end;

    if v_vendor='' then raise exception 'Select or enter a vendor for every supply line'; end if;
    if v_name='' then raise exception 'Enter the supply name for every line'; end if;
    if coalesce(v_qty,0)<=0 then raise exception 'Quantity must be greater than zero for %',v_name; end if;
    if v_unit not in ('KG','G','PCS','L','ML','CSE') then raise exception 'Invalid unit for %',v_name; end if;

    insert into public.quo_supply_usage(
      document_id,vendor_name,supply_name,quantity,unit,used_on,note,created_by
    ) values (
      p_document_id,v_vendor,v_name,round(v_qty,4),v_unit,coalesce(p_used_on,current_date),v_note,auth.uid()
    );
    v_count:=v_count+1;
  end loop;

  return v_count;
end;
$func$;

-- Keep the old one-line RPC safe during browser cache rollover as well.
create or replace function public.quo_add_supply_usage(
  p_document_id uuid,
  p_supply_name text,
  p_quantity numeric,
  p_unit text,
  p_used_on date default current_date,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path=public,pg_temp
as $func$
declare
  v_id bigint;
  v_unit text:=upper(btrim(coalesce(p_unit,'PCS')));
  v_name text:=btrim(coalesce(p_supply_name,''));
  v_type text;
  v_deal uuid;
  v_invoice_no text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.quo_is_admin() then raise exception 'Administrator access required'; end if;
  if v_name='' then raise exception 'Enter the supply name'; end if;
  if coalesce(p_quantity,0)<=0 then raise exception 'Quantity must be greater than zero'; end if;
  if v_unit not in ('KG','G','PCS','L','ML','CSE') then raise exception 'Invalid unit'; end if;

  select d.document_type,coalesce(d.deal_id,d.id)
    into v_type,v_deal
  from public.quo_documents d
  where d.id=p_document_id
    and d.deleted_at is null
    and d.status not in ('Cancelled','Superseded')
    and d.document_type in ('quotation','invoice');

  if v_type is null then raise exception 'Select an existing Final Invoice or eligible Quotation'; end if;

  if v_type='quotation' then
    select i.document_number into v_invoice_no
    from public.quo_documents i
    where i.deleted_at is null
      and i.status not in ('Cancelled','Superseded')
      and i.document_type='invoice'
      and (i.source_document_id=p_document_id or (v_deal is not null and i.deal_id=v_deal))
    order by coalesce(i.updated_at,i.created_at) desc
    limit 1;
    if v_invoice_no is not null then
      raise exception 'This quotation already has Final Invoice %. Select that Invoice for Supply Usage.',v_invoice_no;
    end if;
  end if;

  insert into public.quo_supply_usage(document_id,vendor_name,supply_name,quantity,unit,used_on,note,created_by)
  values(p_document_id,'Not recorded',v_name,round(p_quantity,4),v_unit,coalesce(p_used_on,current_date),nullif(btrim(coalesce(p_note,'')),''),auth.uid())
  returning id into v_id;
  return v_id;
end;
$func$;

revoke all on function public.quo_supply_usage_document_options(integer) from public,anon;
grant execute on function public.quo_supply_usage_document_options(integer) to authenticated;
revoke all on function public.quo_add_supply_usage_lines(uuid,date,jsonb) from public,anon;
grant execute on function public.quo_add_supply_usage_lines(uuid,date,jsonb) to authenticated;
