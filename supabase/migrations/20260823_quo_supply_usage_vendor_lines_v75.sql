-- Quo v75: keep Supply Usage simple, but support vendor + multiple supply lines.
-- One existing Quo document is selected, then Admin records one or more supply lines.

alter table public.quo_supply_usage
  add column if not exists vendor_name text;

update public.quo_supply_usage
set vendor_name='Not recorded'
where vendor_name is null or btrim(vendor_name)='';

alter table public.quo_supply_usage
  alter column vendor_name set not null;

create index if not exists quo_supply_usage_vendor_name_idx
  on public.quo_supply_usage(lower(vendor_name));

-- Replace the list RPC so Vendor is part of history/search.
drop function if exists public.quo_supply_usage_list(text,uuid,integer);
create function public.quo_supply_usage_list(
  p_search text default null,
  p_document_id uuid default null,
  p_limit integer default 500
)
returns table(
  usage_id bigint,
  document_id uuid,
  document_number text,
  document_type text,
  document_status text,
  customer_name text,
  event_name text,
  service_from date,
  service_to date,
  vendor_name text,
  supply_name text,
  quantity numeric,
  unit text,
  used_on date,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=public,pg_temp
as $func$
declare
  v_search text:=lower(btrim(coalesce(p_search,'')));
  v_limit integer:=greatest(1,least(coalesce(p_limit,500),1000));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.quo_is_admin() then raise exception 'Administrator access required'; end if;

  return query
  select
    u.id,
    d.id,
    d.document_number,
    d.document_type,
    d.status,
    d.customer_name,
    d.event_name,
    d.service_from,
    d.service_to,
    u.vendor_name,
    u.supply_name,
    u.quantity,
    u.unit,
    u.used_on,
    u.note,
    u.created_at
  from public.quo_supply_usage u
  join public.quo_documents d on d.id=u.document_id
  where d.deleted_at is null
    and (p_document_id is null or u.document_id=p_document_id)
    and (
      v_search=''
      or lower(coalesce(u.vendor_name,'')) like '%'||v_search||'%'
      or lower(coalesce(u.supply_name,'')) like '%'||v_search||'%'
      or lower(coalesce(d.document_number,'')) like '%'||v_search||'%'
      or lower(coalesce(d.customer_name,'')) like '%'||v_search||'%'
      or lower(coalesce(d.event_name,'')) like '%'||v_search||'%'
      or lower(coalesce(u.note,'')) like '%'||v_search||'%'
    )
  order by u.used_on desc,u.id desc
  limit v_limit;
end;
$func$;

-- Vendor suggestions come from the existing White Saffron Vendor master.
create or replace function public.quo_supply_usage_vendor_options(p_limit integer default 500)
returns table(vendor_name text)
language plpgsql
security definer
stable
set search_path=public,pg_temp
as $func$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.quo_is_admin() then raise exception 'Administrator access required'; end if;

  return query
  select distinct btrim(v.name)::text
  from public.vendors v
  where v.deleted_at is null
    and coalesce(v.is_active,true)
    and nullif(btrim(v.name),'') is not null
  order by 1
  limit greatest(1,least(coalesce(p_limit,500),1000));
end;
$func$;

-- Save all visible lines in one transaction so a partially-saved catering entry cannot occur.
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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.quo_is_admin() then raise exception 'Administrator access required'; end if;

  if not exists(
    select 1 from public.quo_documents d
    where d.id=p_document_id
      and d.deleted_at is null
      and d.document_type in ('quotation','invoice')
  ) then raise exception 'Select an existing quotation or invoice'; end if;

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

-- Keep the previous one-line RPC callable during browser cache rollover.
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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.quo_is_admin() then raise exception 'Administrator access required'; end if;
  if v_name='' then raise exception 'Enter the supply name'; end if;
  if coalesce(p_quantity,0)<=0 then raise exception 'Quantity must be greater than zero'; end if;
  if v_unit not in ('KG','G','PCS','L','ML','CSE') then raise exception 'Invalid unit'; end if;
  if not exists(select 1 from public.quo_documents d where d.id=p_document_id and d.deleted_at is null and d.document_type in ('quotation','invoice')) then
    raise exception 'Select an existing quotation or invoice';
  end if;

  insert into public.quo_supply_usage(document_id,vendor_name,supply_name,quantity,unit,used_on,note,created_by)
  values(p_document_id,'Not recorded',v_name,round(p_quantity,4),v_unit,coalesce(p_used_on,current_date),nullif(btrim(coalesce(p_note,'')),''),auth.uid())
  returning id into v_id;
  return v_id;
end;
$func$;

revoke all on function public.quo_supply_usage_list(text,uuid,integer) from public,anon;
revoke all on function public.quo_supply_usage_vendor_options(integer) from public,anon;
revoke all on function public.quo_add_supply_usage_lines(uuid,date,jsonb) from public,anon;
grant execute on function public.quo_supply_usage_list(text,uuid,integer) to authenticated;
grant execute on function public.quo_supply_usage_vendor_options(integer) to authenticated;
grant execute on function public.quo_add_supply_usage_lines(uuid,date,jsonb) to authenticated;
