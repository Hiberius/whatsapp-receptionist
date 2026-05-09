import { createClient } from '@supabase/supabase-js';

import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';

export function createSupabaseAdminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError('internal', 'Supabase admin credentials are not configured', {
      expose: false,
    });
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
