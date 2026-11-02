import {useState} from 'react';
import type {PaperItem} from '../../../shared/paper-blueprint';
import {DisclosureCard} from '../ui/DisclosureCard';
import {QuestionSourceLink} from '../office/PiQuestionSource';
import {PaperInstanceContent} from './PaperInstanceContent';
import {PaperQuestionContent} from './PaperQuestionContent';

/** Whole-paper history and Pi review share the exact saved instance, never a re-created bank projection. */
export function PaperInstanceReviewContent({item}: {item: PaperItem}) {
  const [originalOpened, setOriginalOpened] = useState(false);
  return <section data-testid="paper-snapshot-instance">
    <p>本卷修订 {item.instance!.instanceRevision} · {item.instance!.review?.action === 'confirm' ? '该修订已核对' : '该修订尚待核对'}</p>
    <PaperInstanceContent entry={{question: item.question, questionId: item.source.questionId,
      contentVersion: item.source.version, generation: item.generation, instance: item.instance}}/>
    <DisclosureCard title="当前绑定原题对照与来源" data-testid="paper-question-source"
      onExpandedChange={expanded => {if (expanded) setOriginalOpened(true);}}>
      {originalOpened && <>
        <p>原题用于来源对照，未应用上方本卷修改；交付内容以已保存的本卷修订为准。</p>
        <PaperQuestionContent question={item.question} contentVersion={item.source.version} generation={item.generation}/>
        <ul><QuestionSourceLink source={{title: '查看本题保存来源', question: item.source}}/></ul>
      </>}
    </DisclosureCard>
  </section>;
}
