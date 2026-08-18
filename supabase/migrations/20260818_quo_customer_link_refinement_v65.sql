create index if not exists quo_documents_customer_id_idx on public.quo_documents(customer_id, updated_at desc);

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
  if tg_op = 'UPDATE'
     and new.customer_name is not distinct from old.customer_name
     and new.customer_phone is not distinct from old.customer_phone
     and new.customer_address is not distinct from old.customer_address
     and new.customer_id is not null then
    return new;
  end if;

  if v_name is null then
    new.customer_id := null;
    return new;
  end if;

  if v_phone is not null then
    select id into v_id
    from public.quo_customers
    where is_active and phone_normalized = v_phone
    limit 1;
  else
    select id into v_id
    from public.quo_customers
    where is_active and phone_normalized is null and lower(trim(name)) = lower(v_name)
    order by updated_at desc
    limit 1;
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
