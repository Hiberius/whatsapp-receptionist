import { AppError } from '@/lib/errors/app-error';
import { requireAuthenticatedUser, type AuthenticatedUser } from '@/lib/auth/session';

/**
 * Super admin authorization guard. Used inside admin route handlers and pages.
 *
 * Super-admin status is set in Supabase JWT app_metadata.is_super_admin = true.
 * This is intentionally separate from the tenant role system because super admins
 * operate cross-tenant.
 */
export async function requireSuperAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();

  if (!isSuperAdmin(user)) {
    throw new AppError('forbidden', 'Super admin access required');
  }

  return user;
}

export function isSuperAdmin(user: AuthenticatedUser): boolean {
  return user.appMetadata['is_super_admin'] === true;
}
