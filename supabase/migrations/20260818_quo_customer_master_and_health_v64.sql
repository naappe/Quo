create or replace function public.quo_normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    case
      when length(regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g')) = 10
       and left(regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g'), 3) = '960'
      then substr(regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g'), 4)
      else regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g')
    end,
    ''
  );
$$;

create table if not exists public.quo_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  phone_normalized text generated always as (public.quo_normalize_phone(phone)) stored,
  address text,
  notes text,
  is_active boolean not null default true,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz not null default now()
);

create unique index if not exists quo_customers_active_phone_uidx on public.quo_customers(phone_normalized) where is_active and phone_normalized is not null;
create index if not exists quo_customers_name_idx on public.quo_customers(lower(name));
create index if not exists quo_customers_updated_idx on public.quo_customers(updated_at desc);

alter table public.quo_customers enable row level security;

drop policy if exists quo_customers_select_active on public.quo_customers;
create policy quo_customers_select_active on public.quo_customers for select to authenticated using (public.quo_is_active_user());
drop policy if exists quo_customers_insert_active on public.quo_customers;
create policy quo_customers_insert_active on public.quo_customers for insert to authenticated with check (public.quo_is_active_user());
drop policy if exists quo_customers_update_active on public.quo_customers;
create policy quo_customers_update_active on public.quo_customers for update to authenticated using (public.quo_is_active_user()) with check (public.quo_is_active_user());
drop policy if exists quo_customers_delete_admin on public.quo_customers;
create policy quo_customers_delete_admin on public.quo_customers for delete to authenticated using (public.quo_is_admin());

grant select, insert, update, delete on public.quo_customers to authenticated;
revoke all on public.quo_customers from anon;

create or replace function public.quo_stamp_customer_actor()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor text := public.quo_current_actor_name();
  v_uid uuid := auth.uid();
begin
  new.updated_at := now();
  new.updated_by := v_uid;
  new.updated_by_name := v_actor;
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, v_uid);
    new.created_by_name := coalesce(nullif(trim(new.created_by_name),''), v_actor);
  end if;
  return new;
end;
$$;
revoke all on function public.quo_stamp_customer_actor() from public, anon, authenticated;

drop trigger if exists quo_customers_audit_actor on public.quo_customers;
create trigger quo_customers_audit_actor before insert or update on public.quo_customers for each row execute function public.quo_stamp_customer_actor();

alter table public.quo_documents add column if not exists customer_id uuid references public.quo_customers(id) on delete set null;
create index if not exists quo_documents_customer_idx on public.quo_documents(customer_id, updated_at desc);

create or replace function public.quo_link_document_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_phone text := public.quo_normalize_phone(new.customer_phone);
  v_name text := nullif(trim(new.customer_name), '');
  v_actor text := public.quo_current_actor_name();
  v_uid uuid := auth.uid();
begin
  if v_name is null then
    new.customer_id := null;
    return new;
  end if;

  if v_phone is not null then
    select id into v_id from public.quo_customers where is_active and phone_normalized = v_phone limit 1;
  else
    select id into v_id from public.quo_customers where is_active and phone_normalized is null and lower(trim(name)) = lower(v_name) order by updated_at desc limit 1;
  end if;

  if v_id is null then
    insert into public.quo_customers(name, phone, address, created_by, created_by_name, updated_by, updated_by_name)
    values (v_name, nullif(trim(new.customer_phone),''), nullif(trim(new.customer_address),''), v_uid, v_actor, v_uid, v_actor)
    returning id into v_id;
  else
    update public.quo_customers
       set name = v_name,
           phone = coalesce(nullif(trim(new.customer_phone),''), phone),
           address = coalesce(nullif(trim(new.customer_address),''), address),
           updated_by = v_uid,
           updated_by_name = v_actor
     where id = v_id;
  end if;

  new.customer_id := v_id;
  return new;
end;
$$;
revoke all on function public.quo_link_document_customer() from public, anon, authenticated;

drop trigger if exists quo_documents_customer_link on public.quo_documents;
create trigger quo_documents_customer_link before insert or update of customer_name, customer_phone, customer_address on public.quo_documents for each row execute function public.quo_link_document_customer();

with ranked as (
  select customer_name,
         nullif(trim(customer_phone),'') as customer_phone,
         nullif(trim(customer_address),'') as customer_address,
         public.quo_normalize_phone(customer_phone) as phone_norm,
         row_number() over (partition by coalesce('p:'||public.quo_normalize_phone(customer_phone), 'n:'||lower(trim(customer_name))) order by updated_at desc nulls last, created_at desc nulls last) as rn
  from public.quo_documents
  where nullif(trim(customer_name),'') is not null
), src as (select * from ranked where rn=1)
insert into public.quo_customers(name, phone, address, created_by_name, updated_by_name)
select customer_name, customer_phone, customer_address, 'Migration', 'Migration'
from src s
where not exists (
  select 1 from public.quo_customers c
  where (s.phone_norm is not null and c.phone_normalized=s.phone_norm)
     or (s.phone_norm is null and c.phone_normalized is null and lower(trim(c.name))=lower(trim(s.customer_name)))
)
on conflict do nothing;

update public.quo_documents d
set customer_id = c.id
from public.quo_customers c
where d.customer_id is null
  and nullif(trim(d.customer_name),'') is not null
  and ((public.quo_normalize_phone(d.customer_phone) is not null and c.phone_normalized = public.quo_normalize_phone(d.customer_phone))
    or (public.quo_normalize_phone(d.customer_phone) is null and c.phone_normalized is null and lower(trim(c.name)) = lower(trim(d.customer_name))));

create or replace function public.quo_system_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.quo_is_active_user() then raise exception 'Active Quo user required'; end if;
  select jsonb_build_object(
    'active_documents', (select count(*) from public.quo_documents where deleted_at is null),
    'active_customers', (select count(*) from public.quo_customers where is_active),
    'documents_without_customer', (select count(*) from public.quo_documents where deleted_at is null and nullif(trim(customer_name),'') is not null and customer_id is null),
    'confirmed_quotes_without_proforma', (select count(*) from public.quo_documents q where q.deleted_at is null and q.document_type='quotation' and q.status='Confirmed' and not exists (select 1 from public.quo_documents p where p.deleted_at is null and p.document_type='proforma' and p.source_document_id=q.id)),
    'converted_proformas_without_invoice', (select count(*) from public.quo_documents p where p.deleted_at is null and p.document_type='proforma' and p.status='Converted' and not exists (select 1 from public.quo_documents i where i.deleted_at is null and i.document_type='invoice' and i.source_document_id=p.id)),
    'receipts_without_invoice', (select count(*) from public.quo_documents r where r.deleted_at is null and r.document_type='receipt' and not exists (select 1 from public.quo_documents i where i.deleted_at is null and i.document_type='invoice' and i.id=r.source_document_id)),
    'duplicate_active_deal_types', (select count(*) from (select deal_id, document_type from public.quo_documents where deleted_at is null and deal_id is not null and document_type in ('quotation','proforma','invoice') and status <> 'Cancelled' group by deal_id, document_type having count(*) > 1) x)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.quo_system_health() from public, anon;
grant execute on function public.quo_system_health() to authenticated;
