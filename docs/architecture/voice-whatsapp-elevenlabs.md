# Voice On WhatsApp With ElevenLabs

## Fatto da Codex - 2026-04-24
Aggiornato da Codex - 2026-04-25 con worker asincrono STT e auto-reply da transcript.

Ambrogio.ai deve supportare vocali WhatsApp in ingresso e, quando abilitato dal tenant, risposte vocali in uscita.

## Flow Inbound Audio

1. Utente finale invia nota vocale WhatsApp.
2. Webhook 360dialog riceve `message.type = audio`.
3. Webhook salva il messaggio inbound e accoda `whatsapp_voice_jobs`.
4. Worker interno `POST /api/internal/jobs/whatsapp-voice` reclama job pronti via `claim_whatsapp_voice_jobs()`.
5. Worker scarica metadata e bytes media da 360dialog con `D360-API-KEY`.
6. Worker salva l'audio originale in Supabase Storage bucket `SUPABASE_MEDIA_BUCKET`.
7. ElevenLabs Speech-to-Text trascrive il vocale con `scribe_v2`.
8. Transcript e metadata vengono salvati su `messages.transcript_text`, `transcript_language`, `audio_duration_secs`, `media_urls` e `metadata`.
9. Audit STT viene salvato su `voice_events`.
10. Il transcript viene passato a `WhatsAppAutoReplyService`, che riusa intent router, disclosure AI, doppio gate, opt-out e outbox.
11. Retry/dead-letter vengono gestiti da `whatsapp_voice_jobs`; se un retry trova gia' un transcript salvato, non ripete STT e prova solo la parte auto-reply.
12. Se la richiesta e' ambigua, clinica, urgente, legale, vuota o con bassa confidence, viene marcata come handoff e non parte auto-reply.

## Flow Outbound Voice

1. AI genera risposta testuale breve.
2. Se `tenant_config.voice_replies_enabled = true` e il canale supporta audio, ElevenLabs TTS genera MP3 con `eleven_flash_v2_5`.
3. Backend salva MP3 in storage tenant-scoped.
4. WhatsApp sender invia il media audio.
5. `messages.generated_audio_url`, `voice_id`, `voice_model_id` e costi stimati vengono salvati per audit.

## Defaults

- STT model: `scribe_v2`.
- TTS model: `eleven_flash_v2_5`.
- Lingua: `it`.
- Output audio: `mp3_44100_128`.
- Logging ElevenLabs: disabilitabile con `ELEVENLABS_ENABLE_LOGGING=false`; usare Zero Retention se disponibile sul piano.
- Media max bytes default: `WHATSAPP_MEDIA_MAX_BYTES=26214400`.
- Storage bucket default: `SUPABASE_MEDIA_BUCKET=ambrogio-media`.
- Soglia minima confidence STT per auto-reply: `AMBROGIO_VOICE_STT_MIN_CONFIDENCE=0.55`.

## Guardrail

- Non clonare voci di persone reali senza consenso scritto.
- Usare una voce brand/prodotto, non la voce del titolare dello studio, finche' non esiste consenso esplicito.
- Non auto-rispondere per emergenze, casi clinici severi, richieste legali o confidence STT bassa: handoff umano.
- Conservare vocali e transcript secondo retention GDPR del tenant.
- Mascherare PII/PHI nei log applicativi.
