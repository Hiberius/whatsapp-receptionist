import { describe, expect, it } from 'vitest';

import {
  bookingConfirmationEmail,
  gdprExportReadyEmail,
  invoiceReadyEmail,
  magicLinkEmail,
  welcomeEmail,
} from '@/server/notifications/email-templates';

describe('Email templates', () => {
  describe('magicLinkEmail', () => {
    it('returns subject + text + html with link', () => {
      const result = magicLinkEmail({
        email: 'mario@studio.it',
        link: 'https://ambrogio.ai/auth/callback?token=xyz',
        expiresInMinutes: 10,
      });

      expect(result.subject).toContain('link');
      expect(result.text).toContain('https://ambrogio.ai/auth/callback?token=xyz');
      expect(result.text).toContain('10 minuti');
      expect(result.html).toContain('Accedi ad Ambrogio.ai');
      expect(result.html).toContain('href="https://ambrogio.ai/auth/callback?token=xyz"');
    });
  });

  describe('welcomeEmail', () => {
    it('personalizza con businessName', () => {
      const result = welcomeEmail({
        email: 'info@studio.it',
        businessName: 'Studio Dentistico Rossi',
        onboardingUrl: 'https://ambrogio.ai/onboarding',
      });

      expect(result.subject).toContain('Studio Dentistico Rossi');
      expect(result.text).toContain('Studio Dentistico Rossi');
      expect(result.html).toContain('Studio Dentistico Rossi');
      expect(result.html).toContain('Continua il setup');
    });
  });

  describe('bookingConfirmationEmail', () => {
    it('formatta data e orario nel subject', () => {
      const result = bookingConfirmationEmail({
        customerName: 'Anna Rossi',
        serviceName: 'Igiene dentale',
        appointmentDate: 'lunedì 12 maggio',
        appointmentTime: '14:00',
        studioName: 'Studio Bianchi',
        studioAddress: 'Via Roma 1, Milano',
      });

      expect(result.subject).toContain('12 maggio');
      expect(result.subject).toContain('14:00');
      expect(result.text).toContain('Anna Rossi');
      expect(result.text).toContain('Igiene dentale');
      expect(result.html).toContain('Anna Rossi');
    });
  });

  describe('invoiceReadyEmail', () => {
    it('include numero fattura e PDF link', () => {
      const result = invoiceReadyEmail({
        invoiceNumber: 'FE/2026/00012',
        amount: '€297,00',
        pdfUrl: 'https://fic.example/12345.pdf',
        customerName: 'Studio Demo',
        period: 'Maggio 2026',
      });

      expect(result.subject).toContain('FE/2026/00012');
      expect(result.text).toContain('https://fic.example/12345.pdf');
      expect(result.text).toContain('€297,00');
      expect(result.html).toContain('SDI');
    });
  });

  describe('gdprExportReadyEmail', () => {
    it('comunica scadenza link', () => {
      const result = gdprExportReadyEmail({
        customerEmail: 'user@example.com',
        downloadUrl: 'https://ambrogio.ai/exports/abc123',
        expiresInHours: 24,
      });

      expect(result.subject).toContain('GDPR');
      expect(result.text).toContain('24 ore');
      expect(result.html).toContain('Art. 15 GDPR');
      expect(result.html).toContain('https://ambrogio.ai/exports/abc123');
    });
  });

  describe('all templates', () => {
    it('non lasciano placeholder unrendered', () => {
      const samples = [
        magicLinkEmail({ email: 'a@b.c', link: 'https://x', expiresInMinutes: 5 }),
        welcomeEmail({ email: 'a@b.c', businessName: 'Studio X', onboardingUrl: 'https://x' }),
        bookingConfirmationEmail({
          customerName: 'X',
          serviceName: 'Y',
          appointmentDate: 'oggi',
          appointmentTime: '12:00',
          studioName: 'Z',
          studioAddress: 'W',
        }),
        invoiceReadyEmail({
          invoiceNumber: 'X',
          amount: 'Y',
          pdfUrl: 'https://x',
          customerName: 'Z',
          period: 'W',
        }),
        gdprExportReadyEmail({
          customerEmail: 'a@b.c',
          downloadUrl: 'https://x',
          expiresInHours: 24,
        }),
      ];

      for (const sample of samples) {
        expect(sample.text).not.toContain('${');
        expect(sample.text).not.toContain('undefined');
        expect(sample.html).not.toContain('${');
        expect(sample.html).not.toContain('undefined');
      }
    });

    it('usa palette brand', () => {
      const sample = magicLinkEmail({
        email: 'a@b.c',
        link: 'https://x',
        expiresInMinutes: 5,
      });
      expect(sample.html).toContain('#0d766e');
    });
  });
});
