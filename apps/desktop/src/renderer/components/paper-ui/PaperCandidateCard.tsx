import {useState} from 'react';
import {Button} from '@heroui/react';
import type {PaperBasketCandidate} from '../../../shared/paper-basket';
import {PaperQuestionContent} from './PaperQuestionContent';
import {PaperQuestionDisclosure} from './PaperQuestionDisclosure';
import {PaperSelect} from './PaperSelect';
import {basketReasons} from './paper-basket-ui';
import type {PaperWorkspaceBasket, PaperWorkspaceEntry, PaperWorkspaceOperation} from './paper-basket-client';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';

export function PaperCandidateCard({candidate, basket, disabled, onMutate, replaceEntry, onReplaced}: {
  candidate: PaperBasketCandidate;
  basket: PaperWorkspaceBasket;
  disabled: boolean;
  onMutate: (operation: PaperWorkspaceOperation) => Promise<boolean>;
  replaceEntry?: PaperWorkspaceEntry;
  onReplaced?: () => void;
}) {
  const [sectionId, setSectionId] = useState(candidate.matchingSectionIds[0] || '');
  const [imageReady, setImageReady] = useState(false);
  const added = basket.entries.some(entry => entry.questionId === candidate.question.id && entry.entryId !== replaceEntry?.entryId);
  const replacementAllowed = !!replaceEntry?.instance && candidate.matchingSectionIds.includes(replaceEntry.sectionId);
  return <article className={`edu-paper-candidate-card ${styles.candidateCard}`} data-testid="paper-basket-candidate" data-question-id={candidate.question.id}>
    <header><h3 className={styles.candidateTitle}>{candidate.question.questionType} · {candidate.question.knowledgePoint || '知识点未标注'}</h3></header>
    <PaperQuestionContent question={candidate.question} contentVersion={candidate.contentVersion} generation={candidate.generation} compactDetails onImageReady={setImageReady}/>
    {!candidate.eligibility.available && <p role="note">{basketReasons[candidate.eligibility.reason]}</p>}
    <div className={styles.candidateActions}>
      {!replaceEntry && <PaperQuestionDisclosure title={`加入分节 · ${basket.blueprint.sections.find(section => section.id === sectionId)?.label || '没有匹配分节'}`}
        data-testid="paper-basket-section-choice">
        <PaperSelect label="加入分节" value={sectionId} disabled={disabled || added || !candidate.eligibility.available}
          options={candidate.matchingSectionIds.length ? candidate.matchingSectionIds.map(id => ({id, label: basket.blueprint.sections.find(s => s.id === id)?.label || id})) : [{id: '', label: '没有匹配分节'}]}
          onChange={setSectionId}/>
      </PaperQuestionDisclosure>}
      {replaceEntry ? <Button className="edu-primary-action-contrast" data-testid="paper-instance-replace-candidate"
        isDisabled={disabled || added || !candidate.eligibility.available || !replacementAllowed || !imageReady}
        onPress={() => {void onMutate({type: 'replaceEntry', entryId: replaceEntry.entryId,
          expectedInstanceRevision: replaceEntry.instance!.instanceRevision, questionId: candidate.question.id,
          expectedSourceVersion: candidate.contentVersion}).then(ok => {if (ok) onReplaced?.();});}}>替换当前题目</Button> :
      <Button className="edu-primary-action-contrast" data-testid="paper-basket-add" isDisabled={disabled || added || !candidate.eligibility.available || !sectionId || !imageReady}
        onPress={() => void onMutate({type: 'add', questionId: candidate.question.id, sectionId, expectedSourceVersion: candidate.contentVersion})}>
        {added ? '已加入题篮' : '加入题篮'}
      </Button>}
    </div>
  </article>;
}
