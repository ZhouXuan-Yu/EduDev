import {Button} from '@heroui/react';
import {ChevronRight, X} from 'lucide-react';
import type {PaperBasketUiState} from '../../../shared/paper-basket';
import {ListView} from '../../heroui-pro/components/list-view';
import {basketReasons, orderedBasketEntries} from './paper-basket-ui';
import type {PaperWorkspaceBasket, PaperWorkspaceOperation} from './paper-basket-client';
import {PaperQuestionDisclosure} from './PaperQuestionDisclosure';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';

const difficultyLabels: Record<string, string> = {easy: '基础', medium: '中等', hard: '困难'};

export function PaperBasketPanel({basket, stage, disabled, onStage, onMutate}: {
  basket: PaperWorkspaceBasket;
  stage: PaperBasketUiState['stage'];
  disabled: boolean;
  onStage: (stage: PaperBasketUiState['stage']) => void;
  onMutate: (operation: PaperWorkspaceOperation) => Promise<boolean>;
}) {
  const entries = orderedBasketEntries(basket);
  const selecting = stage === 'select';
  const distribution = new Map<string, number>();
  for (const entry of entries) {
    const type = entry.question.questionType || '未标注题型';
    distribution.set(type, (distribution.get(type) || 0) + 1);
  }
  return <aside className={styles.basket} aria-label="持久题篮" data-testid="paper-basket-panel">
    <header className={styles.basketHeading}>
      <h2 className={styles.basketTitle} data-testid="paper-basket-summary">已选题目
        <span className={styles.basketCount} data-testid="paper-basket-count" aria-live="polite">{entries.length}</span>
      </h2>
      <p>{basket.title}</p>
    </header>
    <div className={styles.basketList}>
      <ListView aria-label="已选题目" selectionMode="none" variant="secondary"
        renderEmptyState={() => <p>先挑几道合适的题，加入后统一整理。</p>}>
        {entries.map((entry, index) => <ListView.Item id={entry.entryId} key={entry.entryId}
          data-testid="paper-basket-selected-entry" data-entry-id={entry.entryId}
          textValue={`第 ${index + 1} 题 ${entry.question.knowledgePoint || entry.question.questionType}`}>
          <ListView.ItemContent><div>
            <ListView.Title>{index + 1}. {entry.question.knowledgePoint || entry.question.questionType}</ListView.Title>
            <ListView.Description>{[entry.question.questionType,
              difficultyLabels[entry.question.difficulty] || entry.question.difficulty,
              entry.reviewCurrent === false ? '待核对' : '',
              !entry.availability.available ? basketReasons[entry.availability.reason] : '',
            ].filter(Boolean).join(' · ')}</ListView.Description>
          </div></ListView.ItemContent>
          {selecting && <ListView.ItemAction>
            <Button isIconOnly variant="ghost" size="sm" aria-label={`移除第 ${index + 1} 题`}
              data-testid="paper-basket-selected-remove" isDisabled={disabled}
              onPress={() => {void onMutate({type: 'remove', entryId: entry.entryId});}}>
              <X size={14} aria-hidden="true"/>
            </Button>
          </ListView.ItemAction>}
        </ListView.Item>)}
      </ListView>
      <PaperQuestionDisclosure title="命题与保存信息" data-testid="paper-basket-metadata">
        <p>修订 {basket.revision} · {basket.state === 'active' ? '已保存' : '已归档'}</p>
        {basket.gaps.filter(gap => gap.missing || gap.excess).map(gap => <p role="note" key={gap.sectionId + gap.sourceKind}>
          {basket.blueprint.sections.find(section => section.id === gap.sectionId)?.label || gap.sectionId} · {gap.sourceKind === 'generated' ? '生成题' : '原题'}
          {gap.missing ? ` 缺 ${gap.missing} 题` : ` 超 ${gap.excess} 题`}
        </p>)}
      </PaperQuestionDisclosure>
    </div>
    <footer className={styles.basketActions}>
      {!!entries.length && <dl className={styles.basketBreakdown} data-testid="paper-basket-breakdown">
        {[...distribution].map(([type, count]) => <div key={type}><dt>{type}</dt><dd>{count}</dd></div>)}
      </dl>}
      {selecting ? <>
        <Button isDisabled={disabled || !entries.length} data-testid="paper-basket-organize" onPress={() => onStage('organize')}>
          整理与预览（{entries.length}）<ChevronRight size={16} aria-hidden="true"/>
        </Button>
        <p className={styles.basketHint}>{basket.purpose === 'practice' ? '少量练习无需设置总分和考试时间' : '先整理题序与分值，再核对预览。'}</p>
      </> : <>
      <Button variant="secondary" isDisabled={disabled} data-testid="paper-basket-organize" onPress={() => onStage('organize')}>整理题篮（{basket.entries.length}）</Button>
      <Button className="edu-primary-action-contrast" isDisabled={disabled || !basket.entries.length} data-testid="paper-basket-preview" onPress={() => onStage('preview')}>预览已选题</Button>
      </>}
    </footer>
  </aside>;
}
