import { describe, expect, it } from 'vitest';

import {
  assertInternalJobAuth,
  type InternalJobAuthConfig,
} from '@/lib/security/internal-job-auth';

const CONFIG: InternalJobAuthConfig = {
  headerName: 'x-ambrogio-job-secret',
  headerSecret: 'header_secret_value',
  cronSecret: 'cron_secret_value',
};

describe('assertInternalJobAuth', () => {
  it('accetta lo scheduler Vercel, che invia Authorization: Bearer', () => {
    const headers = new Headers({ authorization: 'Bearer cron_secret_value' });

    expect(() => assertInternalJobAuth(headers, CONFIG)).not.toThrow();
  });

  it('accetta il trigger self-hosted con header custom', () => {
    const headers = new Headers({ 'x-ambrogio-job-secret': 'header_secret_value' });

    expect(() => assertInternalJobAuth(headers, CONFIG)).not.toThrow();
  });

  it('rifiuta una richiesta senza credenziali', () => {
    expect(() => assertInternalJobAuth(new Headers(), CONFIG)).toThrow(
      'Invalid internal job secret',
    );
  });

  it('rifiuta un bearer token errato', () => {
    const headers = new Headers({ authorization: 'Bearer wrong_value___' });

    expect(() => assertInternalJobAuth(headers, CONFIG)).toThrow('Invalid internal job secret');
  });

  it('rifiuta il segreto corretto presentato senza lo schema Bearer', () => {
    const headers = new Headers({ authorization: 'cron_secret_value' });

    expect(() => assertInternalJobAuth(headers, CONFIG)).toThrow('Invalid internal job secret');
  });

  it('non accetta il segreto cron sull_header custom e viceversa', () => {
    expect(() =>
      assertInternalJobAuth(new Headers({ 'x-ambrogio-job-secret': 'cron_secret_value' }), CONFIG),
    ).toThrow('Invalid internal job secret');

    expect(() =>
      assertInternalJobAuth(new Headers({ authorization: 'Bearer header_secret_value' }), CONFIG),
    ).toThrow('Invalid internal job secret');
  });

  it('ricade sul segreto header quando CRON_SECRET non è configurato', () => {
    const singleSecret: InternalJobAuthConfig = {
      headerName: 'x-ambrogio-job-secret',
      headerSecret: 'only_secret_value',
      cronSecret: 'only_secret_value',
    };

    expect(() =>
      assertInternalJobAuth(
        new Headers({ authorization: 'Bearer only_secret_value' }),
        singleSecret,
      ),
    ).not.toThrow();
  });

  it('fallisce in modo esplicito se nessun segreto è configurato', () => {
    const unconfigured: InternalJobAuthConfig = {
      headerName: 'x-ambrogio-job-secret',
      headerSecret: '',
      cronSecret: '',
    };

    expect(() => assertInternalJobAuth(new Headers(), unconfigured)).toThrow(
      'Internal job secret is not configured',
    );
  });
});
