drop policy if exists quo_users_read_own on public.quo_users;
create policy quo_users_read_own
on public.quo_users
for select
to authenticated
using (user_id=(select auth.uid()));
