import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import type {QuestionBankItem} from '../../shared/contracts';
import {questionFacts} from '../../shared/question-facts';
import {ORIGINAL_REVIEW_SCHEMA} from '../../shared/original-question-review';
import './office/pi-original-question.css';
import {QuestionOriginalGallery} from './QuestionOriginalGallery';
export function QuestionOriginalPicture({question}:{question:QuestionBankItem}){
 return question.document?.source.parserVersion.startsWith('teacher-transcription.v2+')?<QuestionOriginalGallery question={question}/>:<SingleQuestionOriginalPicture question={question}/>;
}
function SingleQuestionOriginalPicture({question}:{question:QuestionBankItem}){
 const [open,setOpen]=useState(false),[image,setImage]=useState(''),[error,setError]=useState(''),[revision,setRevision]=useState(0),[loading,setLoading]=useState(false);
 const facts=JSON.stringify(questionFacts(question));
 useEffect(()=>{if(!open)return;let live=true;setImage('');setError('');setLoading(true);void crypto.subtle.digest('SHA-256',new TextEncoder().encode(facts)).then(bytes=>window.omniEdu?.getOriginalQuestionImage({schemaVersion:ORIGINAL_REVIEW_SCHEMA,questionId:question.id,version:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')})).then(r=>{if(!live)return;if(r?.ok)setImage(r.value);else setError('原题图不可读取或版本已变化，请重新打开题本。');}).catch(()=>{if(live)setError('原题图读取未完成，请重试。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[question.id,facts,revision,open]);
 return <section className="question-original-picture" data-testid="question-original-picture"><p>资料原题 · 教师校正转写，图形与公式请对照原图</p>{!open&&<Button variant="secondary" data-testid="question-original-open" onPress={()=>setOpen(true)}>查看原题图</Button>}{loading&&<p role="status">正在读取本地题图…</p>}{image&&<div className="pi-original-paper" tabIndex={0} aria-label="已保存原题图"><img data-testid="question-original-image" src={image} alt="已保存的原题图"/></div>}{error&&<><p role="alert">{error}</p><Button variant="secondary" onPress={()=>setRevision(x=>x+1)}>重新读取</Button></>}{question.document?.answer.origin==='missing'&&<p data-testid="question-original-missing-answer">答案未知，尚不能作为有标准答案的组卷题。</p>}</section>;
}
