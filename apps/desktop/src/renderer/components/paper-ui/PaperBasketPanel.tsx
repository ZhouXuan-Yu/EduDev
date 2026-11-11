import {Button} from '@heroui/react';
import type {PaperBasketUiState, PaperBasketView} from '../../../shared/paper-basket';
import {ListView} from '../../heroui-pro/components/list-view';
import {basketReasons, orderedBasketEntries} from './paper-basket-ui';
import type {PaperWorkspaceBasket} from './paper-basket-client';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';

export function PaperBasketPanel({basket, disabled, onStage}: {
  basket: PaperWorkspaceBasket;
  disabled: boolean;
  onStage: (stage: PaperBasketUiState['stage']) => void;
}) {
  return <aside className={styles.basket} aria-label="持久题篮" data-testid="paper-basket-panel">
    <header className={styles.basketHeading}>
      <h2 className={styles.basketTitle}>已选题篮</h2>
      <p data-testid="paper-basket-summary">{basket.entries.length} 题 · 修订 {basket.revision} · {basket.state === 'active' ? '已保存' : '已归档'}</p>
      <p>{basket.title}</p>
    </header>
    <div className={styles.basketList}>
      {basket.gaps.filter(gap => gap.missing || gap.excess).map(gap => <p role="note" key={gap.sectionId + gap.sourceKind}>
        {basket.blueprint.sections.find(section => section.id === gap.sectionId)?.label || gap.sectionId} · {gap.sourceKind === 'generated' ? '生成题' : '原题'}
        {gap.missing ? ` 缺 ${gap.missing} 题` : ` 超 ${gap.excess} 题`}
      </p>)}
      {!basket.entries.length && <p>从完整题面选择并加入。草稿允许缺题，不会自动补选。</p>}
      {!!basket.entries.length && <ListView aria-label="已选题目" selectionMode="none" variant="secondary">
        {orderedBasketEntries(basket).map((entry, index) => <ListView.Item id={entry.entryId} key={entry.entryId}
          textValue={`第 ${index + 1} 题 ${entry.question.knowledgePoint || entry.question.questionType}`}>
          <ListView.ItemContent><div>
            <ListView.Title>{index + 1}. {entry.question.knowledgePoint || entry.question.questionType}</ListView.Title>
            <ListView.Description>{entry.availability.available ? basket.blueprint.sections.find(s => s.id === entry.sectionId)?.label : basketReasons[entry.availability.reason]}</ListView.Description>
          </div></ListView.ItemContent>
        </ListView.Item>)}
      </ListView>}
    </div>
    <footer className={styles.basketActions}>
      <Button variant="secondary" isDisabled={disabled} data-testid="paper-basket-organize" onPress={() => onStage('organize')}>整理题篮（{basket.entries.length}）</Button>
      <Button className="edu-primary-action-contrast" isDisabled={disabled || !basket.entries.length} data-testid="paper-basket-preview" onPress={() => onStage('preview')}>预览已选题</Button>
    </footer>
  </aside>;
}
