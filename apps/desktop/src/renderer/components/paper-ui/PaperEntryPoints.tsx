import {useEffect, useState} from 'react';
import {Button, Input} from '@heroui/react';
import {Check, X} from 'lucide-react';
import styles from '../../ui-system/paper-studio/paper-editor.module.css';
export function PaperEntryPoints({points, disabled, onSave, onDirty, compact = false, label = '本题分值'}: {
  points: number;
  disabled: boolean;
  onSave: (points: number) => Promise<boolean>;
  onDirty: (dirty: boolean) => void;
  compact?: boolean;
  label?: string;
}) {
  const [value, setValue] = useState(String(points));
  useEffect(() => {setValue(String(points)); onDirty(false);}, [points]);
  const number = Number(value);
  const valid = Number.isSafeInteger(number) && number >= 1 && number <= 1000;
  return <form className={compact ? styles.scoreForm : 'edu-paper-actions'} data-testid="paper-entry-points-form"
    onSubmit={event => {event.preventDefault(); if (!disabled && valid && number !== points) void onSave(number);}}>
    <label>{label}<Input fullWidth={compact} data-testid="paper-entry-points" type="number" min={1} max={1000}
      value={value} disabled={disabled} onChange={event => {setValue(event.target.value); onDirty(Number(event.target.value) !== points);}}/></label>
    <Button variant="secondary" type="submit" isIconOnly={compact} size={compact ? 'sm' : 'md'}
      aria-label={compact ? `保存${label}分值` : undefined} data-testid="paper-entry-points-save"
      isDisabled={disabled || !valid || number === points}>{compact ? <Check size={14}/> : '保存分值'}</Button>
    {number !== points && <Button variant="ghost" type="button" isIconOnly={compact} size={compact ? 'sm' : 'md'}
      aria-label={compact ? `放弃${label}分值修改` : undefined} data-testid="paper-entry-points-discard" isDisabled={disabled}
      onPress={() => {setValue(String(points)); onDirty(false);}}>{compact ? <X size={14}/> : '放弃分值修改'}</Button>}
    {!compact && <span>只修改本卷，总分相应更新。</span>}
  </form>;
}
