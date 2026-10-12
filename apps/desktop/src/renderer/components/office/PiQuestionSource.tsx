import {useEffect,useRef,useState} from 'react';
import {Button,Modal} from '@heroui/react';
import {BookOpen} from 'lucide-react';
import type {XiaozhiPublicSource} from '../../../shared/xiaozhi-web';
import {validQuestionContextSource,type QuestionContextView} from '../../../shared/question-context';
import {questionFactConflicts} from '../../../shared/question-facts';
import {QuestionAnswerEvidence} from '../QuestionAnswerEvidence';
import './pi-question-source.css';

export function QuestionContextContent({view}:{view:QuestionContextView}){
 const q=view.question;
 if(questionFactConflicts(q).length)return <div className="pi-question-source-content" data-testid="pi-question-source-content"><QuestionAnswerEvidence question={q}/></div>;
 return <div className="pi-question-source-content" data-testid="pi-question-source-content">
  <p>{[q.subject,q.grade,q.knowledgePoint,q.questionType].filter(Boolean).join(' · ')}</p>
  <p>来源：{q.sourceTitle||'本地题库'} · {q.sourceKind==='generated'?'AI生成':q.sourceKind==='teacher_resource'?'教师资料':'本地题库'}</p>
  <p>打开时已核对本地保存版本。题目中的答案和解析仍需教师核对。</p>
  <h3>题目</h3><div>{q.stem}</div><QuestionAnswerEvidence question={q}/>
 </div>;
}
/** Reuse the existing source Button + accessible HeroUI overlay, local read only. */
export function QuestionSourceLink({source}:{source:XiaozhiPublicSource}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[view,setView]=useState<QuestionContextView>(),generation=useRef(0);
 useEffect(()=>{generation.current++;setView(undefined);setNotice('');setBusy(false);return()=>{generation.current++;};},[source.question?.questionId,source.question?.version]);
 if(!validQuestionContextSource(source.question))return <li>{source.title}</li>;
 return <li><Button variant="ghost" className="pi-material-source" data-testid="pi-question-source-open" isPending={busy} isDisabled={busy} onPress={async()=>{
  const owner=++generation.current;setBusy(true);setNotice('');
  try{const result=await window.omniEdu?.getQuestionContextSource(source.question!);if(owner!==generation.current)return;if(!result?.ok){if(result&&'error' in result&&result.error==='question_fact_conflict'){setNotice('本地题目与原图核对记录不一致，请检查题本或恢复资料后重试。');return;}throw new Error('unavailable');}setView(result.value);}
  catch{if(owner===generation.current)setNotice('题目已变化或暂不可读取，请让小智重新检索后打开。');}
  finally{if(owner===generation.current)setBusy(false);}
 }}><BookOpen size={16}/><span>{source.title}</span></Button>{notice&&<p role="alert" data-testid="pi-question-source-error">{notice}</p>}
 {view&&<Modal.Backdrop isOpen onOpenChange={open=>{if(!open){generation.current++;setView(undefined);}}}>
  <Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-themed-surface" data-testid="pi-question-source-dialog">
   <Modal.Header><Modal.Heading>题目来源</Modal.Heading></Modal.Header><Modal.Body><QuestionContextContent view={view}/></Modal.Body>
   <Modal.Footer><Button variant="secondary" data-testid="pi-question-source-close" onPress={()=>{generation.current++;setView(undefined);}}>关闭</Button></Modal.Footer>
  </Modal.Dialog></Modal.Container>
 </Modal.Backdrop>}</li>;
}
