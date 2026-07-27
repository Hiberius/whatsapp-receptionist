import { redirect } from 'next/navigation';

import {
  requireAuthenticatedUser,
  requireSession,
  type AuthenticatedUser,
  type AuthSession,
} from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/super-admin';

/**
 * Guard pensati per Server Component (layout e pagine).
 *
 * `requireSession` e `requireSuperAdmin` lanciano `AppError`: è il
 * comportamento corretto per un route handler, che lo traduce in 401/403 JSON.
 * In una pagina, però, un throw finisce sul boundary `error.tsx` e mostra una
 * schermata di errore a chi semplicemente non ha ancora fatto login. Qui
 * l'esito giusto è un redirect.
 *
 * Nota: `redirect()` funziona lanciando `NEXT_REDIRECT`, quindi va invocata
 * fuori dal `try` — dentro un `catch` generico verrebbe intercettata da sé
 * stessa e il redirect non avverrebbe.
 */
export async function requireSessionOrRedirect(): Promise<AuthSession> {
  try {
    return await requireSession();
  } catch {
    // Non distinguiamo "non autenticato" da "claim tenant assente": in
    // entrambi i casi la sessione non è utilizzabile e il rimedio è il login.
    redirect('/login');
  }
}

export async function requireSuperAdminOrRedirect(): Promise<AuthenticatedUser> {
  let user: AuthenticatedUser;

  try {
    user = await requireAuthenticatedUser();
  } catch {
    redirect('/login');
  }

  if (!isSuperAdmin(user)) {
    // Chi è autenticato ma non è super-admin non deve nemmeno sapere che il
    // pannello esiste: lo rimandiamo alla sua dashboard, non a una pagina 403.
    redirect('/dashboard');
  }

  return user;
}
