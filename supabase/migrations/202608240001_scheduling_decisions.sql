-- Fatto da Claude Code il 24 agosto 2026.
-- Tabella `scheduling_decisions`: ledger delle decisioni di ranking degli slot.
--
-- Perche' esiste: la proposta dei tre slot in conversazione era finora una
-- scatola nera (primi tre candidati disponibili). Con il ranker deterministico
-- ogni proposta diventa una decisione spiegabile, e questa tabella ne conserva
-- l'audit: quali candidati sono stati valutati, con quale punteggio e per quali
-- segnali.
--
-- Flusso:
-- 1. BookingBridgeService filtra i candidati come sempre.
-- 2. rankSlots() li ordina in modo deterministico (nessun LLM).
-- 3. Una riga qui registra TUTTI i candidati valutati in ordine di ranking.
-- 4. I primi tre (`candidates[0..2]`) sono quelli proposti al cliente: per
--    questo non esiste una colonna "selected" separata, sarebbe un secondo
--    stato da tenere in sincrono con l'ordine.
--
-- Non salviamo lo snapshot degli slot occupati: qui si audita il RANKING, non
-- la generazione dei candidati, che resta responsabilita' del motore di
-- disponibilita' esistente.
--
-- Il ledger e' fail-open lato applicazione: un errore di scrittura viene
-- loggato e la conversazione di prenotazione prosegue normalmente.

create table if not exists public.scheduling_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  request jsonb not null,
  ranking_version text not null,
  candidates jsonb not null,
  explanation text
);

create index if not exists scheduling_decisions_tenant_created_idx
  on public.scheduling_decisions(tenant_id, created_at desc);

create index if not exists scheduling_decisions_conversation_idx
  on public.scheduling_decisions(conversation_id, created_at desc);

alter table public.scheduling_decisions enable row level security;

-- Stessa convenzione delle altre tabelle multi-tenant: visibilita' limitata al
-- tenant del claim JWT. Il service_role bypassa RLS ed e' il solo scrittore
-- (il ledger gira server-side dentro il bridge di booking).
create policy scheduling_decisions_tenant_all on public.scheduling_decisions
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
