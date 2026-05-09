create or replace function public.create_tenant_onboarding(
  p_user_id uuid,
  p_user_email text,
  p_full_name text,
  p_tenant jsonb,
  p_config jsonb,
  p_services jsonb,
  p_business_hours jsonb,
  p_audit jsonb
)
returns table (
  tenant_id uuid,
  tenant_slug text,
  tenant_name text,
  trial_ends_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_tenant_slug text;
  v_tenant_name text;
  v_trial_ends_at timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  if exists (select 1 from public.users where id = p_user_id) then
    raise unique_violation using message = 'user already has a tenant membership';
  end if;

  if p_services is null or jsonb_typeof(p_services) <> 'array' then
    raise exception 'p_services must be a JSON array';
  end if;

  if p_business_hours is null or jsonb_typeof(p_business_hours) <> 'array' then
    raise exception 'p_business_hours must be a JSON array';
  end if;

  insert into public.tenants (
    name,
    slug,
    plan,
    status,
    billing_email,
    country,
    timezone,
    business_type,
    trial_ends_at
  )
  values (
    p_tenant ->> 'name',
    p_tenant ->> 'slug',
    'trial',
    'active',
    p_tenant ->> 'billingEmail',
    coalesce(p_tenant ->> 'country', 'IT'),
    coalesce(p_tenant ->> 'timezone', 'Europe/Rome'),
    nullif(p_tenant ->> 'businessType', ''),
    (p_tenant ->> 'trialEndsAt')::timestamptz
  )
  returning id, slug, name, trial_ends_at
  into v_tenant_id, v_tenant_slug, v_tenant_name, v_trial_ends_at;

  insert into public.users (
    id,
    tenant_id,
    role,
    full_name,
    phone
  )
  values (
    p_user_id,
    v_tenant_id,
    'owner',
    nullif(p_full_name, ''),
    nullif(p_config ->> 'phone', '')
  );

  insert into public.tenant_config (
    tenant_id,
    studio_name,
    assistant_name,
    city,
    address,
    phone,
    email,
    default_locale,
    ai_disclosure_enabled,
    auto_reply_enabled,
    voice_messages_enabled,
    voice_replies_enabled,
    booking_min_lead_minutes,
    booking_slot_step_minutes,
    booking_buffer_minutes,
    booking_max_days_ahead,
    elevenlabs_voice_id,
    elevenlabs_stt_model,
    elevenlabs_tts_model,
    human_escalation_email
  )
  values (
    v_tenant_id,
    p_config ->> 'studioName',
    coalesce(p_config ->> 'assistantName', 'Ambrogio'),
    nullif(p_config ->> 'city', ''),
    nullif(p_config ->> 'address', ''),
    nullif(p_config ->> 'phone', ''),
    nullif(p_config ->> 'email', ''),
    coalesce(p_config ->> 'defaultLocale', 'it-IT'),
    coalesce((p_config ->> 'aiDisclosureEnabled')::boolean, true),
    coalesce((p_config ->> 'autoReplyEnabled')::boolean, false),
    coalesce((p_config ->> 'voiceMessagesEnabled')::boolean, true),
    coalesce((p_config ->> 'voiceRepliesEnabled')::boolean, false),
    coalesce((p_config ->> 'bookingMinLeadMinutes')::integer, 120),
    coalesce((p_config ->> 'bookingSlotStepMinutes')::integer, 15),
    coalesce((p_config ->> 'bookingBufferMinutes')::integer, 0),
    coalesce((p_config ->> 'bookingMaxDaysAhead')::integer, 30),
    nullif(p_config ->> 'elevenlabsVoiceId', ''),
    coalesce(p_config ->> 'elevenlabsSttModel', 'scribe_v2'),
    coalesce(p_config ->> 'elevenlabsTtsModel', 'eleven_flash_v2_5'),
    nullif(p_config ->> 'humanEscalationEmail', '')
  );

  insert into public.services (
    tenant_id,
    name,
    description,
    duration_minutes,
    price_cents,
    active
  )
  select
    v_tenant_id,
    service ->> 'name',
    nullif(service ->> 'description', ''),
    coalesce((service ->> 'durationMinutes')::integer, 30),
    nullif(service ->> 'priceCents', '')::integer,
    coalesce((service ->> 'active')::boolean, true)
  from jsonb_array_elements(p_services) as service;

  insert into public.business_hours (
    tenant_id,
    weekday,
    opens_at,
    closes_at,
    active
  )
  select
    v_tenant_id,
    (hour ->> 'weekday')::integer,
    (hour ->> 'opensAt')::time,
    (hour ->> 'closesAt')::time,
    coalesce((hour ->> 'active')::boolean, true)
  from jsonb_array_elements(p_business_hours) as hour;

  insert into public.audit_log (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    metadata
  )
  values (
    v_tenant_id,
    p_user_id,
    'onboarding.tenant.created',
    'tenant',
    v_tenant_id,
    nullif(p_audit ->> 'ipAddress', ''),
    nullif(p_audit ->> 'userAgent', ''),
    jsonb_build_object(
      'source', 'api',
      'billingEmail', p_tenant ->> 'billingEmail',
      'servicesCount', jsonb_array_length(p_services),
      'businessHoursCount', jsonb_array_length(p_business_hours)
    )
  );

  return query
  select v_tenant_id, v_tenant_slug, v_tenant_name, v_trial_ends_at;
end;
$$;

revoke execute on function public.create_tenant_onboarding(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;
grant execute on function public.create_tenant_onboarding(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;
