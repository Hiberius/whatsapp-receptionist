import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'public', 'assets', 'site-images', 'ambrogio');
const svgDir = path.join(outDir, 'svg');
const pngDir = path.join(outDir, 'png');
const webpDir = path.join(outDir, 'webp');

const W = 1600;
const H = 1000;

const palettes = [
  ['#0f766e', '#14b8a6', '#f8fafc', '#111827', '#f97316'],
  ['#2563eb', '#38bdf8', '#f8fafc', '#111827', '#10b981'],
  ['#7c3aed', '#22d3ee', '#f8fafc', '#111827', '#f59e0b'],
  ['#0f172a', '#2dd4bf', '#f8fafc', '#111827', '#f43f5e'],
  ['#065f46', '#84cc16', '#f8fafc', '#111827', '#0ea5e9'],
  ['#be123c', '#fb7185', '#fff7ed', '#111827', '#0f766e'],
  ['#1d4ed8', '#a3e635', '#f8fafc', '#111827', '#eab308'],
  ['#4338ca', '#f472b6', '#fdf2f8', '#111827', '#06b6d4'],
];

const assets = [
  {
    slug: 'hero-always-on-reception',
    title: 'Segreteria sempre attiva',
    use: 'Hero principale o hero alternativo',
    alt: 'Assistente AI Ambrogio che gestisce messaggi e appuntamenti anche fuori orario',
    composition: 'hero',
  },
  {
    slug: 'whatsapp-voice-transcript',
    title: 'Vocali WhatsApp trascritti',
    use: 'Sezione vocali ed ElevenLabs',
    alt: 'Messaggio vocale WhatsApp trasformato in testo e risposta di Ambrogio',
    composition: 'voice',
  },
  {
    slug: 'calendar-booking-flow',
    title: 'Prenotazione automatica',
    use: 'Come funziona, booking, Google Calendar',
    alt: 'Flusso visuale da messaggio WhatsApp a slot calendario prenotato',
    composition: 'calendar',
  },
  {
    slug: 'human-escalation',
    title: 'Escalation umana',
    use: 'Trust, sicurezza operativa, casi delicati',
    alt: 'Ambrogio passa una conversazione delicata a un operatore umano',
    composition: 'handoff',
  },
  {
    slug: 'privacy-vault',
    title: 'Privacy e DPA',
    use: 'Trust band, legal, security',
    alt: 'Dati cliente protetti in un vault privacy-first con audit log',
    composition: 'privacy',
  },
  {
    slug: 'vertical-dental',
    title: 'Studio dentistico',
    use: 'Verticali: dentisti',
    alt: 'Studio dentistico con prenotazioni WhatsApp gestite da Ambrogio',
    composition: 'vertical-dental',
  },
  {
    slug: 'vertical-beauty',
    title: 'Centro estetico',
    use: 'Verticali: estetica e beauty',
    alt: 'Centro estetico con messaggi e appuntamenti automatizzati',
    composition: 'vertical-beauty',
  },
  {
    slug: 'vertical-fitness',
    title: 'Palestra e pilates',
    use: 'Verticali: fitness, palestre, pilates',
    alt: 'Studio fitness con calendario lezioni e richieste WhatsApp',
    composition: 'vertical-fitness',
  },
  {
    slug: 'vertical-professional-office',
    title: 'Studio professionale',
    use: 'Verticali: consulenti e studi professionali',
    alt: 'Studio professionale con front desk AI e documenti organizzati',
    composition: 'office',
  },
  {
    slug: 'multi-channel-orbit',
    title: 'Canali collegati',
    use: 'Sezione prodotto e integrazioni',
    alt: 'WhatsApp, DM, chat e calendario collegati intorno ad Ambrogio',
    composition: 'orbit',
  },
  {
    slug: 'dashboard-command-center',
    title: 'Dashboard operativa',
    use: 'Dashboard preview',
    alt: 'Dashboard Ambrogio con conversazioni, appuntamenti e metriche',
    composition: 'dashboard',
  },
  {
    slug: 'roi-calculator',
    title: 'ROI calculator',
    use: 'Sezione ROI e pricing',
    alt: 'Calcolo ritorno economico degli appuntamenti recuperati con Ambrogio',
    composition: 'roi',
  },
  {
    slug: 'onboarding-three-steps',
    title: 'Onboarding in tre step',
    use: 'Come funziona e onboarding',
    alt: 'Connetti WhatsApp, configura FAQ e vai live con Ambrogio',
    composition: 'onboarding',
  },
  {
    slug: 'night-to-morning-bookings',
    title: 'Da notte ad appuntamenti',
    use: 'Prima/Dopo, hero storytelling',
    alt: 'Richieste arrivate di notte diventano appuntamenti confermati al mattino',
    composition: 'night',
  },
  {
    slug: 'voice-personality',
    title: 'Voce naturale',
    use: 'Voice AI e risposte vocali',
    alt: 'Voce AI naturale per risposte vocali WhatsApp opzionali',
    composition: 'voice-personality',
  },
  {
    slug: 'knowledge-base',
    title: 'Knowledge base',
    use: 'AI engine, FAQ, configurazione',
    alt: 'FAQ, servizi e orari trasformati in knowledge base per Ambrogio',
    composition: 'knowledge',
  },
  {
    slug: 'agency-white-label',
    title: 'White-label agenzie',
    use: 'Pagina Per Agenzie',
    alt: "Agenzia che gestisce piu' clienti white-label con Ambrogio",
    composition: 'agency',
  },
  {
    slug: 'webhook-infrastructure',
    title: 'Infrastruttura webhook',
    use: 'Tech/security page, blog tecnico',
    alt: 'Webhook WhatsApp, database e AI engine collegati in modo sicuro',
    composition: 'infra',
  },
  {
    slug: 'fair-use-pricing',
    title: 'Prezzi e fair use',
    use: 'Pricing, FAQ costi WhatsApp',
    alt: 'Metriche di utilizzo, fair use e costi provider chiari',
    composition: 'pricing',
  },
  {
    slug: 'italy-beta-pilot',
    title: 'Beta studi italiani',
    use: 'Social proof beta e sezione pilota',
    alt: 'Studi pilota italiani collegati ad Ambrogio.ai',
    composition: 'italy',
  },
];

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function defs(id, p) {
  return `
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p[2]}"/>
      <stop offset="46%" stop-color="${mix(p[1], p[2], 0.16)}"/>
      <stop offset="100%" stop-color="${mix(p[0], p[2], 0.22)}"/>
    </linearGradient>
    <linearGradient id="primary-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p[0]}"/>
      <stop offset="100%" stop-color="${p[1]}"/>
    </linearGradient>
    <linearGradient id="accent-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p[4]}"/>
      <stop offset="100%" stop-color="${p[1]}"/>
    </linearGradient>
    <radialGradient id="glow-${id}" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="${p[1]}" stop-opacity=".45"/>
      <stop offset="70%" stop-color="${p[1]}" stop-opacity=".08"/>
      <stop offset="100%" stop-color="${p[1]}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow-${id}" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#0f172a" flood-opacity=".16"/>
    </filter>
    <filter id="smallShadow-${id}" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity=".12"/>
    </filter>
    <pattern id="grid-${id}" width="58" height="58" patternUnits="userSpaceOnUse">
      <path d="M 58 0 L 0 0 0 58" fill="none" stroke="#0f172a" stroke-opacity=".055" stroke-width="1"/>
    </pattern>
    <pattern id="dots-${id}" width="34" height="34" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="2" fill="#0f172a" opacity=".06"/>
    </pattern>
    <clipPath id="phoneClip-${id}">
      <rect x="0" y="0" width="360" height="700" rx="48"/>
    </clipPath>
  </defs>`;
}

function mix(a, b, t) {
  const ah = hex(a);
  const bh = hex(b);
  const c = ah.map((v, i) => Math.round(v * (1 - t) + bh[i] * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hex(color) {
  const clean = color.replace('#', '');
  return [0, 2, 4].map((i) => Number.parseInt(clean.slice(i, i + 2), 16));
}

function base(asset, index, content) {
  const p = palettes[index % palettes.length];
  const id = `a${index}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title-${id} desc-${id}">
  <title id="title-${id}">${esc(asset.title)}</title>
  <desc id="desc-${id}">${esc(asset.alt)}</desc>
  ${defs(id, p)}
  <rect width="${W}" height="${H}" fill="url(#bg-${id})"/>
  <rect width="${W}" height="${H}" fill="url(#grid-${id})"/>
  <circle cx="${1240 - (index % 4) * 70}" cy="${180 + (index % 3) * 80}" r="360" fill="url(#glow-${id})"/>
  <circle cx="${260 + (index % 3) * 60}" cy="${820 - (index % 4) * 40}" r="300" fill="${p[4]}" opacity=".07"/>
  <g font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
    ${content(id, p, index)}
  </g>
</svg>`;
}

function card(x, y, w, h, r = 32, fill = '#ffffff', opacity = 0.82) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="${opacity}" filter="url(#smallShadow-a0)"/>`;
}

function rect(x, y, w, h, r, fill, opacity = 1, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="${opacity}" ${extra}/>`;
}

function label(x, y, text, color = '#0f172a', size = 42, weight = 700, opacity = 1) {
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" opacity="${opacity}">${esc(text)}</text>`;
}

function pill(x, y, text, fill, color = '#fff', w = 250) {
  return `<g filter="url(#smallShadow-a0)">${rect(x, y, w, 58, 29, fill, 1)}${label(x + 28, y + 39, text, color, 22, 750)}</g>`;
}

function phone(id, p, x, y, scale = 1, inner = '') {
  return `<g transform="translate(${x} ${y}) scale(${scale})" filter="url(#softShadow-${id})">
    <rect x="0" y="0" width="400" height="760" rx="64" fill="#0f172a"/>
    <rect x="22" y="22" width="356" height="716" rx="50" fill="#f8fafc"/>
    <rect x="132" y="38" width="136" height="24" rx="12" fill="#0f172a"/>
    <g transform="translate(22 22)" clip-path="url(#phoneClip-${id})">
      <rect width="356" height="716" fill="#f1f5f9"/>
      <rect width="356" height="90" fill="url(#primary-${id})"/>
      <circle cx="52" cy="48" r="24" fill="#fff" opacity=".92"/>
      <text x="92" y="56" fill="#fff" font-size="25" font-weight="800">Ambrogio</text>
      ${inner}
    </g>
  </g>`;
}

function bubble(x, y, w, h, text, incoming = true, fill = '#fff') {
  const tx = x + 24;
  const color = incoming ? '#0f172a' : '#ffffff';
  const bg = incoming ? fill : '#0f766e';
  const chunks = wrap(text, 24);
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${bg}" filter="url(#smallShadow-a0)"/>
    ${chunks.map((line, i) => `<text x="${tx}" y="${y + 36 + i * 28}" fill="${color}" font-size="22" font-weight="650">${esc(line)}</text>`).join('')}
  </g>`;
}

function wrap(text, n) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > n) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function waveform(x, y, bars, color, scale = 1) {
  return `<g>${Array.from({ length: bars }, (_, i) => {
    const h = 18 + Math.abs(Math.sin(i * 1.37)) * 72 * scale;
    return rect(x + i * 16, y - h / 2, 8, h, 4, color, 0.84);
  }).join('')}</g>`;
}

function calendarGrid(x, y, p, id) {
  const cells = [];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      const active = (r === 1 && c === 2) || (r === 2 && c === 4) || (r === 3 && c === 1);
      cells.push(
        rect(
          x + c * 92,
          y + r * 84,
          70,
          56,
          16,
          active ? `url(#primary-${id})` : '#e2e8f0',
          active ? 1 : 0.75,
        ),
      );
    }
  }
  return `<g>${cells.join('')}</g>`;
}

const renderers = {
  hero: (id, p) => {
    const inner = `
      ${bubble(28, 130, 288, 94, 'Buonasera, vorrei prenotare', true)}
      ${bubble(82, 250, 246, 126, 'Certo. Ho 3 slot liberi domani.', false, p[0])}
      ${bubble(28, 405, 300, 112, 'Prendo quello delle 10:30', true)}
      ${bubble(72, 546, 256, 82, 'Perfetto. Prenotato.', false, p[0])}`;
    return `
      <g transform="translate(120 120)">
        ${label(0, 70, 'Ambrogio.ai', p[3], 74, 850)}
        ${label(0, 128, 'risponde quando lo studio dorme', p[3], 38, 720, 0.72)}
        ${pill(0, 178, '24/7 front desk AI', `url(#primary-${id})`, '#fff', 310)}
        ${pill(330, 178, 'WhatsApp + vocali', '#fff', p[0], 300)}
        <rect x="0" y="300" width="540" height="320" rx="42" fill="#fff" opacity=".82" filter="url(#softShadow-${id})"/>
        ${calendarGrid(50, 390, p, id)}
        ${label(52, 358, 'Slot confermati', p[3], 34, 800)}
      </g>
      ${phone(id, p, 940, 110, 0.92, inner)}
      <path d="M690 500 C820 410 850 320 950 280" stroke="url(#accent-${id})" stroke-width="10" fill="none" stroke-linecap="round" opacity=".8"/>
      <circle cx="706" cy="494" r="16" fill="${p[4]}"/><circle cx="950" cy="280" r="16" fill="${p[1]}"/>`;
  },
  voice: (id, p) => {
    const inner = `
      ${bubble(26, 132, 300, 86, 'Messaggio vocale', true)}
      <rect x="48" y="248" width="260" height="82" rx="41" fill="#dcfce7"/>
      <circle cx="92" cy="289" r="24" fill="${p[0]}"/><polygon points="86,277 86,301 106,289" fill="#fff"/>
      ${waveform(132, 289, 10, p[0], 0.55)}
      ${bubble(28, 374, 300, 136, 'Transcript: spostare visita a venerdi', true)}
      ${bubble(74, 545, 252, 92, 'Fatto. Ti propongo due orari.', false, p[0])}`;
    return `
      ${phone(id, p, 125, 110, 0.92, inner)}
      <g transform="translate(670 160)">
        ${label(0, 60, 'Vocali capiti', p[3], 70, 850)}
        ${label(0, 118, 'senza perdere il tono umano', p[3], 38, 700, 0.68)}
        <rect x="0" y="190" width="690" height="300" rx="52" fill="#fff" opacity=".84" filter="url(#softShadow-${id})"/>
        ${waveform(72, 330, 28, p[0], 1)}
        <path d="M80 430 C160 360 246 500 340 414 S540 372 635 442" stroke="${p[4]}" stroke-width="10" fill="none" stroke-linecap="round"/>
        ${pill(72, 228, 'ElevenLabs STT', `url(#primary-${id})`, '#fff', 300)}
        ${pill(400, 228, 'Risposta vocale', '#0f172a', '#fff', 260)}
      </g>`;
  },
  calendar: (id, p) => `
    <g transform="translate(110 130)">
      ${label(0, 70, 'Dal messaggio', p[3], 64, 850)}
      ${label(0, 130, 'allo slot in calendario', p[3], 50, 760, 0.78)}
      <rect x="0" y="220" width="400" height="420" rx="42" fill="#fff" opacity=".88" filter="url(#softShadow-${id})"/>
      ${bubble(42, 270, 316, 112, 'Avete posto domani mattina?', true)}
      ${bubble(72, 420, 286, 110, 'Si: 9:30 o 11:00.', false, p[0])}
    </g>
    <path d="M565 495 C660 430 720 410 815 420" stroke="url(#accent-${id})" stroke-width="12" fill="none" stroke-linecap="round"/>
    <polygon points="810,390 880,420 810,450" fill="${p[4]}"/>
    <g transform="translate(890 150)">
      <rect x="0" y="0" width="560" height="620" rx="52" fill="#fff" opacity=".88" filter="url(#softShadow-${id})"/>
      <rect x="0" y="0" width="560" height="120" rx="52" fill="url(#primary-${id})"/>
      ${label(50, 76, 'Mercoledi', '#fff', 44, 850)}
      ${calendarGrid(64, 180, p, id)}
      <rect x="64" y="510" width="432" height="58" rx="29" fill="${p[0]}" opacity=".12"/>
      ${label(92, 549, '10:30 prenotato', p[0], 30, 850)}
    </g>`,
  handoff: (id, p) => `
    <g transform="translate(110 150)">
      <rect x="0" y="0" width="620" height="600" rx="58" fill="#fff" opacity=".86" filter="url(#softShadow-${id})"/>
      ${label(58, 82, 'AI', p[0], 56, 900)}
      <circle cx="160" cy="230" r="82" fill="url(#primary-${id})" opacity=".92"/>
      <path d="M130 230 Q160 190 190 230 Q160 270 130 230Z" fill="#fff" opacity=".9"/>
      ${bubble(58, 366, 490, 104, 'Domanda delicata: passo al team.', true)}
      ${pill(58, 500, 'Escalation sicura', p[0], '#fff', 300)}
    </g>
    <path d="M760 450 C830 370 900 360 985 430" stroke="url(#accent-${id})" stroke-width="12" fill="none" stroke-linecap="round"/>
    <g transform="translate(980 220)">
      <rect x="0" y="0" width="460" height="430" rx="54" fill="#fff" opacity=".9" filter="url(#softShadow-${id})"/>
      ${label(56, 82, 'Operatore', p[3], 46, 850)}
      <circle cx="130" cy="200" r="64" fill="${p[4]}" opacity=".84"/>
      <circle cx="130" cy="170" r="22" fill="#fff"/><path d="M82 248 C96 210 164 210 178 248" fill="#fff"/>
      ${bubble(56, 292, 350, 82, 'Ti rispondo io.', false, p[0])}
    </g>`,
  privacy: (id, p) => `
    <g transform="translate(170 120)">
      ${label(0, 70, 'Privacy-first', p[3], 72, 880)}
      ${label(0, 126, 'DPA, audit log e dati separati', p[3], 36, 700, 0.68)}
      <rect x="0" y="225" width="520" height="420" rx="54" fill="#fff" opacity=".86" filter="url(#softShadow-${id})"/>
      <path d="M260 310 L412 374 V470 C412 560 330 604 260 624 C190 604 108 560 108 470 V374 Z" fill="url(#primary-${id})"/>
      <path d="M206 462 L246 502 L326 414" stroke="#fff" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g transform="translate(820 150)">
      ${['Tenant A', 'Tenant B', 'Audit log', 'DPA'].map((t, i) => `<rect x="${(i % 2) * 300}" y="${Math.floor(i / 2) * 190}" width="260" height="150" rx="34" fill="#fff" opacity=".86" filter="url(#smallShadow-${id})"/>${label((i % 2) * 300 + 34, Math.floor(i / 2) * 190 + 74, t, p[3], 32, 820)}<rect x="${(i % 2) * 300 + 34}" y="${Math.floor(i / 2) * 190 + 94}" width="150" height="14" rx="7" fill="${i % 2 ? p[4] : p[0]}" opacity=".55"/>`).join('')}
    </g>`,
  'vertical-dental': (id, p) =>
    verticalScene(id, p, 'Studio dentistico', 'Pulizia 10:30', 'vertical-dental'),
  'vertical-beauty': (id, p) =>
    verticalScene(id, p, 'Centro estetico', 'Trattamento 16:00', 'vertical-beauty'),
  'vertical-fitness': (id, p) =>
    verticalScene(id, p, 'Pilates studio', 'Lezione 18:30', 'vertical-fitness'),
  office: (id, p) => verticalScene(id, p, 'Studio professionale', 'Consulenza 12:00', 'office'),
  orbit: (id, p) => `
    <circle cx="800" cy="500" r="170" fill="url(#primary-${id})" opacity=".94" filter="url(#softShadow-${id})"/>
    ${label(674, 518, 'Ambrogio', '#fff', 48, 900)}
    ${orbitNode(320, 240, 'WA', p[0])}${orbitNode(1160, 240, 'DM', p[4])}${orbitNode(280, 710, 'Chat', '#111827')}${orbitNode(1180, 700, 'Cal', p[1])}
    <path d="M450 310 C620 410 650 410 690 440" stroke="#0f172a" stroke-opacity=".16" stroke-width="10" fill="none"/>
    <path d="M1138 310 C980 400 950 420 910 440" stroke="#0f172a" stroke-opacity=".16" stroke-width="10" fill="none"/>
    <path d="M430 690 C580 600 630 580 690 560" stroke="#0f172a" stroke-opacity=".16" stroke-width="10" fill="none"/>
    <path d="M1150 680 C1000 610 950 585 910 560" stroke="#0f172a" stroke-opacity=".16" stroke-width="10" fill="none"/>
    ${label(160, 110, 'Tutti i canali', p[3], 70, 880)}
    ${label(160, 166, 'in una sola reception AI', p[3], 38, 700, 0.68)}`,
  dashboard: (id, p) => `
    <g transform="translate(130 100)">
      ${label(0, 70, 'Command center', p[3], 72, 880)}
      <rect x="0" y="150" width="1320" height="680" rx="56" fill="#fff" opacity=".9" filter="url(#softShadow-${id})"/>
      <rect x="0" y="150" width="260" height="680" rx="56" fill="#0f172a"/>
      ${['Dashboard', 'Conversazioni', 'Calendario', 'Voice', 'Privacy'].map((t, i) => `<rect x="36" y="${215 + i * 78}" width="188" height="46" rx="23" fill="${i === 0 ? p[1] : '#ffffff'}" opacity="${i === 0 ? 1 : 0.1}"/><text x="62" y="${246 + i * 78}" fill="#fff" font-size="20" font-weight="750">${t}</text>`).join('')}
      <rect x="320" y="215" width="260" height="150" rx="34" fill="${p[0]}" opacity=".1"/>
      <rect x="620" y="215" width="260" height="150" rx="34" fill="${p[4]}" opacity=".12"/>
      <rect x="920" y="215" width="330" height="150" rx="34" fill="${p[1]}" opacity=".12"/>
      ${label(352, 280, '42', p[0], 58, 900)}${label(652, 280, '18', p[4], 58, 900)}${label(952, 280, '96%', p[0], 58, 900)}
      <path d="M340 590 C430 490 520 650 610 540 S780 460 890 560 S1050 620 1230 450" stroke="url(#primary-${id})" stroke-width="16" fill="none" stroke-linecap="round"/>
      ${Array.from({ length: 6 }, (_, i) => rect(330, 430 + i * 42, 890 - i * 58, 18, 9, '#e2e8f0', 0.95)).join('')}
    </g>`,
  roi: (id, p) => `
    <g transform="translate(120 130)">
      ${label(0, 70, 'Quanto vale', p[3], 70, 880)}
      ${label(0, 128, "una risposta in piu'?", p[3], 48, 760, 0.74)}
      <rect x="0" y="220" width="560" height="430" rx="54" fill="#fff" opacity=".88" filter="url(#softShadow-${id})"/>
      ${['Richieste perse', 'Ticket medio', 'Appuntamenti recuperati'].map((t, i) => `<text x="62" y="${305 + i * 92}" fill="#334155" font-size="28" font-weight="750">${t}</text><rect x="360" y="${272 + i * 92}" width="130" height="44" rx="22" fill="#f1f5f9"/><text x="402" y="${303 + i * 92}" fill="${p[0]}" font-size="26" font-weight="850">${['12', '80', '7'][i]}</text>`).join('')}
      <rect x="62" y="550" width="430" height="64" rx="32" fill="url(#primary-${id})"/>
      ${label(96, 592, '+560 euro stimati', '#fff', 32, 850)}
    </g>
    <g transform="translate(840 210)">
      <rect x="0" y="0" width="520" height="470" rx="56" fill="#fff" opacity=".86" filter="url(#softShadow-${id})"/>
      ${[180, 300, 410].map((h, i) => `<rect x="${95 + i * 120}" y="${420 - h}" width="74" height="${h}" rx="24" fill="${i === 2 ? p[4] : p[0]}" opacity="${0.48 + i * 0.2}"/>`).join('')}
      <path d="M80 350 C190 300 250 250 332 180 S420 130 464 90" stroke="${p[4]}" stroke-width="12" fill="none" stroke-linecap="round"/>
    </g>`,
  onboarding: (id, p) => `
    ${label(120, 140, 'Tre step', p[3], 72, 880)}
    ${label(120, 198, "e lo studio e' online", p[3], 42, 730, 0.7)}
    ${stepCard(130, 330, '1', 'Connetti', 'WhatsApp Business', p, id)}
    ${stepCard(570, 260, '2', 'Configura', 'FAQ, orari, servizi', p, id)}
    ${stepCard(1010, 330, '3', 'Vai live', 'Ambrogio prenota', p, id)}
    <path d="M465 510 C520 440 560 420 620 420" stroke="url(#accent-${id})" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M900 420 C960 420 1000 450 1052 510" stroke="url(#accent-${id})" stroke-width="10" fill="none" stroke-linecap="round"/>`,
  night: (id, p) => `
    <rect x="0" y="0" width="800" height="1000" fill="#0f172a" opacity=".92"/>
    <rect x="800" y="0" width="800" height="1000" fill="url(#bg-${id})"/>
    <circle cx="250" cy="210" r="82" fill="#f8fafc" opacity=".9"/>
    <circle cx="290" cy="185" r="82" fill="#0f172a"/>
    <circle cx="1190" cy="240" r="110" fill="${p[4]}" opacity=".22"/>
    ${label(112, 120, '23:48', '#fff', 78, 850)}
    ${bubble(120, 360, 470, 110, 'Salve, posso prenotare per domani?', true)}
    ${label(920, 138, '08:10', p[3], 78, 850)}
    <rect x="920" y="310" width="470" height="350" rx="54" fill="#fff" opacity=".88" filter="url(#softShadow-${id})"/>
    ${calendarGrid(980, 410, p, id)}
    ${label(978, 378, '3 appuntamenti', p[3], 38, 850)}
    <path d="M620 510 C760 420 850 420 980 500" stroke="url(#accent-${id})" stroke-width="12" fill="none" stroke-linecap="round"/>`,
  'voice-personality': (id, p) => `
    ${label(120, 140, 'Una voce', p[3], 72, 880)}
    ${label(120, 198, 'che sembra parte dello studio', p[3], 42, 730, 0.7)}
    <g transform="translate(180 300)">
      <rect x="0" y="0" width="340" height="430" rx="64" fill="#fff" opacity=".88" filter="url(#softShadow-${id})"/>
      <rect x="126" y="70" width="88" height="190" rx="44" fill="url(#primary-${id})"/>
      <rect x="104" y="260" width="132" height="26" rx="13" fill="${p[3]}" opacity=".82"/>
      <path d="M72 190 C72 320 268 320 268 190" stroke="${p[4]}" stroke-width="18" fill="none" stroke-linecap="round"/>
      <path d="M170 286 V350" stroke="${p[3]}" stroke-width="18" stroke-linecap="round"/>
    </g>
    <g transform="translate(650 310)">
      ${waveform(0, 200, 42, p[0], 1.15)}
      <path d="M0 360 C160 250 270 450 450 320 S690 280 780 400" stroke="${p[4]}" stroke-width="12" fill="none" stroke-linecap="round" opacity=".9"/>
      ${pill(0, 50, 'STT + TTS', `url(#primary-${id})`, '#fff', 240)}
      ${pill(270, 50, 'Tenant voice', '#fff', p[0], 240)}
    </g>`,
  knowledge: (id, p) => `
    ${label(120, 132, 'La memoria', p[3], 72, 880)}
    ${label(120, 190, 'del tuo studio', p[3], 44, 740, 0.7)}
    <g transform="translate(120 300)">
      ${['FAQ', 'Servizi', 'Orari', 'Prezzi'].map((t, i) => `<rect x="0" y="${i * 96}" width="300" height="72" rx="24" fill="#fff" opacity=".88" filter="url(#smallShadow-${id})"/><text x="34" y="${i * 96 + 47}" fill="${p[3]}" font-size="28" font-weight="830">${t}</text>`).join('')}
    </g>
    <path d="M470 470 C590 390 650 390 750 455" stroke="url(#accent-${id})" stroke-width="12" fill="none" stroke-linecap="round"/>
    <g transform="translate(810 220)">
      <circle cx="260" cy="250" r="210" fill="#fff" opacity=".88" filter="url(#softShadow-${id})"/>
      ${Array.from({ length: 12 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 12;
        const x = 260 + Math.cos(a) * (90 + (i % 2) * 48);
        const y = 250 + Math.sin(a) * (90 + (i % 2) * 48);
        return `<circle cx="${x}" cy="${y}" r="18" fill="${i % 3 === 0 ? p[4] : p[0]}" opacity=".86"/><line x1="260" y1="250" x2="${x}" y2="${y}" stroke="#0f172a" stroke-opacity=".12" stroke-width="6"/>`;
      }).join('')}
      <circle cx="260" cy="250" r="58" fill="url(#primary-${id})"/>
    </g>`,
  agency: (id, p) => `
    ${label(120, 132, 'Agenzie', p[3], 72, 880)}
    ${label(120, 190, 'white-label, multi-cliente', p[3], 44, 740, 0.7)}
    <g transform="translate(120 300)">
      <rect x="0" y="0" width="360" height="420" rx="54" fill="#fff" opacity=".9" filter="url(#softShadow-${id})"/>
      ${label(48, 76, 'Partner', p[0], 44, 880)}
      ${['Cliente A', 'Cliente B', 'Cliente C'].map((t, i) => `<rect x="48" y="${130 + i * 82}" width="260" height="56" rx="22" fill="${i === 0 ? `url(#primary-${id})` : '#f1f5f9'}"/><text x="76" y="${166 + i * 82}" fill="${i === 0 ? '#fff' : p[3]}" font-size="24" font-weight="790">${t}</text>`).join('')}
    </g>
    <g transform="translate(650 225)">
      ${Array.from({ length: 6 }, (_, i) => `<rect x="${(i % 3) * 250}" y="${Math.floor(i / 3) * 230}" width="200" height="170" rx="38" fill="#fff" opacity=".86" filter="url(#smallShadow-${id})"/><circle cx="${(i % 3) * 250 + 62}" cy="${Math.floor(i / 3) * 230 + 66}" r="28" fill="${i % 2 ? p[4] : p[0]}" opacity=".8"/><rect x="${(i % 3) * 250 + 34}" y="${Math.floor(i / 3) * 230 + 112}" width="130" height="16" rx="8" fill="#cbd5e1"/><rect x="${(i % 3) * 250 + 34}" y="${Math.floor(i / 3) * 230 + 142}" width="92" height="16" rx="8" fill="#e2e8f0"/>`).join('')}
    </g>`,
  infra: (id, p) => `
    ${label(120, 130, 'Webhook', p[3], 72, 880)}
    ${label(120, 188, 'sicuri, idempotenti, tracciati', p[3], 42, 730, 0.7)}
    ${infraNode(150, 370, 'WhatsApp', p[0])}
    ${infraNode(540, 300, 'API', p[4])}
    ${infraNode(890, 370, 'AI', p[1])}
    ${infraNode(1210, 300, 'DB', '#0f172a')}
    <path d="M350 460 C450 405 470 405 540 400" stroke="url(#accent-${id})" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M740 400 C820 405 840 430 890 460" stroke="url(#accent-${id})" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M1090 460 C1160 430 1170 405 1210 400" stroke="url(#accent-${id})" stroke-width="12" fill="none" stroke-linecap="round"/>
    <rect x="350" y="690" width="900" height="90" rx="45" fill="#fff" opacity=".86" filter="url(#softShadow-${id})"/>
    ${label(415, 748, 'idempotency key  /  tenant resolver  /  audit log', p[3], 30, 800)}`,
  pricing: (id, p) => `
    ${label(120, 130, 'Prezzi chiari', p[3], 72, 880)}
    ${label(120, 188, 'software + costi canale visibili', p[3], 42, 730, 0.7)}
    <g transform="translate(120 300)">
      ${['Starter', 'Professional', 'Agency'].map((t, i) => `<rect x="${i * 430}" y="0" width="360" height="470" rx="54" fill="#fff" opacity=".9" filter="url(#softShadow-${id})"/><text x="${i * 430 + 48}" y="76" fill="${p[3]}" font-size="38" font-weight="870">${t}</text><text x="${i * 430 + 48}" y="144" fill="${i === 1 ? p[4] : p[0]}" font-size="48" font-weight="900">${['149', '299', '897'][i]} euro</text><rect x="${i * 430 + 48}" y="205" width="250" height="20" rx="10" fill="#e2e8f0"/><rect x="${i * 430 + 48}" y="255" width="210" height="20" rx="10" fill="#e2e8f0"/><rect x="${i * 430 + 48}" y="305" width="270" height="20" rx="10" fill="#e2e8f0"/><rect x="${i * 430 + 48}" y="380" width="190" height="52" rx="26" fill="${i === 1 ? `url(#primary-${id})` : '#f1f5f9'}"/><text x="${i * 430 + 82}" y="414" fill="${i === 1 ? '#fff' : p[3]}" font-size="22" font-weight="820">Fair use</text>`).join('')}
    </g>`,
  italy: (id, p) => `
    ${label(120, 130, 'Primi studi', p[3], 72, 880)}
    ${label(120, 188, 'pilota in Italia', p[3], 42, 730, 0.7)}
    <g transform="translate(670 120)">
      <path d="M236 40 C300 84 280 154 330 190 C374 222 430 238 424 292 C418 350 350 338 334 388 C318 440 388 484 346 534 C306 582 250 540 214 590 C176 642 220 712 160 750 C112 782 72 724 94 666 C116 610 164 592 148 536 C132 480 70 478 62 420 C54 360 118 344 124 288 C130 230 82 188 116 134 C146 86 184 30 236 40Z" fill="#fff" opacity=".88" filter="url(#softShadow-${id})"/>
      ${[
        [210, 150],
        [300, 280],
        [190, 390],
        [270, 500],
        [150, 640],
      ]
        .map(
          ([x, y], i) =>
            `<circle cx="${x}" cy="${y}" r="22" fill="${i % 2 ? p[4] : p[0]}"/><circle cx="${x}" cy="${y}" r="46" fill="${i % 2 ? p[4] : p[0]}" opacity=".14"/>`,
        )
        .join('')}
    </g>
    <g transform="translate(120 300)">
      <rect x="0" y="0" width="470" height="360" rx="54" fill="#fff" opacity=".88" filter="url(#softShadow-${id})"/>
      ${label(54, 84, 'Beta selezionata', p[0], 42, 870)}
      ${label(54, 150, '20 studi', p[3], 70, 900)}
      ${label(54, 205, 'pilota', p[3], 42, 760, 0.76)}
      ${pill(54, 252, 'Italia-first', `url(#primary-${id})`, '#fff', 230)}
    </g>`,
};

function verticalScene(id, p, title, slot, type) {
  const icon =
    type === 'vertical-dental'
      ? `<path d="M245 190 C190 126 112 156 120 244 C128 348 190 430 226 384 C242 364 260 364 276 384 C312 430 374 348 382 244 C390 156 312 126 257 190" fill="url(#primary-${id})" opacity=".9"/>`
      : type === 'vertical-beauty'
        ? `<circle cx="250" cy="230" r="92" fill="url(#primary-${id})"/><rect x="150" y="332" width="200" height="42" rx="21" fill="${p[4]}" opacity=".8"/><circle cx="210" cy="222" r="12" fill="#fff"/><circle cx="290" cy="222" r="12" fill="#fff"/>`
        : type === 'vertical-fitness'
          ? `<rect x="110" y="300" width="300" height="62" rx="31" fill="url(#primary-${id})"/><circle cx="160" cy="250" r="44" fill="${p[4]}"/><path d="M210 252 C260 210 320 210 360 252" stroke="${p[0]}" stroke-width="22" fill="none" stroke-linecap="round"/>`
          : `<rect x="126" y="152" width="250" height="290" rx="30" fill="url(#primary-${id})"/><rect x="168" y="210" width="166" height="18" rx="9" fill="#fff" opacity=".8"/><rect x="168" y="268" width="130" height="18" rx="9" fill="#fff" opacity=".55"/><rect x="168" y="326" width="150" height="18" rx="9" fill="#fff" opacity=".55"/>`;
  return `
    <g transform="translate(120 120)">
      ${label(0, 70, title, p[3], 70, 880)}
      ${label(0, 126, 'richieste, vocali e appuntamenti', p[3], 38, 720, 0.68)}
      <rect x="0" y="220" width="560" height="520" rx="62" fill="#fff" opacity=".86" filter="url(#softShadow-${id})"/>
      ${icon}
      ${pill(80, 432, slot, p[0], '#fff', 310)}
    </g>
    ${phone(id, p, 980, 150, 0.78, `${bubble(30, 140, 294, 92, 'Avete posto oggi?', true)}${bubble(78, 266, 246, 116, 'Si, ti confermo ${slot}.', false, p[0])}${bubble(30, 430, 292, 86, 'Grazie!', true)}`)}
    <path d="M690 500 C790 410 860 390 970 420" stroke="url(#accent-${id})" stroke-width="10" fill="none" stroke-linecap="round"/>`;
}

function orbitNode(x, y, text, fill) {
  return `<g filter="url(#softShadow-a0)"><circle cx="${x}" cy="${y}" r="92" fill="#fff" opacity=".9"/><circle cx="${x}" cy="${y}" r="58" fill="${fill}" opacity=".88"/><text x="${x}" y="${y + 10}" text-anchor="middle" fill="#fff" font-size="34" font-weight="900">${esc(text)}</text></g>`;
}

function stepCard(x, y, num, title, text, p, id) {
  return `<g transform="translate(${x} ${y})">
    <rect x="0" y="0" width="330" height="300" rx="50" fill="#fff" opacity=".88" filter="url(#softShadow-${id})"/>
    <circle cx="72" cy="76" r="38" fill="url(#primary-${id})"/>
    <text x="72" y="88" text-anchor="middle" fill="#fff" font-size="34" font-weight="900">${num}</text>
    ${label(46, 154, title, p[3], 38, 850)}
    ${label(46, 206, text, p[3], 24, 700, 0.62)}
  </g>`;
}

function infraNode(x, y, text, fill) {
  return `<g transform="translate(${x} ${y})">
    <rect x="0" y="0" width="220" height="160" rx="42" fill="#fff" opacity=".9" filter="url(#softShadow-a0)"/>
    <circle cx="70" cy="80" r="36" fill="${fill}" opacity=".86"/>
    <text x="122" y="92" fill="#0f172a" font-size="30" font-weight="850">${esc(text)}</text>
  </g>`;
}

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(svgDir, { recursive: true });
  await fs.mkdir(pngDir, { recursive: true });
  await fs.mkdir(webpDir, { recursive: true });

  const manifest = [];
  const contactItems = [];

  for (const [index, asset] of assets.entries()) {
    const renderer = renderers[asset.composition];
    if (!renderer) throw new Error(`Missing renderer for ${asset.composition}`);

    const svg = base(asset, index, renderer);
    const basename = `${String(index + 1).padStart(2, '0')}-${asset.slug}`;
    const svgPath = path.join(svgDir, `${basename}.svg`);
    const pngPath = path.join(pngDir, `${basename}.png`);
    const webpPath = path.join(webpDir, `${basename}.webp`);

    await fs.writeFile(svgPath, svg, 'utf8');
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);
    await sharp(Buffer.from(svg)).webp({ quality: 88 }).toFile(webpPath);
    contactItems.push({ pngPath, title: asset.title, index: index + 1 });

    manifest.push({
      id: index + 1,
      slug: asset.slug,
      title: asset.title,
      recommendedUse: asset.use,
      alt: asset.alt,
      svg: `public/assets/site-images/ambrogio/svg/${basename}.svg`,
      png: `public/assets/site-images/ambrogio/png/${basename}.png`,
      webp: `public/assets/site-images/ambrogio/webp/${basename}.webp`,
      dimensions: { width: W, height: H, aspectRatio: '16:10' },
    });
  }

  await writeContactSheet(contactItems);
  await fs.writeFile(
    path.join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(path.join(outDir, 'README.md'), readme(manifest), 'utf8');
  console.log(`Generated ${manifest.length} Ambrogio site assets in ${outDir}`);
}

async function writeContactSheet(items) {
  const thumbW = 320;
  const thumbH = 200;
  const gap = 28;
  const labelH = 46;
  const cols = 5;
  const rows = Math.ceil(items.length / cols);
  const sheetW = cols * thumbW + (cols + 1) * gap;
  const sheetH = rows * (thumbH + labelH) + (rows + 1) * gap + 84;

  const composites = [];
  for (const [i, item] of items.entries()) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = gap + col * (thumbW + gap);
    const top = 92 + gap + row * (thumbH + labelH + gap);
    const image = await sharp(item.pngPath)
      .resize(thumbW, thumbH, { fit: 'cover' })
      .png()
      .toBuffer();
    const labelSvg = Buffer.from(`
      <svg width="${thumbW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${thumbW}" height="${labelH}" rx="14" fill="#ffffff" opacity=".92"/>
        <text x="18" y="30" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#0f172a">${String(item.index).padStart(2, '0')} ${esc(item.title)}</text>
      </svg>`);
    composites.push({ input: image, left, top });
    composites.push({ input: labelSvg, left, top: top + thumbH + 8 });
  }

  const header = Buffer.from(`
    <svg width="${sheetW}" height="92" xmlns="http://www.w3.org/2000/svg">
      <text x="28" y="56" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="900" fill="#0f172a">Ambrogio.ai site images</text>
      <text x="${sheetW - 380}" y="56" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#64748b">20 assets / SVG + PNG + WebP</text>
    </svg>`);

  const sheet = sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: '#f8fafc',
    },
  }).composite([{ input: header, left: 0, top: 0 }, ...composites]);

  await sheet.png({ compressionLevel: 9 }).toFile(path.join(outDir, 'contact-sheet.png'));
  await sheet.webp({ quality: 88 }).toFile(path.join(outDir, 'contact-sheet.webp'));
}

function readme(manifest) {
  return `# Ambrogio.ai Site Images

Fatto da Codex il 24 aprile 2026.

Cartella asset per Codex frontend. Ogni immagine e' disponibile in SVG, PNG e WebP, formato 1600x1000.

## Uso consigliato

- Hero/background: usare WebP.
- Componenti responsive e illustrazioni inline: usare SVG.
- Preview social, deck o export statici: usare PNG.
- Non usare queste immagini per claim legali assoluti. Per trust/privacy usare copy "DPA e privacy-first" o equivalente.
- Le immagini non includono loghi ufficiali di provider terzi, cosi' restano sicure per uso commerciale.
- Preview completa: \`public/assets/site-images/ambrogio/contact-sheet.webp\`

## Asset

${manifest
  .map(
    (item) => `### ${String(item.id).padStart(2, '0')} - ${item.title}

- Uso: ${item.recommendedUse}
- Alt: ${item.alt}
- SVG: \`${item.svg}\`
- WebP: \`${item.webp}\`
- PNG: \`${item.png}\`
`,
  )
  .join('\n')}
`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
