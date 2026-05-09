import type { Metadata } from 'next';

import { CtaSection } from '@/components/marketing/CtaSection';
import { FeaturesSection } from '@/components/marketing/FeaturesSection';
import { HeroSection } from '@/components/marketing/HeroSection';
import { HowItWorksSection } from '@/components/marketing/HowItWorksSection';
import {
  JsonLd,
  organizationSchema,
  softwareApplicationSchema,
} from '@/components/marketing/JsonLd';
import { PricingTeaser } from '@/components/marketing/PricingTeaser';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { VerticalsSection } from '@/components/marketing/VerticalsSection';

export const metadata: Metadata = {
  title: 'AI Receptionist Italia per studi e PMI',
  description:
    'Reception AI sempre attiva su WhatsApp e voce: prenota appuntamenti, filtra urgenze e libera la segretaria. Setup in 24h, trial 14 giorni.',
  openGraph: {
    title: 'Ambrogio.ai — AI Receptionist Italia sempre attivo',
    description:
      'AI Receptionist su WhatsApp e voce per studi dentistici, centri estetici, palestre e studi professionali. Hosting EU, GDPR ready.',
    locale: 'it_IT',
    type: 'website',
    url: '/',
  },
  alternates: {
    canonical: '/',
  },
};

export default async function HomePage() {
  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareApplicationSchema} />
      <SiteHeader />
      <main id="main">
        <HeroSection />
        <FeaturesSection />
        <VerticalsSection />
        <HowItWorksSection />
        <PricingTeaser />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
