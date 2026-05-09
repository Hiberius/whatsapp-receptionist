// Fatto da Claude Code l'8 maggio 2026.
//
// Contact form pubblico (POST /api/contact). Salva il submission in DB
// e notifica hello@ambrogio.ai. Niente sessione richiesta.
//
// Pattern: factory + DI (repository + notifier). Usato anche da
// onboarding/settings: il route layer parsa Zod e applica rate limit,
// mentre il service e' testabile con fake in-memory.

import { AppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type ContactTopic = 'sales' | 'support' | 'agency' | 'press' | 'other';

export type ContactSubmissionInput = {
  name: string;
  email: string;
  company: string | null;
  topic: ContactTopic;
  message: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export type ContactSubmissionResult = {
  submissionId: string;
};

export interface ContactSubmissionRepository {
  insert(input: ContactSubmissionInput): Promise<{ id: string }>;
}

export interface ContactNotifier {
  notify(input: { submissionId: string; submission: ContactSubmissionInput }): Promise<void>;
}

const NOTIFICATION_INBOX = 'hello@ambrogio.ai';

export class ContactSubmissionService {
  constructor(
    private readonly repository: ContactSubmissionRepository,
    private readonly notifier: ContactNotifier,
  ) {}

  async submit(input: ContactSubmissionInput): Promise<ContactSubmissionResult> {
    const normalized = normalizeContactInput(input);
    const inserted = await this.repository.insert(normalized);

    try {
      await this.notifier.notify({
        submissionId: inserted.id,
        submission: normalized,
      });
    } catch (error) {
      // Non blocchiamo la submission se la notifica fallisce: il record
      // e' gia' persistito e processabile da operatore.
      logger.warn(
        {
          submissionId: inserted.id,
          err: error,
        },
        'Contact submission notification failed',
      );
    }

    return { submissionId: inserted.id };
  }
}

export class SupabaseContactSubmissionRepository implements ContactSubmissionRepository {
  private readonly supabase = createSupabaseAdminClient();

  async insert(input: ContactSubmissionInput): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from('contact_submissions')
      .insert({
        name: input.name,
        email: input.email,
        company: input.company,
        topic: input.topic,
        message: input.message,
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new AppError('upstream_error', 'Failed to persist contact submission', {
        cause: error,
        expose: false,
      });
    }

    return { id: String(data.id) };
  }
}

/**
 * Stub notifier: logga la notifica strutturata. La vera integrazione
 * Resend/email verra' agganciata sostituendo questa implementazione
 * (factory `createContactSubmissionService`) senza toccare il route.
 */
export class StubContactNotifier implements ContactNotifier {
  async notify(input: { submissionId: string; submission: ContactSubmissionInput }): Promise<void> {
    // TODO Resend integration: spedire email a hello@ambrogio.ai con il
    // contenuto del submission. Per ora il record e' visibile al super-admin
    // tramite la tabella `contact_submissions`.
    logger.info(
      {
        inbox: NOTIFICATION_INBOX,
        submissionId: input.submissionId,
        topic: input.submission.topic,
      },
      'Contact submission ready for outbound notification (stub)',
    );
  }
}

export function createContactSubmissionService(): ContactSubmissionService {
  return new ContactSubmissionService(
    new SupabaseContactSubmissionRepository(),
    new StubContactNotifier(),
  );
}

function normalizeContactInput(input: ContactSubmissionInput): ContactSubmissionInput {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 120) {
    throw new AppError('bad_request', 'Name is required (max 120 chars)');
  }

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new AppError('bad_request', 'A valid email is required');
  }

  const message = input.message.trim();
  if (message.length === 0 || message.length > 5000) {
    throw new AppError('bad_request', 'Message is required (max 5000 chars)');
  }

  const company = normalizeNullable(input.company, 160);

  return {
    name,
    email,
    company,
    topic: input.topic,
    message,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  };
}

function normalizeNullable(value: string | null, maxLength: number): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new AppError('bad_request', 'Field exceeds max length');
  }

  return trimmed;
}
