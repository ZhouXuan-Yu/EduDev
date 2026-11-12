import type {ReactNode} from 'react';
import {Button} from '@heroui/react';
import type {PaperPurpose} from '../../../shared/paper-purpose';
import type {PaperWorkspaceBasket, PaperWorkspaceOperation} from './paper-basket-client';
import {basketEntryPoints, orderedBasketEntries} from './paper-basket-ui';
import {PaperPurposeControls} from './PaperPurposeControls';
import {PaperEntryPoints} from './PaperEntryPoints';
import {PaperQuestionDisclosure} from './PaperQuestionDisclosure';
import styles from '../../ui-system/paper-studio/paper-editor.module.css';

export function PaperEditorSettings({basket, disabled, pointsDisabled, onPurpose, onMutate, onPointsDirty, onTemplates, onConfiguration, sourceActions}: {
  basket: PaperWorkspaceBasket;
  disabled: boolean;
  pointsDisabled: boolean;
  onPurpose: (purpose: PaperPurpose) => void;
  onMutate: (operation: PaperWorkspaceOperation) => Promise<boolean>;
  onPointsDirty: (entryId: string, dirty: boolean) => void;
  onTemplates: () => void;
  onConfiguration: () => void;
  sourceActions: ReactNode;
}) {
  const entries = orderedBasketEntries(basket);
  const pending = entries.filter(entry => entry.instance && !entry.reviewCurrent).length;
  const layout = basket.c2?.layout;
  return <aside className={styles.settings} aria-label="交付设置" data-testid="paper-editor-settings">
    <h2>交付设置</h2>
    <PaperPurposeControls compact purpose={basket.purpose ?? 'paper'} requirementsMissing={basket.paperRequirements === 'required'} disabled={disabled} onPurpose={onPurpose}/>
    <section className={styles.settingSection}>
      <h3>卷面版式</h3>
      <p>{layout ? `A4 ${layout.orientation === 'portrait' ? '纵向' : '横向'} · ${layout.columns} 栏` : '默认版式'}</p>
      <Button variant="secondary" size="sm" data-testid="paper-editor-templates" isDisabled={disabled} onPress={onTemplates}>选择版式与模板</Button>
    </section>
    <PaperQuestionDisclosure key={basket.purpose} title="分值设置" defaultExpanded={basket.purpose !== 'practice'} data-testid="paper-editor-scores">
      <div className={styles.scores}>
        {entries.map((entry, index) => {
          const points = basketEntryPoints(basket, entry);
          return <div key={entry.entryId} data-testid="paper-editor-score" data-entry-id={entry.entryId}>
            {entry.instance && points != null ? <PaperEntryPoints compact label={`第 ${index + 1} 题`} points={points} disabled={pointsDisabled}
              onDirty={dirty => onPointsDirty(entry.entryId, dirty)} onSave={value => onMutate({type: 'setEntryPoints', entryId: entry.entryId, points: value})}/>
              : <p>第 {index + 1} 题 · 分值待核定</p>}
          </div>;
        })}
        <p className={styles.note}>只修改本卷分值，保存后重新核对。</p>
      </div>
    </PaperQuestionDisclosure>
    <section className={styles.settingSection}>
      <h3>补充题目</h3>
      {sourceActions}
    </section>
    <Button variant="ghost" size="sm" data-testid="paper-editor-configuration" onPress={onConfiguration}>考试要求与来源策略</Button>
    <p className={styles.note}>{pending ? `${pending} 道题待核对，可先预览。核对后再确认交付。` : '预览使用当前题目、顺序、答案和版式。'}</p>
  </aside>;
}
