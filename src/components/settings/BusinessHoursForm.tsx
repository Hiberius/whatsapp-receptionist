'use client';

import { useCallback, useState, type FormEvent } from 'react';

import { FormFeedback } from '@/components/forms/FormFeedback';
import { type ApiFormState } from '@/components/forms/useApiForm';

import {
  countHiddenRanges,
  saveBusinessHours,
  toDayDrafts,
  validateDayDrafts,
  weekdayLabel,
  type BusinessHourView,
  type DayDraft,
  type DayIssue,
} from './business-hours-model';

interface BusinessHoursFormProps {
  readonly hours: readonly BusinessHourView[];
  /** Solo owner e admin possono scrivere: l'API rifiuta gli altri con 403. */
  readonly canManage: boolean;
}

const IDLE: ApiFormState = { status: 'idle', message: null };

export function BusinessHoursForm({ hours, canManage }: BusinessHoursFormProps) {
  const [drafts, setDrafts] = useState<readonly DayDraft[]>(() => toDayDrafts(hours));
  const [issues, setIssues] = useState<readonly DayIssue[]>([]);
  const [state, setState] = useState<ApiFormState>(IDLE);

  const hiddenRanges = countHiddenRanges(hours);
  const isSubmitting = state.status === 'submitting';

  const updateDay = useCallback((weekday: number, patch: Partial<DayDraft>): void => {
    setDrafts((current) =>
      current.map((draft) => (draft.weekday === weekday ? { ...draft, ...patch } : draft)),
    );
  }, []);

  const copyFirstOpenDay = useCallback((): void => {
    setDrafts((current) => {
      const source = current.find(
        (draft) => draft.open && draft.opensAt !== '' && draft.closesAt !== '',
      );

      if (source === undefined) {
        return current;
      }

      return current.map((draft) =>
        draft.open ? { ...draft, opensAt: source.opensAt, closesAt: source.closesAt } : draft,
      );
    });
  }, []);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();

      const found = validateDayDrafts(drafts);
      setIssues(found);

      if (found.length > 0) {
        setState({
          status: 'error',
          message: 'Controlla i giorni segnalati qui sotto: gli orari non sono validi.',
        });
        return;
      }

      setState({ status: 'submitting', message: null });
      const result = await saveBusinessHours({ drafts });

      if (!result.ok) {
        setState({ status: 'error', message: result.message });
        return;
      }

      // Rileggiamo dalla risposta: il server normalizza e riordina le fasce,
      // quindi lo stato locale potrebbe non coincidere con quanto salvato.
      setDrafts(toDayDrafts(result.data));
      setState({
        status: 'success',
        message: 'Orari salvati. Ambrogio propone appuntamenti solo dentro queste fasce.',
      });
    },
    [drafts],
  );

  const openDays = drafts.filter((draft) => draft.open).length;

  return (
    <form onSubmit={onSubmit} className="stack stack-6" noValidate>
      <section className="card stack stack-4">
        <div className="stack stack-2">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Settimana tipo</h2>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Questi orari sono l&apos;unica fonte da cui Ambrogio calcola la disponibilità: un giorno
            marcato chiuso non verrà mai proposto, e nessun appuntamento verrà fissato fuori dalle
            fasce indicate.
          </p>
        </div>

        <FormFeedback state={state} id="business-hours-feedback" />

        {hiddenRanges > 0 ? (
          <p className="helper" role="note">
            Attenzione: sono salvate {hiddenRanges}{' '}
            {hiddenRanges === 1 ? 'fascia oraria aggiuntiva' : 'fasce orarie aggiuntive'} (per
            esempio una pausa pranzo che spezza la giornata). Questa schermata gestisce una sola
            fascia per giorno: salvando, le altre verranno rimosse.
          </p>
        ) : null}

        {issues.length > 0 ? (
          <ul className="stack stack-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {issues.map((issue) => (
              <li
                key={issue.weekday}
                className="helper"
                style={{ color: 'var(--color-danger)', fontWeight: 500 }}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="stack stack-3">
          {drafts.map((draft) => (
            <DayRow
              key={draft.weekday}
              draft={draft}
              disabled={!canManage || isSubmitting}
              onChange={updateDay}
            />
          ))}
        </div>
      </section>

      {canManage ? (
        <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvataggio…' : 'Salva orari'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={copyFirstOpenDay}
            disabled={isSubmitting || openDays < 2}
          >
            Copia il primo giorno aperto sugli altri
          </button>
        </div>
      ) : (
        <p className="helper">
          Solo il titolare dell&apos;account e gli amministratori possono modificare gli orari.
        </p>
      )}
    </form>
  );
}

function DayRow({
  draft,
  disabled,
  onChange,
}: {
  draft: DayDraft;
  disabled: boolean;
  onChange: (weekday: number, patch: Partial<DayDraft>) => void;
}) {
  const openId = `day-${draft.weekday}-open`;
  const opensId = `day-${draft.weekday}-opens`;
  const closesId = `day-${draft.weekday}-closes`;

  return (
    <fieldset
      className="row"
      style={{
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        border: 0,
        padding: 'var(--space-3) var(--space-4)',
        margin: 0,
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface-sunken)',
      }}
    >
      <legend className="sr-only">{weekdayLabel(draft.weekday)}</legend>

      <div className="row" style={{ gap: 'var(--space-3)', minWidth: '11rem' }}>
        <input
          id={openId}
          type="checkbox"
          checked={draft.open}
          disabled={disabled}
          onChange={(event) => onChange(draft.weekday, { open: event.target.checked })}
        />
        <label htmlFor={openId} className="label" style={{ margin: 0 }}>
          {weekdayLabel(draft.weekday)}
        </label>
      </div>

      {draft.open ? (
        <>
          <div className="field" style={{ minWidth: '9rem' }}>
            <label htmlFor={opensId} className="label">
              Apre
            </label>
            <input
              id={opensId}
              type="time"
              className="input"
              value={draft.opensAt}
              step={60}
              disabled={disabled}
              onChange={(event) => onChange(draft.weekday, { opensAt: event.target.value })}
            />
          </div>
          <div className="field" style={{ minWidth: '9rem' }}>
            <label htmlFor={closesId} className="label">
              Chiude
            </label>
            <input
              id={closesId}
              type="time"
              className="input"
              value={draft.closesAt}
              step={60}
              disabled={disabled}
              onChange={(event) => onChange(draft.weekday, { closesAt: event.target.value })}
            />
          </div>
        </>
      ) : (
        <span className="badge badge-neutral">Chiuso</span>
      )}
    </fieldset>
  );
}
