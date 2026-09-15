# Supabase administrator setup

Apply the migrations in this directory through the Supabase SQL editor or CLI.
Then register the existing Supabase Auth account as an administrator:

```sql
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('replace-with-the-admin-email@example.com')
on conflict (user_id) do nothing;
```

The email must also be present in the backend `ADMIN_EMAILS` environment
variable. The table membership protects direct browser writes through RLS, while
`ADMIN_EMAILS` protects the Express/R2 endpoints.
