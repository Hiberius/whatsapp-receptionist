create or replace function public.replace_tenant_business_hours(
  p_tenant_id uuid,
  p_hours jsonb
)
returns setof public.business_hours
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  if p_hours is null or jsonb_typeof(p_hours) <> 'array' then
    raise exception 'p_hours must be a JSON array';
  end if;

  delete from public.business_hours
  where tenant_id = p_tenant_id;

  insert into public.business_hours (
    tenant_id,
    weekday,
    opens_at,
    closes_at,
    active
  )
  select
    p_tenant_id,
    (hour ->> 'weekday')::integer,
    (hour ->> 'opensAt')::time,
    (hour ->> 'closesAt')::time,
    coalesce((hour ->> 'active')::boolean, true)
  from jsonb_array_elements(p_hours) as hour;

  return query
  select *
  from public.business_hours
  where tenant_id = p_tenant_id
  order by weekday asc, opens_at asc;
end;
$$;

revoke execute on function public.replace_tenant_business_hours(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_tenant_business_hours(uuid, jsonb)
  to service_role;
