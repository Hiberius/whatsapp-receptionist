# PROMPT 05 - AI ENGINE ANTHROPIC (IL CERVELLO)

## PROMPT OPERATIVO CODEX

Questo e' il cuore del prodotto. Costruiamo l'engine AI multi-livello con Anthropic Haiku (intent routing economico) e Anthropic Sonnet (conversazioni complesse).

Nota 2026-04-25 - Fatto da Codex:

- Adapter provider-aware gia' implementato in `src/server/ai/anthropic-adapter.ts`.
- Contratti LLM provider-neutral in `src/server/ai/llm.ts`.
- Intent classifier LLM con fallback rule-based in `src/server/ai/llm-intent-classifier.ts`.
- Domain reply generator LLM con fallback deterministico in `src/server/ai/domain-reply.ts`.
- `ReplyOrchestrator` usa Anthropic solo se `ANTHROPIC_API_KEY` e model env sono configurati; nessun model ID hardcoded.
- Eval fixtures iniziali in `tests/fixtures/ai/intent-evals.json`.
- Bug fix gia' applicato: prezzo/orari/handoff hanno priorita' su booking generico.
- Context loader conversazione, prompt versioning da `ai_prompts` e retrieval base da `knowledge_base` gia' implementati da Codex.
- Cost tracking AI gia' implementato da Codex in `src/server/ai/costs.ts`, con update di `messages.tokens_used`, `messages.cost_cents` e `usage_metrics.ai_cost_cents`.
- RAG vettoriale con embeddings opzionali gia' implementato da Codex in `src/server/ai/embeddings.ts` + `AiContextProvider` + RPC `match_knowledge_base()`.

STEP 1 - Intent Router con Anthropic Haiku

Stato: base completata da Codex con fallback deterministico.

Crea src/lib/ai/intent-router.ts:

Modello: model ID Anthropic configurato via env (veloce, economico rispetto a Sonnet, attivo su Anthropic API)

Funzione: classifyIntent(message, conversationContext)

System prompt base (personalizzabile per tenant):
```
Sei un classificatore di intent per un ambrogio AI di uno studio professionale italiano. 
Il tuo unico compito e' classificare il messaggio del cliente in UNO di questi intent:

- appointment_booking: cliente vuole prenotare un appuntamento
- appointment_rescheduling: cliente vuole spostare/cambiare un appuntamento
- appointment_cancellation: cliente vuole cancellare un appuntamento
- info_request: cliente chiede informazioni (orari, prezzi, servizi, indirizzo)
- emergency: situazione urgente, dolore, problema immediato (contiene "urgente", "subito", "dolore forte", "emergenza")
- complaint: cliente lamentela o feedback negativo
- greeting: saluto o conversazione casuale
- spam: messaggio promozionale, spam, automated
- other: non rientra in nessuna categoria sopra

Rispondi SOLO con JSON: {"intent": "...", "confidence": 0.95, "reasoning": "brief explanation"}

Se confidence < 0.7, restituisci intent "other".

Tieni conto del context della conversazione precedente se rilevante.
```

Output tipizzato con Zod:
```typescript
const IntentSchema = z.object({
  intent: z.enum(['appointment_booking', 'appointment_rescheduling', 'appointment_cancellation', 'info_request', 'emergency', 'complaint', 'greeting', 'spam', 'other']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})
```

Logging ogni classificazione con input+output per analisi accuratezza.

STEP 2 - Domain Agent con Anthropic Sonnet

Stato: base completata da Codex con JSON output e fallback deterministico.

Crea src/lib/ai/domain-agent.ts:

Modello: model ID Anthropic configurato via env (capacita' avanzate, modello attivo consigliato per conversazioni complesse)

Funzione: generateResponse(intent, message, context, tenantConfig, tools)

System prompt dinamico costruito per tenant:
```
Sei Ambrogio, l'assistente AI di {{studio_name}}, uno studio {{business_type}} in {{city}}.

INFORMAZIONI STUDIO:
- Nome: {{studio_name}}
- Tipo: {{business_type}}
- Indirizzo: {{address}}
- Telefono: {{phone}}
- Email: {{email}}
- Orari apertura: {{business_hours}}

SERVIZI OFFERTI:
{{services_list}}

FAQ CARICATE:
{{faq_list}}

LISTINO PREZZI (se disponibile):
{{pricing}}

TUO COMPITO:
- Aiuta i pazienti/clienti a prenotare appuntamenti, fornire info, gestire disdette.
- Parla in italiano colloquiale ma professionale. Usa "Lei" di default, passa al "tu" solo se il cliente usa il tu.
- Sii sintetica. Massimo 3-4 frasi per risposta.
- Usa emoji con moderazione (solo quando aggiungono chiarezza, es. 📅 per date).
- Se non sai rispondere con certezza, di' "Un attimo, verifico con l'ufficio e ti ricontatto a breve" e attiva escalation umana.

REGOLE ASSOLUTE:
- NON dare consigli medici, terapeutici, legali, finanziari specifici.
- NON fare diagnosi.
- NON promettere risultati di trattamenti.
- In caso di emergenza medica, dici SEMPRE di chiamare il 118 o andare al pronto soccorso piu' vicino.
- Se cliente parla di depressione, autolesionismo, pensieri suicidi: escalate IMMEDIATAMENTE + fornisci numero Telefono Amico (02 2327 2327).
- Rispetta sempre la privacy del cliente. Non condividere info con terzi.

TOOL DISPONIBILI:
- check_calendar_availability: verifica slot disponibili
- book_appointment: prenota un appuntamento
- cancel_appointment: cancella un appuntamento
- reschedule_appointment: sposta un appuntamento
- get_appointment_info: recupera info appuntamento esistente
- escalate_to_human: notifica il titolare dello studio
- send_info_document: invia PDF informativo (es. preparazione alla visita)

TRASPARENZA AI (obbligatorio EU AI Act):
Se il cliente chiede "sei un'AI?", rispondi con onesta': "Si', sono un assistente virtuale di {{studio_name}}. Posso aiutarti con prenotazioni e informazioni. Per domande specifiche mediche/tecniche, ti faccio richiamare dall'ufficio."
```

STEP 3 - Tool implementations

Crea src/lib/ai/tools/ folder con file per ogni tool:

tools/check-calendar.ts:
- Input: date range, service_type opzionale
- Logica: chiama Google Calendar API, filtra slot occupati, ritorna 5 slot disponibili nei prossimi 7 giorni
- Output: array di slot con data, ora inizio, durata

tools/book-appointment.ts:
- Input: datetime, customer_name, customer_phone, service_type, notes
- Validation: slot ancora disponibile? verifica orario apertura? non sovrapposto?
- Logica: crea evento su Google Calendar + insert in appointments
- Side effect: invia conferma WhatsApp al cliente + notifica email al titolare
- Output: appointment_id + messaggio di conferma

tools/cancel-appointment.ts:
- Input: appointment_id o (customer_phone + datetime)
- Verifica identita': numero WhatsApp deve corrispondere
- Cancella su Google Calendar + update DB status
- Side effect: notifica cancellazione + suggerisce spostamento

tools/escalate-to-human.ts:
- Input: reason, urgency (low/medium/high)
- Logica: setta conversations.status = 'escalated'
- Notifica titolare: email + (fase 2) push notification + (fase 3) SMS se urgency=high
- Messaggio al cliente: "Un attimo, ti metto in contatto con l'ufficio"
- Set timeout 3 minuti: se titolare non risponde, fallback message

STEP 4 - Orchestrator principale

Crea src/lib/ai/orchestrator.ts - il boss che coordina tutto:

```typescript
async function orchestrate(
  tenantId: string,
  conversationId: string,
  newMessage: string
): Promise<AIResponse> {
  
  // 1. Carica context
  const context = await loadConversationContext(conversationId, limit: 20)
  const tenantConfig = await loadTenantConfig(tenantId)
  
  // 2. Intent routing
  const intent = await classifyIntent(newMessage, context)
  
  // 3. Guardrails
  if (intent.intent === 'emergency') {
    // Bypass immediato: escalation + messaggio emergenza
    await escalateToHuman({ urgency: 'high', reason: 'emergency detected' })
    return {
      text: 'Capisco la urgenza. Ti sto mettendo subito in contatto con l ufficio. Se e una emergenza medica grave, chiama il 118.',
      should_escalate: true
    }
  }
  
  if (intent.intent === 'spam' || intent.confidence < 0.6) {
    // Non rispondere a spam
    return { text: null, should_skip: true }
  }
  
  // 4. Carica tools appropriati per intent
  const tools = getToolsForIntent(intent.intent)
  
  // 5. Domain agent genera risposta
  const response = await generateResponse({
    intent: intent.intent,
    message: newMessage,
    context,
    tenantConfig,
    tools
  })
  
  // 6. Post-processing
  await logInteraction({ intent, response, tokens_used, cost_cents })
  
  return response
}
```

Input vocali WhatsApp:
- Se il messaggio e' `audio`, l'orchestrator riceve `messages.transcript_text` generato da ElevenLabs.
- Il prompt deve sapere che il testo deriva da un vocale e puo' contenere errori di trascrizione.
- Se il transcript e' breve, rumoroso o ambiguo, chiedi chiarimento invece di inventare.
- Se il tenant abilita `voice_replies_enabled`, post-processing puo' generare nota vocale ElevenLabs solo dopo validazione sicurezza.
- Non generare audio per emergency, complaint grave, dati sanitari delicati o escalation.

STEP 5 - Context management

Stato: base completata da Codex in `src/server/ai/context.ts`.

Crea src/lib/ai/context.ts:
- loadConversationContext: ultimi N messaggi, troncati intelligentemente se troppo lunghi
- Sliding window: max 20 messaggi nel context per risparmiare token
- Riassumi conversazioni > 50 messaggi con LLM per abbattere token usage
- Cache embeddings knowledge base per RAG rapido

STEP 6 - RAG su knowledge base

Stato: lexical retrieval e vector retrieval completati da Codex.

Per risposte "info_request" che richiedono FAQ specifiche:
- Usa pgvector per semantic search su knowledge_base del tenant tramite `match_knowledge_base()`
- Top-3 risultati iniettati nel prompt come contesto
- Se vector retrieval fallisce o non trova match, fallback lessicale automatico

Per embeddings: configurare `OPENAI_API_KEY` e `OPENAI_EMBEDDING_MODEL`. Il client richiede 1536 dimensioni per restare coerente con `knowledge_base.embedding vector(1536)`. Default env attuale: `text-embedding-3-large`, da cambiare se si preferisce costo piu' basso.

STEP 7 - Cost tracking

Stato: base completata da Codex.

Ogni chiamata LLM gestita dal backend salva/stima:
- tokens_input
- tokens_output  
- model_used
- cost_cents (calcolato dai prezzi)
- tenant_id

Implementazione attuale:
- `LlmIntentClassifier` e `LlmDomainReplyGenerator` allegano `aiUsage`;
- `WhatsAppAutoReplyService` somma usage intent + reply;
- `SupabaseWhatsAppWebhookRepository.updateInboundMessageAnalysis()` salva token/costo su `messages`;
- `increment_usage_metrics()` incrementa `usage_metrics.ai_cost_cents`.

Crea vista materialized monthly_ai_costs per reportistica:
- Per tenant: costo totale mensile
- Per intent: quanto costano le prenotazioni vs info requests
- Alert se costo per tenant supera X% del suo pricing (es. alert se costi > 40% del MRR)

STEP 8 - Evaluation e quality monitoring

Crea sistema di evaluation:
- Campiona 5% delle conversazioni per review manuale
- Crea endpoint /admin/review-conversation con UI per valutare:
  - AI ha risposto correttamente? (si/no/parziale)
  - Intent classificato correttamente?
  - Serve retraining prompt?
- Metrics dashboard: accuracy %, escalation rate, customer satisfaction (dal feedback WhatsApp)

STEP 9 - Prompt versioning

Salva system prompts in Supabase (tabella ai_prompts):
- version, prompt_text, intent_target, tenant_id (null per global)
- A/B testing framework: 50% tenant su prompt v1, 50% su v2, misura performance
- Rollback rapido se v2 performa peggio

STEP 10 - Test completi

Crea test suite:
1. Unit test intent classifier (100 esempi etichettati manualmente)
2. Integration test booking flow end-to-end: MVP fatto da Codex in `tests/server/e2e/whatsapp-booking-flow.test.ts`
3. Test edge cases: messaggi vuoti, emoji only, link, file, audio
4. Test vocali WhatsApp: audio chiaro, audio rumoroso, transcript ambiguo, generazione risposta vocale disabilitata/abilitata
5. Test multilingua: italiano, english, arabic, spanish
6. Test adversarial: prompt injection tentativi ("ignora istruzioni precedenti...")
7. Test emergency handling (keyword detection)

Esegui tutti i test e fammi vedere coverage + failed cases.

CONSIDERAZIONI FINALI:
- Anthropic API ha rate limits (requests per minute + tokens per minute) → implementa queue con Upstash se volume alto
- Timeout 30 secondi su ogni chiamata Anthropic, fallback a messaggio default se scade
- Retry 2 volte con backoff se 5xx
- Monitoring: alerta se AI accuracy scende sotto 85% su un qualsiasi tenant
- Ogni 30 giorni: review dei 50 messaggi con confidence piu' bassa, tune prompts di conseguenza
