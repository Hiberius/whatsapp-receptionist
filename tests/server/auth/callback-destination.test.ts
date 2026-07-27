/**
 * La destinazione post-login arriva dalla query string, quindi è input non
 * fidato. Senza validazione `/auth/callback?next=https://sito-malevolo`
 * sarebbe un open redirect particolarmente efficace per il phishing: la
 * vittima viene portata fuori dominio subito dopo un login legittimo, con la
 * fiducia costruita da un flusso appena riuscito.
 */

import { describe, expect, it } from 'vitest';

import { safeDestination } from '@/lib/auth/safe-destination';

describe('safeDestination', () => {
  it('accetta un path relativo', () => {
    expect(safeDestination('/onboarding')).toBe('/onboarding');
    expect(safeDestination('/dashboard/settings?tab=whatsapp')).toBe(
      '/dashboard/settings?tab=whatsapp',
    );
  });

  it('rifiuta un URL assoluto verso un altro host', () => {
    expect(safeDestination('https://sito-malevolo.example')).toBe('/dashboard');
    expect(safeDestination('http://sito-malevolo.example/login')).toBe('/dashboard');
  });

  it('rifiuta lo schema protocol-relative //host, che il browser tratta come assoluto', () => {
    expect(safeDestination('//sito-malevolo.example')).toBe('/dashboard');
  });

  it('rifiuta i backslash, che alcuni browser normalizzano in slash', () => {
    expect(safeDestination('/\\sito-malevolo.example')).toBe('/dashboard');
    expect(safeDestination('\\\\sito-malevolo.example')).toBe('/dashboard');
  });

  it('rifiuta gli schemi non http', () => {
    expect(safeDestination('javascript:alert(1)')).toBe('/dashboard');
    expect(safeDestination('data:text/html,<script>')).toBe('/dashboard');
  });

  it('ricade sulla destinazione di default quando next è assente o vuoto', () => {
    expect(safeDestination(null)).toBe('/dashboard');
    expect(safeDestination('')).toBe('/dashboard');
  });
});
