import { z } from 'zod';

const optionalUrl = z.string().url().optional().or(z.literal(''));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: optionalUrl.default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Ambrogio.ai'),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl.default(''),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  SUPABASE_DB_URL: z.string().optional().default(''),
  SUPABASE_MEDIA_BUCKET: z.string().default('ambrogio-media'),
  INTERNAL_JOB_SECRET: z.string().optional().default(''),
  INTERNAL_JOB_HEADER_NAME: z.string().default('x-ambrogio-job-secret'),
  /**
   * Segreto usato da Vercel Cron, che invoca i job in GET con
   * `Authorization: Bearer <CRON_SECRET>` e non può inviare header custom.
   * Se assente si ricade su INTERNAL_JOB_SECRET, così il self-hosting continua
   * a funzionare con una sola variabile configurata.
   */
  CRON_SECRET: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL_PRIMARY: z.string().optional().default(''),
  ANTHROPIC_MODEL_FAST: z.string().optional().default(''),
  AMBROGIO_AI_AUTOREPLY_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  AMBROGIO_VOICE_STT_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.55),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
  ELEVENLABS_API_KEY: z.string().optional().default(''),
  ELEVENLABS_STT_MODEL: z.enum(['scribe_v2', 'scribe_v1']).default('scribe_v2'),
  ELEVENLABS_TTS_MODEL: z.string().default('eleven_flash_v2_5'),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().default('JBFqnCBsd6RMkjVDRZzb'),
  ELEVENLABS_ENABLE_LOGGING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  WHATSAPP_API_KEY: z.string().optional().default(''),
  WHATSAPP_API_URL: optionalUrl.default('https://waba-v2.360dialog.io'),
  WHATSAPP_MEDIA_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(25 * 1024 * 1024),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(''),
  WHATSAPP_WEBHOOK_HEADER_NAME: z.string().default('x-ambrogio-webhook-secret'),
  WHATSAPP_WEBHOOK_HEADER_SECRET: z.string().optional().default(''),
  WHATSAPP_WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  WHATSAPP_WEBHOOK_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  /**
   * Senza RESEND_API_KEY il mailer ricade sul NoopEmailSender (logga, non spedisce):
   * un ambiente di sviluppo non deve rompersi per una email non configurata.
   */
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_EMAIL: z.string().default('Ambrogio.ai <hello@ambrogio.ai>'),
  RESEND_API_URL: optionalUrl.default('https://api.resend.com/emails'),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_OAUTH_AUTH_URL: optionalUrl.default('https://accounts.google.com/o/oauth2/v2/auth'),
  GOOGLE_OAUTH_TOKEN_URL: optionalUrl.default('https://oauth2.googleapis.com/token'),
  GOOGLE_OAUTH_REVOKE_URL: optionalUrl.default('https://oauth2.googleapis.com/revoke'),
  GOOGLE_OAUTH_STATE_SECRET: z.string().optional().default(''),
  GOOGLE_CALENDAR_REDIRECT_URI: optionalUrl.default(''),
  INTEGRATION_CREDENTIALS_ENCRYPTION_KEY: z.string().optional().default(''),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  STRIPE_PRICE_STARTER: z.string().optional().default(''),
  STRIPE_PRICE_PROFESSIONAL: z.string().optional().default(''),
  STRIPE_BILLING_PORTAL_RETURN_URL: optionalUrl.default(''),
  STRIPE_CHECKOUT_SUCCESS_URL: optionalUrl.default(''),
  STRIPE_CHECKOUT_CANCEL_URL: optionalUrl.default(''),
  STRIPE_BILLING_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  STRIPE_BILLING_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  UPSTASH_REDIS_REST_URL: optionalUrl.default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(''),
  FATTUREINCLOUD_API_TOKEN: z.string().optional().default(''),
  FATTUREINCLOUD_COMPANY_ID: z.string().optional().default(''),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Parses runtime configuration once and exposes typed environment values.
 *
 * @returns Typed application environment values.
 * @throws ZodError when a configured value has an invalid shape.
 */
export function parseEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(input);
}

export const env = parseEnv();
