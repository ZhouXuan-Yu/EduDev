import React from 'react';
import styles from './settings-components.module.css';

type HintVariant = 'default' | 'warn';
type Layout = 'inline' | 'stacked';

interface SettingsRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  hintVariant?: HintVariant;
  control: React.ReactNode;
  layout?: Layout;
  className?: string;
}

export function SettingsRow({
  label,
  hint,
  hintVariant = 'default',
  control,
  layout = 'inline',
  className,
  ...rootProps
}: SettingsRowProps) {
  const rootClass = [
    styles.row,
    layout === 'inline' ? styles.rowInline : styles.rowStacked,
    className,
  ].filter(Boolean).join(' ');

  const hintClass = [
    styles.rowHint,
    hintVariant === 'warn' && styles.rowHintWarn,
  ].filter(Boolean).join(' ');

  return (
    <div {...rootProps} className={rootClass+' edu-setting-row'}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel+' edu-setting-label'}>{label}</div>
        {hint && <div className={hintClass+' edu-setting-hint'}>{hint}</div>}
      </div>
      <div className={styles.rowControl}>{control}</div>
    </div>
  );
}
