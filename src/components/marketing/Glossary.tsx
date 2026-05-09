import { buildDefinedTermSetSchema, JsonLd } from '@/components/marketing/JsonLd';
import { GLOSSARY_TERMS } from '@/lib/schema/glossary-terms';

interface GlossaryProps {
  /** URL canonico della pagina che ospita il glossario (default `/help`). */
  readonly hostUrl?: string;
}

/**
 * Inietta un glossario semantico (`DefinedTermSet`) come JSON-LD per
 * AI/LLM/answer engines. Non rende UI: questo componente è puramente structured
 * data ed è stato pensato per essere montato su /help (server-rendered).
 */
export async function Glossary({ hostUrl = '/help' }: Readonly<GlossaryProps>) {
  const schema = buildDefinedTermSetSchema({
    name: 'Glossario Ambrogio.ai',
    description:
      'Definizioni canoniche dei concetti di dominio rilevanti per AI Receptionist, WhatsApp Cloud API, multi-tenant SaaS, GDPR e fatturazione elettronica italiana.',
    url: hostUrl,
    terms: GLOSSARY_TERMS.map((t) => ({
      name: t.name,
      description: t.description,
      ...(t.termCode ? { termCode: t.termCode } : {}),
    })),
  });

  return <JsonLd data={schema} />;
}
