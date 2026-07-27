'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { FormFeedback } from '@/components/forms/FormFeedback';
import { useApiForm, type ApiFormState } from '@/components/forms/useApiForm';

const ENDPOINT = '/api/settings/integrations/whatsapp';

/**
 * Proiezione client dello stato di connessione.
 *
 * È dichiarata qui e non importata da `@/server/whatsapp/provisioning` perché
 * quel modulo istanzia il client Supabase con la service role key: anche un
 * import di solo tipo lo espone al grafo del bundle client. I campi sono gli
 * stessi di `WhatsAppConnectionStatus`, quindi il Server Component può passare
 * il risultato del servizio senza adattarlo.
 */
export interface WhatsAppConnectionView {
  readonly connected: boolean;
  readonly phoneNumberId: string | null;
  readonly displayPhoneNumber: string | null;
  readonly status: string | null;
  readonly hasApiKey: boolean;
  readonly connectedAt: string | null;
}

interface WhatsAppConnectionFormProps {
  readonly status: WhatsAppConnectionView;
  /** Solo owner e admin possono scrivere: l'API rifiuta gli altri con 403. */
  readonly canManage: boolean;
}

const IDLE: ApiFormState = { status: 'idle', message: null };

export function WhatsAppConnectionForm({ status, canManage }: WhatsAppConnectionFormProps) {
  const router = useRouter();
  const isConnected = status.connected;

  const { state, onSubmit } = useApiForm({
    endpoint: ENDPOINT,
    successMessage: isConnected
      ? 'Numero aggiornato. Ambrogio risponde su questo canale.'
      : 'Numero collegato. Ambrogio risponde su questo canale.',
    buildBody: (formData) => ({
      phoneNumberId: String(formData.get('phoneNumberId') ?? ''),
      displayPhoneNumber: String(formData.get('displayPhoneNumber') ?? ''),
      apiKey: String(formData.get('apiKey') ?? ''),
    }),
  });

  const [disconnectState, setDisconnectState] = useState<ApiFormState>(IDLE);
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);

  // Lo stato mostrato qui è letto lato server: dopo una scrittura riuscita va
  // riletto, altrimenti la scheda continua a descrivere la situazione di prima.
  const shouldRefresh = state.status === 'success' || disconnectState.status === 'success';
  useEffect(() => {
    if (shouldRefresh) {
      router.refresh();
    }
  }, [shouldRefresh, router]);

  const onDisconnect = useCallback(async (): Promise<void> => {
    setDisconnectState({ status: 'submitting', message: null });

    let response: Response;
    try {
      response = await fetch(ENDPOINT, { method: 'DELETE' });
    } catch {
      setDisconnectState({
        status: 'error',
        message: 'Connessione non riuscita. Controlla la rete e riprova.',
      });
      return;
    }

    if (!response.ok) {
      setDisconnectState({ status: 'error', message: await readErrorMessage(response) });
      return;
    }

    setIsConfirmingDisconnect(false);
    setDisconnectState({
      status: 'success',
      message: 'Numero scollegato. I messaggi in arrivo non verranno più gestiti.',
    });
  }, []);

  const isSubmitting = state.status === 'submitting';
  const isDisconnecting = disconnectState.status === 'submitting';

  return (
    <div className="stack stack-6">
      <section className="card stack stack-4">
        <div className="row-between" style={{ gap: 'var(--space-4)' }}>
          <div className="stack stack-2">
            <span className="eyebrow">Stato del canale</span>
            <h2 style={{ fontSize: 'var(--text-xl)' }}>
              {isConnected ? 'Numero collegato' : 'Nessun numero collegato'}
            </h2>
          </div>
          <span className={isConnected ? 'badge badge-success' : 'badge badge-neutral'}>
            {statusLabel(status)}
          </span>
        </div>

        {isConnected ? (
          <dl className="stack stack-3" style={{ margin: 0 }}>
            <DetailRow
              label="Numero visualizzato"
              value={status.displayPhoneNumber ?? 'Non impostato'}
              isMono={status.displayPhoneNumber !== null}
            />
            <DetailRow label="Phone number ID" value={status.phoneNumberId ?? '—'} isMono />
            <DetailRow
              label="API key"
              value={status.hasApiKey ? 'Salvata e cifrata' : 'Mancante: il canale non può inviare'}
            />
            <DetailRow label="Integrazione creata il" value={formatDate(status.connectedAt)} />
          </dl>
        ) : (
          <div className="stack stack-3">
            <p className="muted">
              Finché il numero non è collegato, i messaggi che arrivano su WhatsApp non vengono
              associati al tuo studio e Ambrogio non risponde. Compila il modulo qui sotto con i
              dati del pannello 360dialog: bastano trenta secondi e il canale è attivo.
            </p>
            {status.status !== null && status.status !== 'active' ? (
              <p className="helper">
                Esiste una configurazione precedente in stato «{status.status}». Salvando i nuovi
                dati verrà riattivata.
              </p>
            ) : null}
          </div>
        )}

        <FormFeedback state={disconnectState} id="whatsapp-disconnect-feedback" />

        {isConnected && canManage ? (
          <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {isConfirmingDisconnect ? (
              <>
                <span className="helper" style={{ alignSelf: 'center' }}>
                  Confermi? Ambrogio smette di rispondere su questo numero.
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? 'Scollegamento…' : 'Sì, scollega'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsConfirmingDisconnect(false)}
                  disabled={isDisconnecting}
                >
                  Annulla
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsConfirmingDisconnect(true)}
              >
                Scollega numero
              </button>
            )}
          </div>
        ) : null}
      </section>

      {canManage ? (
        <form onSubmit={onSubmit} className="card stack stack-6" noValidate>
          <div className="stack stack-2">
            <h2 style={{ fontSize: 'var(--text-xl)' }}>
              {isConnected ? 'Aggiorna la connessione' : 'Collega il numero'}
            </h2>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              I dati arrivano dal Client Hub di 360dialog, il provider che ospita il tuo numero
              WhatsApp Business.
            </p>
          </div>

          <FormFeedback state={state} id="whatsapp-connect-feedback" />

          <div className="field">
            <label htmlFor="phoneNumberId" className="label">
              Phone number ID
            </label>
            <input
              id="phoneNumberId"
              name="phoneNumberId"
              type="text"
              required
              maxLength={120}
              autoComplete="off"
              className="input"
              defaultValue={status.phoneNumberId ?? ''}
              placeholder="es. 109876543210987"
              aria-describedby="phoneNumberId-help"
              disabled={isSubmitting}
            />
            <p id="phoneNumberId-help" className="helper">
              In hub.360dialog.com apri il canale WhatsApp: il Phone number ID è nella scheda del
              numero, accanto al nome del canale. È l&apos;identificativo con cui riconosciamo a
              quale studio appartiene ogni messaggio in arrivo.
            </p>
          </div>

          <div className="field">
            <label htmlFor="displayPhoneNumber" className="label">
              Numero in formato leggibile
            </label>
            <input
              id="displayPhoneNumber"
              name="displayPhoneNumber"
              type="tel"
              maxLength={40}
              autoComplete="off"
              className="input"
              defaultValue={status.displayPhoneNumber ?? ''}
              placeholder="+39 02 1234567"
              aria-describedby="displayPhoneNumber-help"
              disabled={isSubmitting}
            />
            <p id="displayPhoneNumber-help" className="helper">
              Facoltativo. Serve solo a te per riconoscere il numero nelle schermate.
            </p>
          </div>

          <div className="field">
            <label htmlFor="apiKey" className="label">
              API key 360dialog
            </label>
            <input
              id="apiKey"
              name="apiKey"
              type="password"
              required
              minLength={8}
              maxLength={512}
              autoComplete="off"
              spellCheck={false}
              className="input"
              placeholder={isConnected ? 'Reinserisci la chiave per salvare' : 'Incolla la chiave'}
              aria-describedby="apiKey-help"
              disabled={isSubmitting}
            />
            <p id="apiKey-help" className="helper">
              Nel Client Hub, sezione API key del canale: la chiave viene mostrata una sola volta
              alla generazione, quindi se non ce l&apos;hai più ne generi una nuova. La salviamo
              cifrata e non la mostriamo mai più, nemmeno mascherata: per ogni modifica va
              reinserita.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ alignSelf: 'flex-start' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvataggio…' : isConnected ? 'Salva modifiche' : 'Collega numero'}
          </button>
        </form>
      ) : (
        <p className="helper">
          Solo il titolare dell&apos;account e gli amministratori possono modificare questa
          integrazione. Chiedi a chi gestisce lo studio di collegare il numero.
        </p>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  isMono = false,
}: {
  label: string;
  value: string;
  isMono?: boolean;
}) {
  return (
    <div className="row-between" style={{ gap: 'var(--space-4)', alignItems: 'baseline' }}>
      <dt className="muted" style={{ fontSize: 'var(--text-sm)' }}>
        {label}
      </dt>
      <dd
        className={isMono ? 'mono' : undefined}
        style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500, textAlign: 'right' }}
      >
        {value}
      </dd>
    </div>
  );
}

function statusLabel(status: WhatsAppConnectionView): string {
  if (status.connected) {
    return 'Attivo';
  }

  if (status.status === 'revoked') {
    return 'Scollegato';
  }

  return status.status === null ? 'Non configurato' : status.status;
}

function formatDate(value: string | null): string {
  if (value === null) {
    return 'Non disponibile';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Non disponibile';
  }

  return parsed.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** L'envelope d'errore di `jsonHandler` è `{ ok: false, error: { code, message } }`. */
async function readErrorMessage(response: Response): Promise<string> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const code = readErrorField(payload, 'code');

  if (code === 'forbidden') {
    return 'Non hai i permessi per modificare questa integrazione.';
  }

  if (code === 'rate_limited') {
    return 'Troppi tentativi ravvicinati. Riprova tra qualche minuto.';
  }

  if (code === 'unauthorized') {
    return 'Sessione non valida. Effettua di nuovo l’accesso.';
  }

  const exposed = readErrorField(payload, 'message');
  if (exposed !== null && exposed !== 'Internal server error') {
    return exposed;
  }

  return 'Non siamo riusciti a scollegare il numero. Riprova tra poco.';
}

function readErrorField(payload: unknown, field: 'code' | 'message'): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : null;
}
