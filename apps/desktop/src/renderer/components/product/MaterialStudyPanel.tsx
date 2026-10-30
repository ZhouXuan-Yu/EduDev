import {useEffect,useRef,useState} from 'react';
import {Button,TextArea} from '@heroui/react';
import {MATERIALS_SCHEMA} from '../../../shared/materials';
import {MATERIAL_STUDY_SCHEMA,type MaterialStudyView,type MaterialStudyPage} from '../../../shared/material-study';
import {MaterialExcerpt} from './MaterialBodyPanel';

const failure=(error:unknown)=>{const message=String(error);return message.includes('source_changed')?'资料正文已变化，旧笔记仍保留。请关闭阅读后重新打开，核对当前版本。':message.includes('revision_conflict')?'阅读记录已在其他操作中更新，请关闭后重新打开，避免覆盖旧笔记。':message.includes('private_content')?'这一段含个人信息，保留在本机；请先处理个人信息后再问小智。':'未能完成操作，请重试。笔记尚未保存时不要离开。';};
/** Local reader: no model calls until the teacher explicitly asks in the existing Pi composer. */
export function MaterialStudyPanel({resourceId,onAsk,onDirty}:{resourceId:string;onAsk?:(prompt:string)=>void;onDirty:(dirty:boolean)=>void}){
 const [view,setView]=useState<MaterialStudyView>(),[page,setPage]=useState<MaterialStudyPage>(),[note,setNote]=useState(''),[question,setQuestion]=useState('');
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dirty,setDirty]=useState(false);
 const alive=useRef(true),lock=useRef(false);
 useEffect(()=>{alive.current=true;let current=true;
  void (async()=>{try{const api=window.omniEdu;if(!api)throw new Error();const v=await api.getMaterialReading({schemaVersion:MATERIAL_STUDY_SCHEMA,resourceId});
   const p=v.entry&&!v.stale?await api.getMaterialSource(v.entry.source):await api.getMaterialReadingPage({schemaVersion:MATERIALS_SCHEMA,resourceId,offset:0});
   if(current){setView(v);setPage(p);setNote(v.entry?.note||'');setNotice(v.stale?'资料已变化，旧笔记已保留。当前从新正文开始；保存会新增阅读记录，不覆盖历史。':v.entry?'已恢复上次保存的段落与笔记。':'从第一段开始阅读。');}
  }catch(e){if(current)setError(failure(e));}finally{if(current)setBusy(false);}})();
  return()=>{current=false;alive.current=false;onDirty(false);};
 },[resourceId]);
 useEffect(()=>{onDirty(dirty);if(!dirty)return;const keyGuard=(e:KeyboardEvent)=>{if(['Enter',' '].includes(e.key)&&e.target instanceof Element&&!e.target.closest('[data-testid="material-study"]')){e.preventDefault();e.stopPropagation();setError('阅读笔记尚未保存，请先保存后再切换。');}};const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
  const guard=(e:Event)=>{if(e.target instanceof Element&&!e.target.closest('[data-testid="material-study"]')){e.preventDefault();e.stopPropagation();setError('阅读笔记尚未保存，请先保存后再切换。');}};
  window.addEventListener('beforeunload',unload);document.addEventListener('click',guard,true);document.addEventListener('pointerdown',guard,true);document.addEventListener('keydown',keyGuard,true);
  return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',guard,true);document.removeEventListener('pointerdown',guard,true);document.removeEventListener('keydown',keyGuard,true);};
 },[dirty,onDirty]);
 async function save(completed=false){if(!page||!view||lock.current)return false;lock.current=true;setBusy(true);setError('');
  try{const v=await window.omniEdu!.saveMaterialReading({schemaVersion:MATERIAL_STUDY_SCHEMA,source:page.source,expectedRevision:view.entry?.id||null,note,completed});
   if(alive.current){setView(v);setDirty(false);onDirty(false);setNotice(completed?'已标记读完这一段，并保存笔记。':'已保存当前阅读位置和笔记。');}return true;
  }catch(e){if(alive.current)setError(failure(e));return false;}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function move(delta:number){if(!page||dirty||lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const next=await window.omniEdu!.getMaterialReadingPage({schemaVersion:MATERIALS_SCHEMA,resourceId,offset:page.source.offset+delta});if(alive.current){setPage(next);setNote(next.savedNote||'');setDirty(true);setNotice('当前段落还未保存阅读位置。');}}catch(e){if(alive.current)setError(failure(e));}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function ask(classroom=false){if(!page||!classroom&&!question.trim()||!onAsk||busy)return;if(dirty&&!await save())return;setBusy(true);setError('');
  try{const prompt=await window.omniEdu!.prepareMaterialReadingQuestion({schemaVersion:MATERIAL_STUDY_SCHEMA,source:page.source,question:classroom?`请根据这份资料的第${page.source.offset+1}段制作并保存待核对的互动课堂。先查找资料并实读当前段落，采用当前教学习惯；内容包含一页图示讲解和一页有答案解析的选择题。不猜测不清楚的公式和图示，补充示例需明确区分原文。不改学生事实或笔记。${question.trim()?`课堂要求：${question.trim()}`:''}`:question});if(alive.current)onAsk(prompt);}catch(e){if(alive.current)setError(failure(e));}finally{if(alive.current)setBusy(false);}
 }
 return <section className="material-study" data-testid="material-study" aria-label="阅读与辅导">
  <h3>阅读与辅导</h3>{notice&&<p role="status" data-testid="material-study-notice">{notice}</p>}{error&&<p role="alert" data-testid="material-study-error">{error}</p>}
  {page&&<><p data-testid="material-study-location">第 {page.source.offset+1} / {page.body.total} 段{page.body.chunks[0].pageNumber?` · 原件第 ${page.body.chunks[0].pageNumber} 页`:' · 原件页码未定位'}{view?.entry?.completed&&view.entry.source.chunkId===page.source.chunkId?' · 已标记读完':''}</p>
   <MaterialExcerpt chunk={page.body.chunks[0]}/>
   <label>这一段的阅读笔记<TextArea fullWidth rows={3} aria-label="阅读笔记" data-testid="material-study-note" maxLength={8000} value={note} disabled={busy} onChange={e=>{setNote(e.target.value);setDirty(true);}}/></label>
   <p className="teacher-library-caption">笔记保存在本机。提问只带当前段落和你输入的问题；复杂公式和题图请核对上方原件。</p>
   <div className="teacher-library-toolbar"><Button variant="secondary" isDisabled={busy||dirty||page.source.offset===0} onPress={()=>void move(-1)} data-testid="material-study-previous">上一段</Button><Button variant="secondary" isDisabled={busy||dirty||!page.body.hasMore} onPress={()=>void move(1)} data-testid="material-study-next">下一段</Button><Button isDisabled={busy} onPress={()=>void save()} data-testid="material-study-save">保存位置与笔记</Button><Button variant="ghost" isDisabled={busy} onPress={()=>void save(true)} data-testid="material-study-complete">标记读完这一段</Button></div>
   {onAsk&&<><label>问这一段<TextArea fullWidth rows={2} aria-label="阅读问题" data-testid="material-study-question" maxLength={2000} value={question} disabled={busy} onChange={e=>setQuestion(e.target.value)}/></label><Button variant="secondary" isDisabled={busy||!question.trim()||page.body.chunks[0].containsPersonalData} onPress={()=>void ask()} data-testid="material-study-ask">带着这一段问小智</Button><Button variant="secondary" isDisabled={busy||page.body.chunks[0].containsPersonalData} onPress={()=>void ask(true)} data-testid="material-study-classroom">用这一段制作互动课堂</Button></>}
  </>}{busy&&<p role="status">正在处理阅读记录…</p>}
 </section>;
}
