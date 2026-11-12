import {Button, Input} from '@heroui/react';
import type {PaperBlueprint} from '../../../shared/paper-blueprint';
import {validPaperBlueprint} from '../../../shared/paper-blueprint';
import styles from '../../ui-system/paper-studio/paper-editor.module.css';

export function PaperEditorToolbar({blueprint, dirty, disabled, otherInputDirty, requirementsMissing, onTitle, onSave, onDiscard, onSelect, onPreview, hasEntries}: {
  blueprint: PaperBlueprint;
  dirty: boolean;
  disabled: boolean;
  otherInputDirty: boolean;
  requirementsMissing: boolean;
  hasEntries: boolean;
  onTitle: (value: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return <div className={styles.toolbar} data-testid="paper-editor-toolbar">
    <Button variant="secondary" data-testid="paper-basket-continue-select" isDisabled={disabled || dirty || otherInputDirty} onPress={onSelect}>继续选题</Button>
    <div className={styles.titleField}>
      <Input fullWidth aria-label="题组标题" data-testid="paper-editor-title" maxLength={160} value={blueprint.title}
        disabled={disabled || otherInputDirty} onChange={event => onTitle(event.target.value)}/>
    </div>
    <Button variant="secondary" data-testid="paper-editor-save" isDisabled={disabled || otherInputDirty || !dirty || requirementsMissing || !validPaperBlueprint(blueprint)} onPress={onSave}>保存草稿</Button>
    {dirty && <Button variant="ghost" data-testid="paper-editor-discard" isDisabled={disabled || otherInputDirty} onPress={onDiscard}>放弃修改</Button>}
    <Button data-testid="paper-basket-stage-preview" isDisabled={disabled || dirty || otherInputDirty || !hasEntries} onPress={onPreview}>预览与导出</Button>
    {requirementsMissing && dirty && <span className={styles.note}>请先明确保存考试要求。</span>}
  </div>;
}
