/**
 * Verticali dataset.
 * Estratto in modulo dedicato per mantenere la pagina <250 righe.
 */

export interface VerticalContent {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  serviceType: string;
  hero: {
    eyebrow: string;
    h1: string;
    body: string;
  };
  icon: string;
  pains: { title: string; body: string }[];
  scenarios: { title: string; body: string }[];
  metric: { value: string; label: string };
  relatedBlogSlug: string | null;
}

export const VERTICALS_DATA: Record<string, VerticalContent> = {
  dental: {
    slug: 'dental',
    title: 'Studi dentistici',
    metaTitle: 'AI Receptionist Studi Dentistici',
    metaDescription:
      'AI receptionist per studi dentistici. Filtra urgenze, gestisce richiami, capisce quando serve la dottoressa.',
    serviceType: 'AI Reception per Studi Dentistici',
    hero: {
      eyebrow: 'Per studi dentistici',
      h1: 'Mai più una chiamata di urgenza persa.',
      body: 'Ambrogio capisce se è un mal di denti acuto o una richiesta di pulizia, fissa appuntamenti, gestisce i richiami semestrali e ti consegna ogni mattina la lista delle priorità.',
    },
    icon: '/assets/site-images/ambrogio/svg/06-vertical-dental.svg',
    pains: [
      {
        title: 'Reception sotto pressione',
        body: 'Le segretarie passano metà del tempo al telefono. Ambrogio prende il primo step e libera l’umano per il valore aggiunto.',
      },
      {
        title: 'Richiami che si dimenticano',
        body: 'Igiene semestrale, controlli post-cura, ortodonzia. Ambrogio ricorda tutto e ricontatta al momento giusto.',
      },
      {
        title: 'Urgenze fuori orario',
        body: 'Mal di denti la sera. Festivi. Sabato pomeriggio. Ambrogio risponde, qualifica l’urgenza e ti contatta solo quando serve.',
      },
    ],
    scenarios: [
      {
        title: 'Igiene semestrale',
        body: '“Buongiorno, è ora della pulizia di Anna.” Ambrogio legge l’ultima visita, propone 3 slot, conferma su Google Calendar.',
      },
      {
        title: 'Mal di denti acuto',
        body: '“Forte dolore, lato destro, da stamattina.” Ambrogio chiede dolore 1-10, qualifica, escalation immediata se >7.',
      },
      {
        title: 'Preventivo ortodonzia',
        body: '“Quanto costa l’apparecchio?” Ambrogio raccoglie info pre-anamnesi, fissa visita conoscitiva con materiali pronti.',
      },
    ],
    metric: { value: '+34%', label: 'Booking notturni vs reception umana' },
    relatedBlogSlug: 'come-uno-studio-dentistico-recupera-12k-anno',
  },
  beauty: {
    slug: 'beauty',
    title: 'Centri estetici e SPA',
    metaTitle: 'AI Receptionist Centri Estetici e SPA',
    metaDescription:
      'AI receptionist per centri estetici, parrucchieri e SPA. Trattamenti, pacchetti, gift card.',
    serviceType: 'AI Reception per Centri Estetici',
    hero: {
      eyebrow: 'Per centri estetici e SPA',
      h1: 'Ogni trattamento ha il suo prezzo, il suo tempo, la sua materia. Ambrogio li conosce.',
      body: 'Manicure, pedicure, ceretta, massaggi, depilazione laser, trattamenti viso. Ambrogio gestisce listini complessi, pacchetti, gift card. E parla il linguaggio caldo del tuo brand.',
    },
    icon: '/assets/site-images/ambrogio/svg/07-vertical-beauty.svg',
    pains: [
      {
        title: 'Listino complesso',
        body: 'Decine di trattamenti con tempi, materiali e operatori dedicati. Ambrogio sa chi fa cosa e quanto costa.',
      },
      {
        title: 'Pacchetti e gift card',
        body: 'Vendi pacchetti? Gift card? Promo stagionali? Ambrogio conosce le condizioni e applica le regole giuste.',
      },
      {
        title: 'No-show da incubo',
        body: 'Reminder via WhatsApp 24h prima riducono i no-show del 70%. Ambrogio li manda automatici.',
      },
    ],
    scenarios: [
      {
        title: 'Pacchetto trattamento viso',
        body: '“Vorrei iniziare il pacchetto pulizia profonda.” Ambrogio propone 4 slot a settimana per 4 settimane, gestisce calendario.',
      },
      {
        title: 'Gift card di Natale',
        body: '“Posso comprare una gift da 80€?” Ambrogio raccoglie dati, manda link Stripe, genera codice univoco.',
      },
      {
        title: 'Promo stagionale',
        body: '“È ancora valida la promo abbronzante?” Ambrogio controlla scadenze, condizioni, e prenota.',
      },
    ],
    metric: { value: '-68%', label: 'Riduzione no-show' },
    relatedBlogSlug: null,
  },
  fitness: {
    slug: 'fitness',
    title: 'Palestre e personal trainer',
    metaTitle: 'AI Receptionist Palestre e Personal Trainer',
    metaDescription:
      'AI receptionist per palestre, studi pilates, personal trainer. Lezioni, slot PT, abbonamenti.',
    serviceType: 'AI Reception per Palestre e PT',
    hero: {
      eyebrow: 'Per palestre e personal trainer',
      h1: 'Lezioni piene. Abbandoni in calo. Tu più tempo per allenare.',
      body: 'Ambrogio gestisce lezioni di gruppo, slot di personal training, lista d’attesa, abbonamenti. Manda i reminder che fanno la differenza tra venire e saltare.',
    },
    icon: '/assets/site-images/ambrogio/svg/08-vertical-fitness.svg',
    pains: [
      {
        title: 'Lezioni a numero chiuso',
        body: 'Pilates, yoga, spinning. Posti limitati, lista d’attesa dinamica, no-show. Ambrogio gestisce tutto come un dispatcher.',
      },
      {
        title: 'Slot PT',
        body: 'Ogni trainer ha il suo calendario. Ambrogio rispetta disponibilità, evita sovrapposizioni, propone alternative.',
      },
      {
        title: 'Abbonamenti che decadono',
        body: 'Ambrogio manda promemoria di rinnovo prima della scadenza. Calo abbandoni misurabile.',
      },
    ],
    scenarios: [
      {
        title: 'Prenotazione lezione',
        body: '“Pilates martedì alle 19?” Ambrogio controlla disponibilità, conferma, manda reminder 2h prima.',
      },
      {
        title: 'Lista d’attesa',
        body: '“Pieno? Avvisami se si libera.” Ambrogio mette in lista, contatta automaticamente alla disdetta.',
      },
      {
        title: 'Slot PT ricorrente',
        body: '“Vorrei i lunedì alle 18 con Marco.” Ambrogio crea slot ricorrenti su Google Calendar di Marco.',
      },
    ],
    metric: { value: '+22%', label: 'Aumento attendance lezioni' },
    relatedBlogSlug: null,
  },
  professional: {
    slug: 'professional',
    title: 'Studi professionali',
    metaTitle: 'AI Receptionist Studi Professionali',
    metaDescription:
      'AI receptionist per avvocati, commercialisti, consulenti. Qualifica lead, fissa incontri.',
    serviceType: 'AI Reception per Studi Professionali',
    hero: {
      eyebrow: 'Per studi professionali',
      h1: 'Solo gli incontri che valgono. Solo i clienti giusti.',
      body: 'Avvocati, commercialisti, consulenti. Ambrogio qualifica le richieste, raccoglie il pre-briefing, e fissa solo gli incontri con chi è realmente interessato.',
    },
    icon: '/assets/site-images/ambrogio/svg/09-vertical-professional-office.svg',
    pains: [
      {
        title: 'Lead non qualificati',
        body: 'Tante chiamate, pochi clienti. Ambrogio chiede subito le info che contano e filtra prima di prendere il tuo tempo.',
      },
      {
        title: 'Pre-briefing assente',
        body: 'Arrivi in riunione senza sapere il caso. Ambrogio raccoglie il contesto e te lo manda 30min prima.',
      },
      {
        title: 'Confidentiality',
        body: 'I dati restano in EU, redatti nei log, criptati a riposo. DPA pronto per ogni cliente che lo richiede.',
      },
    ],
    scenarios: [
      {
        title: 'Nuovo cliente avvocato',
        body: '“Ho un problema di lavoro.” Ambrogio chiede settore, urgenza, tipo problema, prima udienza, manda pre-briefing.',
      },
      {
        title: 'Commercialista — partita IVA',
        body: '“Vorrei aprire una P.IVA.” Ambrogio chiede tipo attività, regime fiscale presunto, fattura elettronica, fissa call.',
      },
      {
        title: 'Consulente — rinnovo contratto',
        body: '“Vorrei parlare del rinnovo.” Ambrogio identifica cliente, recupera storico, fissa incontro con context.',
      },
    ],
    metric: { value: '×2.4', label: 'Qualità lead vs reception standard' },
    relatedBlogSlug: null,
  },
};

export const VERTICAL_SLUGS = Object.keys(VERTICALS_DATA) as ReadonlyArray<
  keyof typeof VERTICALS_DATA
>;
