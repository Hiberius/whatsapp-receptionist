begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

grant usage on schema public to authenticated;
grant usage on schema extensions to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into auth.users (id) values
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');

insert into public.tenants (id, name, slug, billing_email, country, timezone) values
  ('10000000-0000-4000-8000-000000000001', 'Tenant A', 'pgtap-tenant-a', 'a@example.com', 'US', 'America/New_York'),
  ('10000000-0000-4000-8000-000000000002', 'Tenant B', 'pgtap-tenant-b', 'b@example.com', 'US', 'America/Chicago');

insert into public.users (id, tenant_id, role, full_name) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', 'Owner A'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'owner', 'Owner B');

insert into public.services (id, tenant_id, name) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Service A'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Service B');

insert into public.conversations (id, tenant_id, channel, customer_identifier) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'whatsapp', '+12025550101'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'whatsapp', '+12025550102');

insert into public.messages (
  id, tenant_id, conversation_id, direction, sender_type, content
) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'inbound', 'customer', 'Hello A'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'inbound', 'customer', 'Hello B');

insert into public.appointments (
  id, tenant_id, conversation_id, service_id, customer_identifier,
  customer_name, scheduled_at
) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '+12025550101', 'Customer A', '2030-01-01 15:00:00+00'),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '+12025550102', 'Customer B', '2030-01-01 15:00:00+00');

insert into public.knowledge_base (tenant_id, title, content) values
  ('10000000-0000-4000-8000-000000000001', 'FAQ A', 'Answer A'),
  ('10000000-0000-4000-8000-000000000002', 'FAQ B', 'Answer B');

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"tenant_id":"10000000-0000-4000-8000-000000000001","role":"owner"}}',
  true
);
set local role authenticated;

select is(public.current_tenant_role(), 'owner', 'owner comes from app_metadata');
select results_eq(
  $$select id::text from public.tenants order by id$$,
  $$values ('10000000-0000-4000-8000-000000000001')$$,
  'tenant A sees only tenant A'
);
select is((select count(*)::integer from public.services), 1, 'tenant A sees one service');
select is((select name from public.services), 'Service A', 'tenant A never sees service B');
select is((select count(*)::integer from public.messages), 1, 'tenant A sees one message');
select is((select count(*)::integer from public.appointments), 1, 'tenant A sees one appointment');
select is((select count(*)::integer from public.knowledge_base), 1, 'tenant A sees one FAQ');
select throws_ok(
  $$insert into public.services (tenant_id, name) values ('10000000-0000-4000-8000-000000000002', 'Cross tenant')$$,
  '42501',
  null,
  'tenant A cannot insert a tenant B row'
);

reset role;
set local role service_role;

select throws_ok(
  $$insert into public.messages (tenant_id, conversation_id, direction, sender_type, content) values ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'inbound', 'customer', 'Cross tenant')$$,
  '23503',
  null,
  'service role cannot cross-link a message to another tenant conversation'
);
select throws_ok(
  $$insert into public.appointments (tenant_id, conversation_id, service_id, customer_identifier, customer_name, scheduled_at) values ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '+12025550999', 'Cross Tenant', '2030-02-01 15:00:00+00')$$,
  '23503',
  null,
  'service role cannot cross-link booking resources'
);
select throws_ok(
  $$insert into public.appointments (tenant_id, conversation_id, service_id, customer_identifier, customer_name, scheduled_at) values ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '+12025550888', 'Overlap', '2030-01-01 15:15:00+00')$$,
  '23P01',
  null,
  'same-tenant overlapping appointments remain blocked'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"tenant_id":"10000000-0000-4000-8000-000000000002","role":"owner"}}',
  true
);
set local role authenticated;

select is((select count(*)::integer from public.services), 1, 'tenant B sees one service');
select is((select name from public.services), 'Service B', 'tenant B never sees service A');

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"tenant_id":"10000000-0000-4000-8000-000000000001","role":"member"}}',
  true
);
select is(public.current_tenant_role(), 'member', 'member role is preserved');

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"tenant_id":"10000000-0000-4000-8000-000000000001","role":"superadmin"}}',
  true
);
select is(public.current_tenant_role(), '', 'unknown application role is denied');
select is((select count(*)::integer from public.audit_log), 0, 'unknown role cannot read admin data');

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select is((select count(*)::integer from public.services), 0, 'missing tenant claim sees no tenant rows');

select * from finish();
rollback;
