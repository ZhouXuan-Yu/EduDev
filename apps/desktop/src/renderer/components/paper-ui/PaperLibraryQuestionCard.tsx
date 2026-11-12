import {useState} from 'react';
import {Button} from '@heroui/react';
import {Plus} from 'lucide-react';
import type {QuestionNotebookEntry} from '../../../shared/contracts';
import {archiveEligible} from '../../../shared/question-archive';
import {PaperQuestionContent} from './PaperQuestionContent';
import styles from '../../ui-system/paper-studio/paper-library-browser.module.css';

export function PaperLibraryQuestionCard({question, version, disabled, onSelect}: {
  question: QuestionNotebookEntry;
  version: string;
  disabled: boolean;
  onSelect: () => void;
}) {
  const [imageReady, setImageReady] = useState(false);
  const eligible = archiveEligible(question);
  const context = [question.subject, question.grade].filter(Boolean).join(' · ');
  return <article className={styles.question} data-testid="paper-library-question" data-question-id={question.id}>
    <header><h3>{question.questionType || '题目'} · {question.knowledgePoint || '知识点未标注'}</h3>
      {context && <span>{context}</span>}
    </header>
    <PaperQuestionContent question={question} contentVersion={version} compactDetails onImageReady={setImageReady}/>
    <footer className={styles.questionActions}>
      {!eligible && <span role="note">题目仍需在题本核对，暂不能加入。</span>}
      <Button variant="secondary" size="sm" isDisabled={disabled || !eligible || !imageReady}
        data-testid="paper-library-add" onPress={onSelect}><Plus size={15}/>加入题篮</Button>
    </footer>
  </article>;
}
