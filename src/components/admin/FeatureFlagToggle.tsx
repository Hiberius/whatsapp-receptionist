'use client';

import { type CSSProperties, type KeyboardEvent, useCallback, useState } from 'react';

interface FeatureFlagToggleProps {
  flagKey: string;
  description: string;
  initialEnabled: boolean;
}

/**
 * Toggle accessibile per feature flag admin.
 *
 * Implementato come <button role="switch"> per garantire:
 * - operabilità keyboard (Space/Enter) e mouse
 * - aria-checked sincronizzato con lo stato
 * - target size minimo 44x24px (rispetta WCAG 2.5.8)
 * - aria-label descrittivo per gli screen reader
 */
export function FeatureFlagToggle({
  flagKey,
  description,
  initialEnabled,
}: Readonly<FeatureFlagToggleProps>) {
  const [enabled, setEnabled] = useState<boolean>(initialEnabled);

  const handleToggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handleToggle();
      }
    },
    [handleToggle],
  );

  const accessibleLabel = `${enabled ? 'Disattiva' : 'Attiva'} feature flag ${flagKey}: ${description}`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={accessibleLabel}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      style={buttonStyle}
    >
      <span style={trackStyle(enabled)}>
        <span aria-hidden="true" style={thumbStyle(enabled)} />
      </span>
      <span aria-hidden="true" style={labelStyle(enabled)}>
        {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  padding: 'var(--space-1) var(--space-2)',
  minHeight: '44px',
  minWidth: '44px',
  borderRadius: 'var(--radius-sm)',
};

function trackStyle(enabled: boolean): CSSProperties {
  return {
    width: '40px',
    height: '22px',
    borderRadius: 'var(--radius-full)',
    background: enabled ? 'var(--color-accent)' : 'var(--color-border-strong)',
    position: 'relative',
    transition: 'background var(--duration-normal) var(--ease-out)',
    display: 'inline-block',
  };
}

function thumbStyle(enabled: boolean): CSSProperties {
  return {
    position: 'absolute',
    top: '2px',
    left: enabled ? '20px' : '2px',
    width: '18px',
    height: '18px',
    borderRadius: 'var(--radius-full)',
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'left var(--duration-normal) var(--ease-out)',
  };
}

function labelStyle(enabled: boolean): CSSProperties {
  return {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: enabled ? 'var(--color-accent)' : 'var(--color-text-muted)',
    minWidth: '24px',
  };
}
