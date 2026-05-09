import { describe, expect, it } from 'vitest';

import { assertStaticSecretHeader } from '@/lib/security/static-secret';

describe('assertStaticSecretHeader', () => {
  it('accepts matching static secrets', () => {
    const headers = new Headers({
      'x-ambrogio-job-secret': 'secret_123',
    });

    expect(() =>
      assertStaticSecretHeader({
        headers,
        headerName: 'x-ambrogio-job-secret',
        expectedSecret: 'secret_123',
        notConfiguredMessage: 'Secret missing',
      }),
    ).not.toThrow();
  });

  it('rejects missing or mismatched static secrets', () => {
    const headers = new Headers({
      'x-ambrogio-job-secret': 'wrong',
    });

    expect(() =>
      assertStaticSecretHeader({
        headers,
        headerName: 'x-ambrogio-job-secret',
        expectedSecret: 'secret_123',
        notConfiguredMessage: 'Secret missing',
      }),
    ).toThrow('Invalid internal job secret');
  });
});
