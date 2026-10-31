import {useEffect,useState} from 'react';
import type {TeacherResource} from '../../../shared/contracts';
import {MATERIAL_BOOK_PAIR_SCHEMA,type MaterialBookPairView} from '../../../shared/material-book-pair';
import {MATERIALS_SCHEMA,type MaterialPage} from '../../../shared/materials';
const errorText=(error:unknown)=>{const code=error instanceof Error?error.message:String(error);return code.includes('answer_already_processed')?'这份答案册已有未完成AI任务或按其他角色整理的AI记录。为保留原任务的输入含义，暂不能关联；同一题册已完成的答案转录可以恢复关联。':code.includes('conflict')?'关联已变化或这份资料已被其他题册使用，请刷新后重试。':code.includes('source_changed')?'原文件版本已变化，请刷新资料后重新关联。':'无法完成关联，请稍后重试。';};
export function MaterialBookPanel({resource,onChange}:{resource:TeacherResource;onChange:(view:MaterialBookPairView)=>void}){
 const [view,setView]=useState<MaterialBookPairView>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [query,setQuery]=useState(''),[page,setPage]=useState<MaterialPage>(),[selection,setSelection]=useState('');
 useEffect(()=>{let current=true;setView(undefined);setError('');void Promise.resolve().then(()=>window.omniEdu!.getMaterialBookPair(resource.id)).then(v=>{if(current){setView(v);onChange(v);}}).catch(e=>{if(current)setError(errorText(e));});return()=>{current=false;};},[resource.id,resource.contentHash,onChange]);
 async function search(offset=0){setBusy(true);setError('');try{setPage(await window.omniEdu!.listMaterials({schemaVersion:MATERIALS_SCHEMA,query,offset}));setSelection('');}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function save(unlink=false){if(!view)return;const answer=page?.resources.find(r=>r.id===selection);if(!unlink&&!answer)return;setBusy(true);setError('');setNotice('');try{
  const v=await window.omniEdu!.setMaterialBookPair({schemaVersion:MATERIAL_BOOK_PAIR_SCHEMA,action:unlink?'unlink':'link',resourceId:resource.id,version:resource.contentHash,revision:view.revision,...(!unlink?{answerId:answer!.id,answerVersion:answer!.contentHash}:{})});setView(v);onChange(v);setNotice(unlink?'已解除关联；先前隐藏的自动候选恢复显示，原文件和历史整理记录保留。':'已关联。答案册中未经处理的自动抽题候选已从题本默认列表隐藏，教师编辑、收藏、分类和使用记录保留。答案整理后会后台匹配，疑点保留待核。');
 }catch(e){setError(errorText(e));}finally{setBusy(false);}}
 if(!/\.pdf$/i.test(resource.originalFileName))return null;
 return <details className="material-ai" data-testid="material-book-panel"><summary>独立答案册关联</summary>
  {!view&&!error&&<p role="status">正在读取关联…</p>}
  {view?.role?<><p data-testid="material-book-linked">题册：{view.questionTitle} · 答案册：{view.answerTitle}</p><p>本文件角色：{view.role.kind==='answers'?'答案册（仅转录，不抽题）':'题册'}。关联不等于逐题匹配，AI和联网补答授权保持独立。</p>{!view.current&&<p role="alert">关联中的原件版本已变化，需要解除后重新关联。</p>}{view.role.kind==='questions'?<button className="secondary-action" data-testid="material-book-unlink" disabled={busy} onClick={()=>void save(true)}>解除关联</button>:<p>需要解除时，请打开对应题册操作。</p>}</>:view&&<fieldset disabled={busy}><legend>为本题册选择已收录的答案 PDF</legend>
   <label>按文件名查找<input data-testid="material-book-query" value={query} maxLength={128} onChange={e=>setQuery(e.target.value)}/></label><button className="secondary-action" data-testid="material-book-search" onClick={()=>void search()}>查找答案册</button>
   {page&&<><select aria-label="答案册文件" data-testid="material-book-select" value={selection} onChange={e=>setSelection(e.target.value)}><option value="">请选择答案册</option>{page.resources.filter(r=>r.id!==resource.id&&/\.pdf$/i.test(r.originalFileName)).map(r=><option key={r.id} value={r.id}>{r.originalFileName}</option>)}</select>{!page.resources.some(r=>r.id!==resource.id&&/\.pdf$/i.test(r.originalFileName))&&<p>本页没有可选答案 PDF，请调整文件名或翻页。</p>}<div className="toolbar-row"><button disabled={busy||page.offset===0} onClick={()=>void search(Math.max(0,page.offset-50))}>前一页</button><button disabled={busy||!page.hasMore} onClick={()=>void search(page.offset+50)}>后一页</button></div></>}
   <p>导入后也可关联。未经处理的答案册自动抽题候选将从题本默认列表隐藏，可在“显示原始候选”中查看；教师处理过的题目保留可见，解除关联可恢复原候选。关联不上传资料，答案匹配仍须核对章节和题号。</p><button className="primary-action" data-testid="material-book-link" disabled={busy||!selection} onClick={()=>void save()}>关联答案册</button>
  </fieldset>}
  {busy&&<p role="status">正在保存或查找…</p>}{notice&&<p role="status">{notice}</p>}{error&&<><p role="alert">{error}</p><button disabled={busy} onClick={()=>{setError('');void window.omniEdu!.getMaterialBookPair(resource.id).then(v=>{setView(v);onChange(v);}).catch(e=>setError(errorText(e)));}}>刷新关联</button></>}
 </details>;
}
