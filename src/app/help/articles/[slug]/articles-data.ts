/**
 * Help articles dataset.
 * Estratto in un modulo dedicato per mantenere la pagina <250 righe.
 *
 * Convenzioni:
 * - slug: identico al filename URL, kebab-case puro
 * - description: 110-160 caratteri, ottimizzata per meta description SEO
 * - body: contenuto completo articolo, supporta \n per paragrafi
 * - related: slugs di articoli correlati (deduplicato dal motore di rendering)
 */

export interface HelpArticle {
  slug: string;
  title: string;
  body: string;
  description: string;
  category: string;
  related: ReadonlyArray<string>;
}

export const ARTICLES: Record<string, HelpArticle> = {
  'come-collegare-il-numero-whatsapp-business': {
    slug: 'come-collegare-il-numero-whatsapp-business',
    title: 'Come collegare il numero WhatsApp Business',
    description:
      'Setup di WhatsApp Cloud API in 3 step: login Meta Business, selezione numero, verifica webhook. Tempo medio 10 minuti.',
    body: `Ti serve un account Meta Business Manager attivo e un numero verificato. Dalla dashboard Ambrogio vai su Impostazioni → WhatsApp e segui i 3 step:\n\n1. Login Meta Business — autorizza l'accesso al tuo account.\n2. Seleziona il numero WhatsApp Business da connettere.\n3. Verifica il webhook: Ambrogio invia un messaggio di test, lo ricevi sul tuo telefono e clicchi conferma.\n\nTempo medio: 10 minuti se hai già il Business Manager. Se non lo hai, il setup di Meta richiede 1-3 giorni di verifica documenti.`,
    category: 'Setup',
    related: ['come-autorizzare-google-calendar', 'caricare-il-listino-servizi'],
  },
  'come-autorizzare-google-calendar': {
    slug: 'come-autorizzare-google-calendar',
    title: 'Come autorizzare Google Calendar',
    description:
      'Connetti il calendario in 2 minuti via OAuth. Ambrogio legge solo disponibilità e crea eventi suoi, non tocca eventi privati.',
    body: `Vai su Impostazioni → Calendario → Connetti Google Calendar. Si apre una popup OAuth Google: accedi con l'account che gestisce gli appuntamenti dello studio, accetta i permessi.\n\nAmbrogio richiede solo: leggere disponibilità, creare eventi, modificare/cancellare gli eventi creati da Ambrogio. Non legge gli eventi privati pre-esistenti.\n\nSe hai più calendari, puoi scegliere quale usare per i booking di Ambrogio.`,
    category: 'Setup',
    related: ['come-collegare-il-numero-whatsapp-business', 'configurare-gli-orari-di-apertura'],
  },
  'caricare-il-listino-servizi': {
    slug: 'caricare-il-listino-servizi',
    title: 'Caricare il listino servizi',
    description:
      'Aggiungi servizi con nome, durata, prezzo e operatore preferito. CSV import disponibile. Più sono specifici, meglio Ambrogio capisce.',
    body: `Da Impostazioni → Servizi puoi aggiungere ogni servizio con: nome, durata in minuti, prezzo, operatore preferito (opzionale).\n\nPuoi anche importare un CSV. Scarica il template, compilalo, ricaricalo. Ambrogio leggerà i nomi dei servizi e li userà nelle conversazioni.\n\nPiù sono specifici i nomi (es. "Pulizia dei denti" vs "Igiene"), meglio Ambrogio capirà le richieste dei tuoi clienti.`,
    category: 'Setup',
    related: ['configurare-gli-orari-di-apertura', 'come-ambrogio-prenota-appuntamenti'],
  },
  'configurare-gli-orari-di-apertura': {
    slug: 'configurare-gli-orari-di-apertura',
    title: 'Configurare gli orari di apertura',
    description:
      'Imposta orari per giorno con fino a 3 fasce. Ferie pubbliche italiane gestite automaticamente.',
    body: `Da Impostazioni → Orari imposti per ogni giorno della settimana: orario apertura, chiusura, pausa pranzo. Puoi avere fino a 3 fasce orarie per giorno.\n\nAmbrogio rispetta automaticamente: ferie pubbliche italiane, giorni di chiusura straordinari, orari speciali (es. sabato ridotto).\n\nPer le festività personalizzate vai su Impostazioni → Calendario speciale.`,
    category: 'Setup',
    related: ['caricare-il-listino-servizi', 'come-ambrogio-prenota-appuntamenti'],
  },
  'come-funziona-il-filtro-ai': {
    slug: 'come-funziona-il-filtro-ai',
    title: 'Come funziona il filtro AI',
    description:
      'Tre filtri sequenziali: classificazione intent, validazione sicurezza, routing. Soglia di confidenza regolabile.',
    body: `Ogni messaggio in arrivo passa per 3 filtri: classificazione intent (booking, info, urgenza, spam), validazione sicurezza (nessuna PII non richiesta), routing (AI risponde direttamente o escala a umano).\n\nLa soglia di escalation è regolabile in Impostazioni → AI → Confidenza minima. Default: 0.85.`,
    category: 'AI',
    related: ['quando-interviene-un-umano', 'risposte-rapide-preconfezionate'],
  },
  'quando-interviene-un-umano': {
    slug: 'quando-interviene-un-umano',
    title: 'Quando interviene un umano',
    description:
      'Escalation su confidenza bassa, richiesta esplicita, urgenza, parole chiave critiche. Notifica push + email.',
    body: `Ambrogio escala a te quando: confidenza AI sotto soglia, richiesta esplicita ("voglio parlare con un umano"), urgenza dichiarata, conversazione aperta da più di 24h, parole chiave critiche (es. "reclamo", "rimborso").\n\nLe escalation arrivano via notifica push e via email. Tempo medio di intervento target: 4 ore lavorative.`,
    category: 'AI',
    related: ['come-funziona-il-filtro-ai', 'gestire-vocali-e-media'],
  },
  'gestire-vocali-e-media': {
    slug: 'gestire-vocali-e-media',
    title: 'Gestire vocali e media',
    description:
      'Trascrizione automatica vocali via ElevenLabs Speech-to-Text. Audio originale conservato 90 giorni.',
    body: `Ambrogio trascrive automaticamente i messaggi vocali WhatsApp (ElevenLabs Speech-to-Text). La trascrizione è disponibile sul dettaglio conversazione + audio originale conservato per 90 giorni.\n\nPer le risposte vocali in uscita (Professional+), Ambrogio usa ElevenLabs Text-to-Speech con una voce italiana brand-coerente.`,
    category: 'AI',
    related: ['come-funziona-il-filtro-ai', 'quando-interviene-un-umano'],
  },
  'risposte-rapide-preconfezionate': {
    slug: 'risposte-rapide-preconfezionate',
    title: 'Risposte rapide preconfezionate',
    description:
      'Knowledge base con FAQ standard. Formato una FAQ per riga con separatore "::". Ambrogio le usa quando rileva intent.',
    body: `Da Impostazioni → Knowledge base puoi caricare risposte standard per FAQ comuni: "siete aperti il sabato?", "accettate carte?", "dove siete?". Ambrogio le usa quando rileva l'intent corrispondente.\n\nFormato: una FAQ per riga, separatore "::". Esempio: "Siete aperti il sabato? :: Sì, dalle 9 alle 13."`,
    category: 'AI',
    related: ['come-funziona-il-filtro-ai', 'caricare-il-listino-servizi'],
  },
  'come-ambrogio-prenota-appuntamenti': {
    slug: 'come-ambrogio-prenota-appuntamenti',
    title: 'Come Ambrogio prenota appuntamenti',
    description:
      '5 step: identifica servizio, controlla disponibilità, propone 3 slot, conferma, crea evento. Notifica push immediata.',
    body: `Quando un cliente chiede un appuntamento, Ambrogio: (1) identifica il servizio richiesto, (2) controlla disponibilità su Google Calendar, (3) propone 3 slot, (4) conferma su selezione, (5) crea evento.\n\nL'evento contiene: nome cliente, telefono, servizio, eventuali note. Ti arriva notifica push immediata.`,
    category: 'Booking',
    related: ['gestire-conflitti-calendario', 'reminder-automatici'],
  },
  'gestire-conflitti-calendario': {
    slug: 'gestire-conflitti-calendario',
    title: 'Gestire conflitti calendario',
    description:
      'Niente sovrapposizioni. Sync ogni 60 secondi. Race condition: primo conferma vince, secondo riceve alternative.',
    body: `Ambrogio non sovrappone mai due appuntamenti. Se un cliente prenota uno slot già occupato (rare race condition), il primo conferma vince — il secondo riceve "spiacenti, lo slot è appena stato preso, posso proporne altri 3?".\n\nPer modifiche manuali al calendario, Ambrogio si sincronizza ogni 60 secondi.`,
    category: 'Booking',
    related: ['come-ambrogio-prenota-appuntamenti', 'gestire-le-disdette'],
  },
  'reminder-automatici': {
    slug: 'reminder-automatici',
    title: 'Reminder automatici',
    description:
      'Reminder 24h e 2h prima (configurabile). Cliente conferma con click, riprogramma o cancella. Reminder per servizio.',
    body: `Ambrogio invia reminder automatici 24h e 2h prima dell'appuntamento (configurabile). Il cliente può confermare con un click, riprogrammare, o cancellare.\n\nReminder configurabile per servizio: alcune visite richiedono preparazione (es. esame ecografico → reminder 48h prima con istruzioni).`,
    category: 'Booking',
    related: ['come-ambrogio-prenota-appuntamenti', 'gestire-le-disdette'],
  },
  'gestire-le-disdette': {
    slug: 'gestire-le-disdette',
    title: 'Gestire le disdette',
    description:
      'Disdetta via WhatsApp → conferma, cancellazione evento, eventuale nuovo slot proposto. Politica disdette personalizzabile.',
    body: `Cliente disdice via WhatsApp? Ambrogio: (1) chiede conferma, (2) cancella l'evento Google Calendar, (3) opzionalmente offre nuovo slot, (4) ti notifica.\n\nPolitica disdette personalizzabile: "disdetta libera entro 24h", "penale dopo 24h", "tariffa piena se no-show".`,
    category: 'Booking',
    related: ['gestire-conflitti-calendario', 'reminder-automatici'],
  },
  'cambiare-piano': {
    slug: 'cambiare-piano',
    title: 'Cambiare piano',
    description:
      'Upgrade immediato con fatturazione differenziale, downgrade dal ciclo successivo. Niente lock-in.',
    body: `Da Impostazioni → Fatturazione → Cambia piano. Upgrade è immediato (proprietà differenziale fatturata sul ciclo corrente). Downgrade decorre dal ciclo successivo per coerenza fatturazione.\n\nNessun lock-in: puoi tornare al piano precedente quando vuoi.`,
    category: 'Account',
    related: ['scaricare-fatture-elettroniche-sdi', 'aggiornare-dati-piva'],
  },
  'scaricare-fatture-elettroniche-sdi': {
    slug: 'scaricare-fatture-elettroniche-sdi',
    title: 'Scaricare fatture elettroniche SDI',
    description:
      "Fatture in PDF leggibile + XML SDI + riferimento Stripe. Trasmissione SDI automatica all'emissione.",
    body: `Da Fatturazione → Fatture trovi tutte le fatture emesse. Ognuna include: PDF leggibile, XML SDI, riferimento al pagamento Stripe.\n\nLa trasmissione SDI avviene automaticamente al momento dell'emissione. Lo Stato della trasmissione è visibile sotto ogni fattura.`,
    category: 'Account',
    related: ['cambiare-piano', 'aggiornare-dati-piva'],
  },
  'aggiornare-dati-piva': {
    slug: 'aggiornare-dati-piva',
    title: 'Aggiornare dati P.IVA',
    description:
      'Modifica ragione sociale, P.IVA, codice destinatario SDI. Le modifiche valgono per fatture future.',
    body: `Da Impostazioni → Dati fatturazione puoi modificare ragione sociale, P.IVA, codice destinatario SDI, indirizzo, codice fiscale.\n\nLe modifiche si applicano alle fatture future. Le fatture già emesse non vengono modificate per coerenza fiscale.`,
    category: 'Account',
    related: ['cambiare-piano', 'scaricare-fatture-elettroniche-sdi'],
  },
  'esportare-i-miei-dati-gdpr': {
    slug: 'esportare-i-miei-dati-gdpr',
    title: 'Esportare i miei dati (GDPR Art. 15)',
    description:
      'Export ZIP con JSON + CSV: account, conversazioni, appuntamenti, fatturazione, audit log. Email entro 24 ore.',
    body: `Da Impostazioni → Sicurezza → Esporta dati avvii la richiesta di export. Riceverai una email con link sicuro entro 24 ore.\n\nL'export contiene: dati account, conversazioni, appuntamenti, fatturazione, audit log delle tue azioni. Formato: ZIP con JSON strutturato + CSV.`,
    category: 'Account',
    related: ['cancellare-account', 'aggiornare-dati-piva'],
  },
  'cancellare-account': {
    slug: 'cancellare-account',
    title: 'Cancellare account',
    description:
      'Cancellazione con grace period 30 giorni. Fatture conservate 10 anni come da legge italiana.',
    body: `Da Impostazioni → Sicurezza → Cancella account. Dovrai digitare "ELIMINA DEFINITIVAMENTE" come conferma.\n\nEntra in vigore un grace period di 30 giorni: in questo periodo puoi annullare. Dopo i 30 giorni, tutti i tuoi dati vengono cancellati definitivamente (eccetto fatture, conservate 10 anni come da legge italiana).`,
    category: 'Account',
    related: ['esportare-i-miei-dati-gdpr', 'cambiare-piano'],
  },
};
