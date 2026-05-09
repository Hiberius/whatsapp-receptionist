-- Fatto da Claude Code il 27 aprile 2026.
-- Usage limits MVP: aggiunge tracking vocali separato e aggiorna la RPC
-- increment_usage_metrics() per accettare il nuovo delta. Indici di lookup
-- per il dashboard usage.

alter table public.usage_metrics
  add column if not exists voice_messages_count integer not null default 0
  check (voice_messages_count >= 0);

create or replace function public.increment_usage_metrics(
  p_tenant_id uuid,
  p_metric_month date,
  p_messages_delta integer default 0,
  p_conversations_delta integer default 0,
  p_ai_cost_cents_delta integer default 0,
  p_voice_messages_delta integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage_metrics (
    tenant_id,
    metric_month,
    messages_count,
    conversations_count,
    ai_cost_cents,
    voice_messages_count
  )
  values (
    p_tenant_id,
    p_metric_month,
    greatest(p_messages_delta, 0),
    greatest(p_conversations_delta, 0),
    greatest(p_ai_cost_cents_delta, 0),
    greatest(p_voice_messages_delta, 0)
  )
  on conflict (tenant_id, metric_month)
  do update set
    messages_count = public.usage_metrics.messages_count + greatest(p_messages_delta, 0),
    conversations_count = public.usage_metrics.conversations_count + greatest(p_conversations_delta, 0),
    ai_cost_cents = public.usage_metrics.ai_cost_cents + greatest(p_ai_cost_cents_delta, 0),
    voice_messages_count = public.usage_metrics.voice_messages_count + greatest(p_voice_messages_delta, 0),
    updated_at = now();
end;
$$;

revoke execute on function public.increment_usage_metrics(
  uuid, date, integer, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.increment_usage_metrics(
  uuid, date, integer, integer, integer, integer
) to service_role;

create index if not exists usage_metrics_tenant_month_idx
  on public.usage_metrics(tenant_id, metric_month desc);
