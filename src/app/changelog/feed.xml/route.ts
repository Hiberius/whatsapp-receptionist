import { NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ambrogio.ai';

interface RssEntry {
  date: string;
  isoDate: string;
  title: string;
  body: string;
  category: string;
}

const ENTRIES: RssEntry[] = [
  {
    date: '8 maggio 2026',
    isoDate: 'Thu, 08 May 2026 10:00:00 +0200',
    title: 'Lancio beta privata · v0.1.0',
    body: 'Ambrogio.ai entra in beta privata. WhatsApp + voice + Google Calendar + Stripe billing + fatturazione SDI elettronica.',
    category: 'Nuovo',
  },
  {
    date: '5 maggio 2026',
    isoDate: 'Mon, 05 May 2026 10:00:00 +0200',
    title: 'CSP nonce-based + GDPR Art.15/17',
    body: 'Hardening completo: CSP per-request nonce, COEP/COOP/CORP, endpoint export e delete dati GDPR, rate limiting Upstash su tutti gli endpoint sensibili.',
    category: 'Sicurezza',
  },
  {
    date: '2 maggio 2026',
    isoDate: 'Fri, 02 May 2026 10:00:00 +0200',
    title: 'TypeScript strict + exactOptionalPropertyTypes',
    body: 'Tooling DX: ESLint 9 + Prettier + Husky pre-commit, Stripe webhook con discriminant guards type-safe.',
    category: 'Miglioria',
  },
  {
    date: '27 aprile 2026',
    isoDate: 'Mon, 27 Apr 2026 10:00:00 +0200',
    title: 'AI booking extractor v1',
    body: 'Estrazione strutturata di intent, servizio, data/ora, urgenza dalle conversazioni WhatsApp. Eval set deterministico.',
    category: 'Nuovo',
  },
  {
    date: '24 aprile 2026',
    isoDate: 'Fri, 24 Apr 2026 10:00:00 +0200',
    title: 'Backend MVP scaffolding',
    body: 'Setup iniziale Next 15 + Supabase con RLS, auth multi-tenant, webhook Stripe e WhatsApp con signature verification.',
    category: 'Nuovo',
  },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function GET(): NextResponse {
  const items = ENTRIES.map(
    (entry) => `
  <item>
    <title>${escapeXml(entry.title)}</title>
    <link>${SITE_URL}/changelog</link>
    <guid isPermaLink="false">${SITE_URL}/changelog#${escapeXml(entry.isoDate)}</guid>
    <pubDate>${entry.isoDate}</pubDate>
    <category>${escapeXml(entry.category)}</category>
    <description>${escapeXml(entry.body)}</description>
  </item>`,
  ).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Ambrogio.ai Changelog</title>
    <link>${SITE_URL}/changelog</link>
    <description>Aggiornamenti, nuove funzionalità e fix di Ambrogio.ai.</description>
    <language>it</language>
    <atom:link href="${SITE_URL}/changelog/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>Thu, 08 May 2026 10:00:00 +0200</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
