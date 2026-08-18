-- Quo security cleanup after production audit.
-- Keep helper and trigger functions invoker-safe and remove direct RPC exposure
-- for trigger-only functions.

create or replace function public.quo_is_active_user()
returns boolean
language sql
stable
security invoker
set search_path=public
as $$
  select exists(select 1 from public.quo_users qu where qu.user_id=auth.uid() and qu.is_active);
$$;

create or replace function public.quo_is_admin()
returns boolean
language sql
stable
security invoker
set search_path=public
as $$
  select exists(select 1 from public.quo_users qu where qu.user_id=auth.uid() and qu.is_active and qu.role='admin');
$$;

create or replace function public.quo_current_actor_name()
returns text
language sql
stable
security invoker
set search_path=public
as $$
  select coalesce(
    (select nullif(trim(coalesce(qu.display_name,qu.username)), '')
       from public.quo_users qu
      where qu.user_id=auth.uid() and qu.is_active
      limit 1),
    'White Saffron'
  );
$$;

create or replace function public.quo_stamp_document_actor()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  actor text;
begin
  if uid is not null then
    select nullif(trim(coalesce(qu.display_name,qu.username)), '') into actor
      from public.quo_users qu
     where qu.user_id=uid and qu.is_active
     limit 1;
    if actor is null then raise exception 'Active Quo user required'; end if;
    if tg_op='INSERT' then
      new.created_by:=uid;
      new.created_by_name:=actor;
    else
      new.created_by:=old.created_by;
      new.created_by_name:=old.created_by_name;
    end if;
    new.updated_by:=uid;
    new.updated_by_name:=actor;
  elsif tg_op='UPDATE' then
    new.created_by:=old.created_by;
    new.created_by_name:=old.created_by_name;
  end if;
  return new;
end;
$$;

alter function public.quo_soft_delete_document(uuid,text) security invoker;
alter function public.quo_restore_document(uuid) security invoker;

revoke execute on function public.quo_stamp_document_actor() from public, anon, authenticated;
revoke execute on function public.quo_guard_document_state() from public, anon, authenticated;
revoke execute on function public.quo_guard_workflow_status() from public, anon, authenticated;

grant execute on function public.quo_is_active_user() to authenticated, service_role;
grant execute on function public.quo_is_admin() to authenticated, service_role;
grant execute on function public.quo_current_actor_name() to authenticated, service_role;
grant execute on function public.quo_soft_delete_document(uuid,text) to authenticated;
grant execute on function public.quo_restore_document(uuid) to authenticated;
