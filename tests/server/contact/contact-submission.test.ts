// Fatto da Claude Code l'8 maggio 2026.
// Test del servizio ContactSubmissionService (logica indipendente dal route).

import { describe, expect, it } from 'vitest';

import {
  type ContactNotifier,
  type ContactSubmissionInput,
  type ContactSubmissionRepository,
  ContactSubmissionService,
} from '@/server/contact/contact-submission';

describe('ContactSubmissionService', () => {
  it('persists submission and notifies', async () => {
    const repository = new FakeRepo();
    const notifier = new FakeNotifier();
    const service = new ContactSubmissionService(repository, notifier);

    const result = await service.submit(submission());

    expect(result.submissionId).toBe('sub_001');
    expect(repository.calls).toHaveLength(1);
    expect(repository.calls[0]).toMatchObject({
      name: 'Mario Rossi',
      email: 'mario@example.it',
      topic: 'sales',
    });
    expect(notifier.notifications).toEqual([expect.objectContaining({ submissionId: 'sub_001' })]);
  });

  it('lowercases email and trims whitespace', async () => {
    const repository = new FakeRepo();
    const service = new ContactSubmissionService(repository, new FakeNotifier());

    await service.submit(submission({ email: '  Mario@Example.IT  ', name: '  Mario  ' }));

    expect(repository.calls[0]?.email).toBe('mario@example.it');
    expect(repository.calls[0]?.name).toBe('Mario');
  });

  it('rejects invalid email format', async () => {
    const service = new ContactSubmissionService(new FakeRepo(), new FakeNotifier());

    await expect(service.submit(submission({ email: 'not-an-email' }))).rejects.toMatchObject({
      code: 'bad_request',
    });
  });

  it('does not propagate notifier errors (record stays persisted)', async () => {
    const repository = new FakeRepo();
    const notifier = new FakeNotifier({ shouldThrow: true });
    const service = new ContactSubmissionService(repository, notifier);

    const result = await service.submit(submission());

    expect(result.submissionId).toBe('sub_001');
    expect(repository.calls).toHaveLength(1);
  });
});

class FakeRepo implements ContactSubmissionRepository {
  readonly calls: ContactSubmissionInput[] = [];

  async insert(input: ContactSubmissionInput): Promise<{ id: string }> {
    this.calls.push(input);
    return { id: 'sub_001' };
  }
}

class FakeNotifier implements ContactNotifier {
  readonly notifications: Array<{ submissionId: string }> = [];

  constructor(private readonly options: { shouldThrow?: boolean } = {}) {}

  async notify(input: { submissionId: string }): Promise<void> {
    if (this.options.shouldThrow) {
      throw new Error('SMTP down');
    }
    this.notifications.push({ submissionId: input.submissionId });
  }
}

function submission(overrides: Partial<ContactSubmissionInput> = {}): ContactSubmissionInput {
  return {
    name: 'Mario Rossi',
    email: 'mario@example.it',
    company: 'Studio Rossi',
    topic: 'sales',
    message: 'Sono interessato alla demo.',
    ipAddress: '203.0.113.10',
    userAgent: 'Vitest',
    ...overrides,
  };
}
