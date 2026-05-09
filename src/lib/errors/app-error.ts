export type AppErrorCode =
  | 'bad_request'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'upstream_error'
  | 'webhook_rejected'
  | 'internal';

const statusByCode: Record<AppErrorCode, number> = {
  bad_request: 400,
  conflict: 409,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  upstream_error: 502,
  webhook_rejected: 401,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly expose: boolean;
  /**
   * Secondi prima del prossimo tentativo consentito.
   * Valorizzato solo per errori `rate_limited` (mappato a header `Retry-After`).
   */
  readonly retryAfter: number | null;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { cause?: unknown; expose?: boolean; retryAfter?: number } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = statusByCode[code];
    this.expose = options.expose ?? this.status < 500;
    this.retryAfter =
      typeof options.retryAfter === 'number' && Number.isFinite(options.retryAfter)
        ? Math.max(0, Math.ceil(options.retryAfter))
        : null;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isZodErrorLike(error)) {
    return new AppError('bad_request', 'Invalid request payload', {
      cause: error,
      expose: true,
    });
  }

  return new AppError('internal', 'Unexpected internal error', {
    cause: error,
    expose: false,
  });
}

function isZodErrorLike(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'ZodError'
  );
}
