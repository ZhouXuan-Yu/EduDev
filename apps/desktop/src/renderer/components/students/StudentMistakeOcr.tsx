import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {MistakeImageAnalysis} from '../../../shared/contracts';
import {MISTAKE_OCR_SCHEMA,MISTAKE_OCR_ERRORS,type MistakeOcrInput} from '../../../shared/mistake-ocr';
export function MistakeRecognitionState({analysis,busy,error,onStart,onCancel}:{analysis:MistakeImageAnalysis;busy:boolean;error:string;onStart:()=>void;onCancel:()=>void}){
 return <section data-testid="student-mistake-ocr" aria-busy={busy}>
  <p data-testid="student-mistake-ocr-status">{busy?'正在本地识别图片…':analysis.ocrStatus==='teacher_corrected'?'教师校正已保存':analysis.localOcr?'已识别，请核对文字':'可在本机识别图片文字'}</p>
  <p className="muted">图片保留在本机；请核对数字、公式及姓名，保存校正后再交给小智。</p>
  {busy?<Button variant="secondary" data-testid="student-mistake-ocr-cancel" onPress={onCancel}>取消识别</Button>:<Button variant="secondary" data-testid="student-mistake-ocr-start" isDisabled={!analysis.version||analysis.ocrStatus==='teacher_corrected'} onPress={onStart}>{analysis.localOcr?'读取识别结果':'识别图片文字'}</Button>}
  {analysis.localOcr&&<details><summary>查看识别原文</summary><pre data-testid="student-mistake-ocr-original">{analysis.localOcr.original}</pre></details>}
  {error&&<p role="alert" data-testid="student-mistake-ocr-error">{error}</p>}
 </section>;
}
/** Same fixed local OCR and host-owned file reader as chat attachments. */
export function StudentMistakeOcr({analysis,onAnalysis,onBusy}:{analysis:MistakeImageAnalysis;onAnalysis:(value:MistakeImageAnalysis)=>void;onBusy:(value:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),epoch=useRef(0),request=useRef<MistakeOcrInput|undefined>(undefined),callback=useRef(onBusy);callback.current=onBusy;
 function cancel(){if(request.current)void window.omniEdu?.cancelMistakeOcr(request.current).catch(()=>undefined);}
 useEffect(()=>{epoch.current++;setBusy(false);setError('');callback.current(false);return()=>{epoch.current++;cancel();callback.current(false);};},[analysis.studentId,analysis.id]);
 async function start(){if(request.current||!analysis.version)return;const stamp=epoch.current;
  const value={schemaVersion:MISTAKE_OCR_SCHEMA,studentId:analysis.studentId,analysisId:analysis.id,version:analysis.version,requestId:crypto.randomUUID()};request.current=value;setBusy(true);setError('');callback.current(true);
  try{const result=await window.omniEdu?.startMistakeOcr(value);if(stamp!==epoch.current)return;if(!result?.ok){setError(result?MISTAKE_OCR_ERRORS[result.error]:'本地识别不可用，请重试。');return;}onAnalysis(result.analysis);}
  catch{if(stamp===epoch.current)setError('本地识别未完成，请重试。');}
  finally{if(request.current===value)request.current=undefined;if(stamp===epoch.current){setBusy(false);callback.current(false);}}
 }
 return <MistakeRecognitionState analysis={analysis} busy={busy} error={error} onStart={()=>void start()} onCancel={cancel}/>;
}
