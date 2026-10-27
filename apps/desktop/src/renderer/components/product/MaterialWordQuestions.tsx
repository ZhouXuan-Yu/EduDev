import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import type {TeacherResource} from '../../../shared/contracts';
import {WORD_QUESTION_SCHEMA,wordQuestionBlocks,wordQuestionIssueLabels,type WordQuestionPage,type WordQuestionRole} from '../../../shared/material-word-question';
import {MaterialWordBlocks} from './MaterialWordBlocks';

const roles:Record<WordQuestionRole,string>={question:'题面',answer:'原文答案',analysis:'原文解析'};
/** Local source preview: role membership is not an AI or teacher confirmation receipt. */
export function MaterialWordQuestions({resource,disabled=false}:{resource:TeacherResource;disabled?:boolean}){
 const [open,setOpen]=useState(false),[view,setView]=useState<WordQuestionPage>(),[offset,setOffset]=useState(0),[ordinal,setOrdinal]=useState<number>(),[role,setRole]=useState<WordQuestionRole>('question'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!open||disabled)return;let active=true;setBusy(true);setError('');setRole('question');
  void window.omniEdu?.getMaterialWordQuestions({schemaVersion:WORD_QUESTION_SCHEMA,resourceId:resource.id,version:resource.contentHash,offset,...(ordinal===undefined?{}:{ordinal})}).then(result=>{if(active)setView(result);}).catch(()=>{if(active)setError('题目来源已变化或暂不可读取，请重新整理 Word 后重试。');}).finally(()=>{if(active)setBusy(false);});
  return ()=>{active=false;};
 },[open,disabled,resource.id,resource.contentHash,offset,ordinal,revision]);
 function move(next:number){setOffset(next);setOrdinal(undefined);setView(undefined);}
 return <section className="material-word-questions" data-testid="word-question-preview" aria-label="Word 按题图文">
  <Button variant="secondary" isDisabled={disabled} onPress={()=>setOpen(v=>!v)} data-testid="word-question-toggle">{open?'收起按题查看':'按题查看 Word'}</Button>
  {open&&<>
   <p>按原文位置区分题面、答案和解析，保留图文来源。此处展示原文归属；AI 整理后的题目可在题本查看。</p>
   {busy?<p role="status">正在读取题目图文…</p>:error?<p role="alert">{error}<Button variant="secondary" onPress={()=>setRevision(v=>v+1)}>重试按题读取</Button></p>:view?<>
    <p data-testid="word-question-count">共识别 {view.total} 道原文题目{view.total?`，当前 ${view.offset+1}–${Math.min(view.offset+view.entries.length,view.total)}`:''}。</p>
    {!view.total&&<p>尚未识别出清晰编号的题目，可继续查看上方完整 Word 图文核对。</p>}
    <div className="material-word-question-list">{view.entries.map(entry=><div key={entry.ordinal}>
     <Button variant={ordinal===entry.ordinal?'primary':'secondary'} isDisabled={!entry.available||disabled} onPress={()=>setOrdinal(entry.ordinal)} data-testid={'word-question-select-'+entry.ordinal} aria-pressed={ordinal===entry.ordinal}>第 {entry.number} 题{entry.ordinal!==Number(entry.number)?`（原文第${entry.ordinal}处）`:''}</Button>
     <p>{entry.images} 张图 · {entry.formulas} 处公式 · {entry.tables} 个表格{!entry.hasAnswer?' · 缺原文答案':''}{!entry.hasAnalysis?' · 缺原文解析':''}</p>
     {entry.issues.length>0&&<p role="note">{entry.issues.map(i=>wordQuestionIssueLabels[i]).join('；')}。</p>}
    </div>)}</div>
    {view.total>5&&<div className="teacher-library-toolbar"><Button variant="secondary" isDisabled={!offset||disabled} onPress={()=>move(Math.max(0,offset-5))} data-testid="word-question-previous">前5题</Button><Button variant="secondary" isDisabled={!view.hasMore||disabled} onPress={()=>move(offset+5)} data-testid="word-question-next">后5题</Button></div>}
    {view.source&&<section aria-label={'第'+view.source.number+'题原文'} data-testid="word-question-detail">
     <div className="teacher-library-toolbar" aria-label="原文内容类型">{(Object.keys(roles) as WordQuestionRole[]).map(value=><Button key={value} variant={role===value?'primary':'secondary'} isDisabled={disabled} aria-pressed={role===value} onPress={()=>setRole(value)} data-testid={'word-question-role-'+value}>{roles[value]}</Button>)}</div>
     <div data-testid="word-question-role-content">{view.source.parts[role].length?<MaterialWordBlocks key={view.source.documentSha+view.source.ordinal+role} blocks={wordQuestionBlocks(view.source,role)} assets={view.source.assets} resource={resource}/>:<p>原文未找到明确的{roles[role]}内容，后续整理时需要补齐。</p>}</div>
    </section>}
   </>:<p>尚无 Word 按题图文，请先重新整理上方 Word 原文。</p>}
  </>}
 </section>;
}
