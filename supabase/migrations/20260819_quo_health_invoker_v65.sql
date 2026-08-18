alter function public.quo_system_health() security invoker;
revoke all on function public.quo_system_health() from public, anon;
grant execute on function public.quo_system_health() to authenticated;
