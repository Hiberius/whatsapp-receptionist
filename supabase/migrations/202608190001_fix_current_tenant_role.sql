-- The top-level JWT role is Supabase's infrastructure role (normally
-- "authenticated"), not the tenant application role. Tenant authorization
-- data is written to app_metadata by the existing onboarding flow.
create or replace function public.current_tenant_role()
returns text
language sql
stable
as $$
  select case auth.jwt() -> 'app_metadata' ->> 'role'
    when 'owner' then 'owner'
    when 'admin' then 'admin'
    when 'member' then 'member'
    else ''
  end;
$$;

comment on function public.current_tenant_role() is
  'Returns the allow-listed tenant application role from JWT app_metadata.';
