-- Public customer RFQ intake + internal review workflow.
create table if not exists public.quo_quote_request_counters (
  year integer primary key,
  last_number integer not null default 0 check (last_number >= 0)
);

create table if not exists public.quo_quote_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  status text not null default 'New' check (status in ('New','Reviewing','Quoted','Closed','Declined')),
  customer_type text not null default 'Company' check (customer_type in ('Company','Individual')),
  company_name text,
  contact_name text not null,
  phone text not null,
  email text,
  gst_number text,
  service_type text not null default 'Catering - Buffet',
  event_name text,
  event_date date,
  time_from time,
  time_to time,
  pax integer check (pax is null or (pax >= 1 and pax <= 5000)),
  venue text,
  menu_request text,
  budget_per_pax numeric(12,2) check (budget_per_pax is null or budget_per_pax >= 0),
  notes text,
  source text not null default 'Public Web',
  internal_notes text,
  converted_document_id uuid references public.quo_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quo_quote_requests_status_created_idx on public.quo_quote_requests(status,created_at desc);
create index if not exists quo_quote_requests_event_date_idx on public.quo_quote_requests(event_date) where event_date is not null;

alter table public.quo_quote_request_counters enable row level security;
alter table public.quo_quote_requests enable row level security;
revoke all on public.quo_quote_request_counters from anon, authenticated;
revoke all on public.quo_quote_requests from anon;
grant select,update,delete on public.quo_quote_requests to authenticated;

create policy quo_quote_requests_select_active on public.quo_quote_requests for select to authenticated using (quo_is_active_user());
create policy quo_quote_requests_update_active on public.quo_quote_requests for update to authenticated using (quo_is_active_user()) with check (quo_is_active_user());
create policy quo_quote_requests_delete_admin on public.quo_quote_requests for delete to authenticated using (quo_is_admin());

create or replace function public.quo_submit_quote_request(
  p_customer_type text,p_company_name text,p_contact_name text,p_phone text,
  p_email text default null,p_gst_number text default null,p_service_type text default 'Catering - Buffet',
  p_event_name text default null,p_event_date date default null,p_time_from time default null,p_time_to time default null,
  p_pax integer default null,p_venue text default null,p_menu_request text default null,p_budget_per_pax numeric default null,
  p_notes text default null,p_website text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_year integer:=extract(year from current_date)::integer;
  v_num integer;v_request_number text;v_id uuid;
  v_customer_type text:=case when p_customer_type='Individual' then 'Individual' else 'Company' end;
begin
  if coalesce(trim(p_website),'')<>'' then return jsonb_build_object('ok',true,'request_number','Received'); end if;
  if length(trim(coalesce(p_contact_name,'')))<2 then raise exception 'Contact name is required'; end if;
  if length(trim(coalesce(p_phone,'')))<5 then raise exception 'A valid phone number is required'; end if;
  if v_customer_type='Company' and length(trim(coalesce(p_company_name,'')))<2 then raise exception 'Company name is required'; end if;
  if p_pax is not null and (p_pax<1 or p_pax>5000) then raise exception 'Guest count must be between 1 and 5000'; end if;
  if p_event_date is not null and p_event_date<current_date then raise exception 'Event date cannot be in the past'; end if;
  if p_time_from is not null and p_time_to is not null and p_time_to<=p_time_from then raise exception 'End time must be after start time'; end if;
  insert into public.quo_quote_request_counters(year,last_number) values(v_year,1)
    on conflict(year) do update set last_number=public.quo_quote_request_counters.last_number+1 returning last_number into v_num;
  v_request_number:='RFQ-'||v_year||'-'||lpad(v_num::text,4,'0');
  insert into public.quo_quote_requests(request_number,customer_type,company_name,contact_name,phone,email,gst_number,service_type,event_name,event_date,time_from,time_to,pax,venue,menu_request,budget_per_pax,notes)
  values(v_request_number,v_customer_type,nullif(left(trim(coalesce(p_company_name,'')),160),''),left(trim(p_contact_name),120),left(trim(p_phone),40),nullif(left(trim(coalesce(p_email,'')),180),''),nullif(left(trim(coalesce(p_gst_number,'')),80),''),left(trim(coalesce(nullif(p_service_type,''),'Catering - Buffet')),120),nullif(left(trim(coalesce(p_event_name,'')),160),''),p_event_date,p_time_from,p_time_to,p_pax,nullif(left(trim(coalesce(p_venue,'')),240),''),nullif(left(trim(coalesce(p_menu_request,'')),4000),''),p_budget_per_pax,nullif(left(trim(coalesce(p_notes,'')),3000),'')) returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id,'request_number',v_request_number);
end;$$;

revoke all on function public.quo_submit_quote_request(text,text,text,text,text,text,text,text,date,time,time,integer,text,text,numeric,text,text) from public;
grant execute on function public.quo_submit_quote_request(text,text,text,text,text,text,text,text,date,time,time,integer,text,text,numeric,text,text) to anon,authenticated;
