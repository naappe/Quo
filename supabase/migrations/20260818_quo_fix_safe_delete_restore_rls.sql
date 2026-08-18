-- Controlled delete/restore RPCs intentionally use SECURITY DEFINER because
-- staff RLS hides a row immediately after it is moved to Trash. Each function
-- performs its own Quo role checks and has a fixed search_path.

alter function public.quo_soft_delete_document(uuid,text) security definer;
alter function public.quo_restore_document(uuid) security definer;

revoke execute on function public.quo_soft_delete_document(uuid,text) from public, anon;
revoke execute on function public.quo_restore_document(uuid) from public, anon;
grant execute on function public.quo_soft_delete_document(uuid,text) to authenticated;
grant execute on function public.quo_restore_document(uuid) to authenticated;
