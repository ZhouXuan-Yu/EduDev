import { useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { AppSelect, type AppSelectOption } from '../ui/AppSelect';
import { SettingsRow } from './hana-settings/SettingsRow';
import type { ConfigWindowCommit } from '../../../shared/xiaozhi-config-window';
import type { OrdinaryField } from '../../../shared/xiaozhi-ordinary-config';
import { XIAOZHI_SETTINGS_ERRORS } from '../../../shared/xiaozhi-settings';
import styles from '../../ui-system/config-window.module.css';

type Draft = { value: string; baseVersion: number };

export function PiConfigDraftRow({ field, label, value, version, options, disabled, onReload }: {
  field: OrdinaryField;
  label: string;
  value: string | null;
  version: number;
  options: AppSelectOption[];
  disabled: boolean;
  onReload: () => Promise<void>;
}) {
  const saved = value ?? '';
  const [draft, setDraft] = useState<Draft>();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const pending = useRef<ConfigWindowCommit | undefined>(undefined);
  const submitting = useRef(false);
  const selected = draft?.value ?? saved;
  const conflict = draft !== undefined && draft.baseVersion !== version;
  const available = options.some(option => option.id === selected && !option.disabled);
  const selection = available || options.some(option => option.id === selected)
    ? options : [...options, { id: selected, label: selected, disabled: true }];
  const describe = (choice: string) => selection.find(option => option.id === choice)?.label ?? choice;

  function edit(next: string) {
    pending.current = undefined;
    setDraft(current => next === saved && !conflict
      ? undefined : { value: next, baseVersion: current?.baseVersion ?? version });
    setFeedback('');
  }

  async function save() {
    if (!draft || submitting.current || disabled || !available || (conflict && !pending.current)) return;
    const input = pending.current ?? {
      field, value: draft.value || null, expectedVersion: draft.baseVersion, operationId: crypto.randomUUID(),
    };
    pending.current = input;
    submitting.current = true;
    setBusy(true);
    setFeedback('');
    try {
      const result = await window.xiaozhiConfigWindow?.commit(input);
      if (result?.ok) {
        pending.current = undefined;
        await onReload();
        setDraft(undefined);
        setFeedback(result.value.outcome === 'committed' ? '已保存。更改从下一次适用运行生效。' : '设置没有变化。');
      } else if (result) {
        pending.current = undefined;
        if (result.error === 'conflict') await onReload();
        setFeedback(XIAOZHI_SETTINGS_ERRORS[result.error]);
      } else {
        setFeedback('未收到保存回执，可以重试同一次提交。');
      }
    } catch {
      setFeedback('未收到保存回执，可以重试同一次提交。');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <section className={styles.field} aria-label={label}>
    <SettingsRow label={label} hint={draft && !conflict ? '当前已保存：' + describe(saved) : undefined} control={
      <AppSelect label={label} value={selected} options={selection} onChange={edit} disabled={disabled || busy} hideLabel
        testId={'pi-config-window-' + field}/>
    }/>
    {draft&&<div className={styles.actions}>
      <Button type="button" variant="primary" data-testid={'pi-config-window-save-' + field}
        isDisabled={disabled || busy || !available || (conflict && !pending.current)}
        onPress={() => void save()}>保存{label}</Button>
      <Button type="button" variant="ghost" isDisabled={busy} data-testid={'pi-config-window-discard-' + field}
        onPress={() => { pending.current = undefined; setDraft(undefined); setFeedback('已放弃本次草稿。'); }}>放弃修改</Button>
      {conflict&&<Button type="button" variant="secondary" isDisabled={busy || disabled}
        data-testid={'pi-config-window-rebase-' + field} onPress={() => {
          pending.current = undefined;
          setDraft({ value: draft.value, baseVersion: version });
          setFeedback('已采用最新版本。请核对草稿后保存。');
        }}>保留草稿，采用最新版本</Button>}
    </div>}
    {conflict&&<p role="alert" data-testid={'pi-config-window-conflict-' + field}>
      当前已保存：{describe(saved)}。草稿：{describe(selected)}。
    </p>}
    {draft&&!available&&<p role="status">草稿中的选项当前不可用。可以刷新目录后重试。</p>}
    {feedback&&<p role="status" data-testid={'pi-config-window-feedback-' + field}>{feedback}</p>}
  </section>;
}
