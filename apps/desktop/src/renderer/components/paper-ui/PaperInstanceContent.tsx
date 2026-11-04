import {useState} from 'react';
import {Button} from '@heroui/react';
import type {PaperInstanceBlock, PaperInstanceRole} from '../../../shared/paper-instance';
import {QuestionMathText} from '../QuestionMathText';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperQuestionContent} from './PaperQuestionContent';
import {PaperInstanceRoleImages} from './PaperInstanceRoleImages';
import type {PaperWorkspaceEntry} from './paper-basket-client';
import {usePaperInstanceImages} from './usePaperInstanceImages';
export type PaperInstancePresentation = Pick<PaperWorkspaceEntry, 'question' | 'questionId' | 'contentVersion' | 'generation' | 'instance' | 'deliveryBlock'>;
const deliveryMessages: Record<string, string> = {
  image_dependency: '修改涉及尚不能独立交付的原图。内容已保留，请核实配图；当前不能正式出卷。',
  options_required: '选择题尚未补齐可核对的选项。修改已保留，请在本卷编辑中补齐至少两个选项；当前不能正式出卷或生成答题卡。',
};

function Blocks({blocks,entry,role,onReady}: {blocks: PaperInstanceBlock[];entry:PaperInstancePresentation;role:PaperInstanceRole;onReady?:(ready:boolean)=>void}) {
  const images=usePaperInstanceImages(entry,role,blocks,onReady);
  return <>{blocks.map((block, index) => <div key={index} data-testid={`paper-instance-view-${block.type}`}>
    {block.type === 'text' && <QuestionMathText text={block.text}/>}
    {block.type === 'formula' && <QuestionMathText text={'$$' + block.latex + '$$'}/>}
    {block.type === 'table' && <table className="edu-paper-instance-display-table"><tbody>{block.rows.map((row, r) => <tr key={r}>
      {row.map((cell, c) => <td key={c}><QuestionMathText text={cell}/></td>)}</tr>)}</tbody></table>}
    {(block.type === 'options' || block.type === 'subquestions') && <div className="edu-paper-instance-items">
      {block.items.map((item, i) => <div key={i}><strong>{item.label}.</strong><QuestionMathText text={item.text}/></div>)}
    </div>}
    {block.type === 'sourceImage' && <figure data-testid="paper-instance-figure" data-block-id={block.blockId}>
      {images.images[block.blockId]?<img src={images.images[block.blockId]} alt={`本卷题面插图 ${index+1}`} style={{width:'auto',maxWidth:'100%'}}
        data-testid="paper-instance-figure-image" onLoad={()=>images.onLoad(block.blockId)} onError={()=>images.onError(block.blockId)}/>:<p role="status">{images.loading?'正在读取本地配图…':'配图引用已保留，等待核实。'}</p>}
    </figure>}
  </div>)}{images.error&&<p role="alert">{images.error}<Button variant="secondary" onPress={images.retry}>重新读取本卷配图</Button></p>}</>;
}
function Role({entry, role,onReady}: {entry: PaperInstancePresentation; role: PaperInstanceRole;onReady?:(ready:boolean)=>void}) {
  const content = entry.instance!.content[role];
  if (content.mode === 'edited') return <Blocks blocks={content.blocks} entry={entry} role={role} onReady={onReady}/>;
  if (role === 'question') return <PaperQuestionContent question={entry.question} contentVersion={entry.contentVersion}
    generation={entry.generation} showAnswers={false} onImageReady={onReady}/>;
  return <><QuestionMathText text={entry.question.archive?.native?.roles[role].text || entry.question[role] || '原题未提供此部分，请核对。'}/>
    <PaperInstanceRoleImages entry={entry} role={role}/></>;
}
/** Student mode never mounts answer/analysis blocks, figures, or original comparison. */
export function PaperInstanceContent({entry, showAnswers = true,onQuestionImagesReady}: {entry: PaperInstancePresentation; showAnswers?: boolean;onQuestionImagesReady?:(ready:boolean)=>void}) {
  const [answersOpened, setAnswersOpened] = useState(false);
  if (!entry.instance) return <PaperQuestionContent question={entry.question} contentVersion={entry.contentVersion}
    generation={entry.generation} showAnswers={showAnswers} onImageReady={onQuestionImagesReady}/>;
  return <div className="edu-paper-question-content" data-testid="paper-instance-content">
    {entry.instance.content.question.mode === 'source' ? <Role entry={entry} role="question" onReady={onQuestionImagesReady}/>
      : <div data-testid="paper-basket-question-stem"><Role entry={entry} role="question" onReady={onQuestionImagesReady}/></div>}
    {entry.deliveryBlock && deliveryMessages[entry.deliveryBlock] && <p role="alert">{deliveryMessages[entry.deliveryBlock]}</p>}
    {showAnswers && <DisclosureCard title="本卷参考答案与解析" data-testid="paper-basket-answer"
      onExpandedChange={expanded => {if (expanded) setAnswersOpened(true);}}>
      {answersOpened && <>
      <section data-testid="paper-instance-answer-view"><h4>参考答案</h4><Role entry={entry} role="answer"/></section>
      <section data-testid="paper-instance-analysis-view"><h4>解析</h4><Role entry={entry} role="analysis"/></section>
      <p>逐题核对不代表答案已获独立正确性验证，正式使用前请核实。</p>
      </>}
    </DisclosureCard>}
  </div>;
}
