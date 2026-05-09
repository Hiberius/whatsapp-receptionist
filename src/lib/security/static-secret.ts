import { timingSafeEqual } from 'node:crypto';

import { AppError } from '@/lib/errors/app-error';

export function assertStaticSecretHeader(input: {
  headers: Headers;
  headerName: string;
  expectedSecret: string;
  notConfiguredMessage: string;
}): void {
  if (!input.expectedSecret) {
    throw new AppError('internal', input.notConfiguredMessage, {
      expose: false,
    });
  }

  const receivedSecret = input.headers.get(input.headerName.toLowerCase());

  if (!receivedSecret || !safeEqual(receivedSecret, input.expectedSecret)) {
    throw new AppError('forbidden', 'Invalid internal job secret');
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
