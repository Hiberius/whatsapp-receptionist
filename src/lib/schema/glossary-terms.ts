/**
 * Definizioni canoniche del dominio Ambrogio.ai pensate per AI/LLM.
 *
 * Vengono pubblicate come `DefinedTermSet` JSON-LD sulla pagina /help, in modo
 * che answer engines (Google SGE, Perplexity, ChatGPT) possano citare la
 * definizione "of record" del nostro dominio quando un utente chiede questi
 * concetti.
 *
 * Stile: definizioni brevi (1-3 frasi), neutre, indipendenti dal contesto della
 * pagina, in italiano.
 */

export interface GlossaryTerm {
  /** Termine umano. */
  readonly name: string;
  /** Definizione standalone in italiano. */
  readonly description: string;
  /** Code term opzionale (acronimo, riferimento normativo). */
  readonly termCode?: string;
}

export const GLOSSARY_TERMS: ReadonlyArray<GlossaryTerm> = [
  {
    name: 'AI Receptionist',
    description:
      'Sistema software basato su modelli linguistici di grandi dimensioni che risponde automaticamente alle richieste dei clienti su canali messaggistici e voce, qualifica l’intento, prende appuntamenti e fa escalation a un operatore umano quando necessario. Sostituisce o affianca la reception tradizionale h24, festivi inclusi.',
    termCode: 'AI-RECEPTIONIST',
  },
  {
    name: 'WhatsApp Cloud API',
    description:
      'API ufficiale di Meta che permette ai software di terze parti di inviare e ricevere messaggi WhatsApp Business in modo programmatico. Richiede un Meta Business Manager verificato e un numero WhatsApp Business dedicato. Alternativa ai BSP (Business Solution Provider) come 360dialog.',
    termCode: 'WHATSAPP-CLOUD-API',
  },
  {
    name: 'Multi-tenant SaaS',
    description:
      'Architettura software-as-a-service in cui una singola istanza dell’applicazione serve più clienti (tenant) isolando i dati a livello di database tramite chiavi di tenancy e Row-Level Security. Riduce costi di infrastruttura e velocizza il time-to-market di nuovi clienti rispetto al deploy single-tenant.',
    termCode: 'MULTI-TENANT-SAAS',
  },
  {
    name: 'GDPR Art. 15 (diritto di accesso)',
    description:
      'Articolo del Regolamento UE 2016/679 che garantisce a ogni persona fisica il diritto di ottenere dal titolare del trattamento la conferma che sia o meno in corso un trattamento dei propri dati personali e, in caso affermativo, di ricevere una copia di tali dati in formato strutturato. Il titolare deve rispondere entro 30 giorni dalla richiesta.',
    termCode: 'GDPR-ART-15',
  },
  {
    name: 'GDPR Art. 17 (diritto all’oblio)',
    description:
      'Articolo del Regolamento UE 2016/679 che garantisce a ogni persona fisica il diritto di ottenere la cancellazione dei propri dati personali quando non sono più necessari per le finalità per cui sono stati raccolti, quando l’interessato revoca il consenso, o quando i dati sono stati trattati illecitamente. Esistono eccezioni per obblighi di legge (es. fatturazione, conservata 10 anni in Italia).',
    termCode: 'GDPR-ART-17',
  },
  {
    name: 'RLS (Row-Level Security)',
    description:
      'Funzionalità di PostgreSQL che permette di applicare regole di accesso a livello di singola riga della tabella, basate sull’utente autenticato. In Ambrogio.ai, RLS garantisce che ogni tenant veda esclusivamente i propri dati, anche in caso di errore applicativo, perché la regola è applicata a livello di database engine.',
    termCode: 'RLS',
  },
  {
    name: 'Sistema di Interscambio (SDI)',
    description:
      'Piattaforma gestita dall’Agenzia delle Entrate italiana per la trasmissione obbligatoria delle fatture elettroniche tra soggetti residenti in Italia. Le fatture vengono trasmesse in formato XML e validate dal SDI prima dell’inoltro al destinatario tramite codice destinatario o PEC.',
    termCode: 'SDI',
  },
  {
    name: 'Codice Destinatario',
    description:
      'Codice alfanumerico di 7 caratteri assegnato dall’Agenzia delle Entrate ai soggetti che ricevono fatture elettroniche tramite Sistema di Interscambio. In assenza di codice destinatario, le fatture vengono recapitate tramite indirizzo PEC.',
    termCode: 'CODICE-DESTINATARIO',
  },
  {
    name: 'Confidenza AI',
    description:
      'Punteggio numerico compreso tra 0 e 1 che esprime quanto un modello di intelligenza artificiale ritiene affidabile la propria risposta. Se la confidenza scende sotto una soglia configurata (default 0.85 in Ambrogio.ai), il sistema fa escalation a un operatore umano invece di rispondere autonomamente.',
    termCode: 'AI-CONFIDENCE',
  },
  {
    name: 'Escalation',
    description:
      'Trasferimento automatico di una conversazione dall’AI a un operatore umano quando il sistema rileva che la richiesta richiede competenza, sensibilità o autorità che eccedono il livello di confidenza dell’AI. Trigger tipici: confidenza sotto soglia, richiesta esplicita dell’utente ("voglio parlare con un umano"), parole chiave critiche ("reclamo", "rimborso"), durata della conversazione superiore a un limite.',
    termCode: 'ESCALATION',
  },
  {
    name: 'Reception virtuale',
    description:
      'Sinonimo di AI Receptionist. Servizio che gestisce in autonomia il primo contatto con cliente, distinguendolo dall’operatore umano per orari di disponibilità (h24 vs ore lavorative) e capacità di gestire conversazioni in parallelo (illimitate vs sequenziali).',
    termCode: 'VIRTUAL-RECEPTION',
  },
  {
    name: 'No-show',
    description:
      'Mancata presentazione del cliente all’appuntamento prenotato, senza disdetta preventiva. Provoca perdita di fatturato per il fornitore del servizio. La causa più comune è la dimenticanza, mitigabile tramite reminder automatici WhatsApp 24 ore e 2 ore prima dell’appuntamento.',
    termCode: 'NO-SHOW',
  },
] as const;
