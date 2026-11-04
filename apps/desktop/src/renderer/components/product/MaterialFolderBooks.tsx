import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {MATERIAL_FOLDER_BOOKS_SCHEMA as schema,type MaterialFolderBook,type MaterialFolderBooksPage} from '../../../shared/material-folder-books';
import {MATERIAL_BOOK_PAIR_SCHEMA,type MaterialBookPairView} from '../../../shared/material-book-pair';
const failure=(e:unknown)=>{const s=String(e);return s.includes('answer_already_processed')?'答案册已有其他角色的AI记录或未完成任务，未改变关联；请打开原资料处理。':s.includes('conflict')?'关联已变化或资料被其他题册使用，请重新选择题册。':s.includes('source_changed')?'原件版本已变化，请刷新候选并重新选择。':'读取或保存未完成，请重试；已保存关联保留。';};
/** Configure existing book roles before a folder grant; never infer identity from filenames. */
export function MaterialFolderBooks({batchId,onReadyChange,onBusyChange}:{batchId:string;onReadyChange:(ready:boolean)=>void;onBusyChange:(busy:boolean)=>void}){
 const [page,setPage]=useState<MaterialFolderBooksPage>(),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[revision,refresh]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [question,setQuestion]=useState<MaterialFolderBook>(),[answer,setAnswer]=useState<MaterialFolderBook>(),[pair,setPair]=useState<MaterialBookPairView>(),[busy,setBusy]=useState(false),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 useEffect(()=>{let current=true;setLoading(true);const timer=setTimeout(()=>{void window.omniEdu!.getMaterialFolderBooks({schemaVersion:schema,batchId,query,offset}).then(v=>{if(current){setPage(v);setError('');}}).catch(e=>{if(current){setPage(undefined);setError(failure(e));}}).finally(()=>{if(current)setLoading(false);});},200);return()=>{current=false;clearTimeout(timer);};},[batchId,query,offset,revision]);
 const ready=!!page?.archiveComplete&&!loading&&!busy&&!answer&&!!question&&pair?.resourceId===question.resourceId&&pair.current&&pair.role?.kind==='questions';
 useEffect(()=>{onReadyChange(!!ready);return()=>onReadyChange(false);},[ready,onReadyChange]);
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
 async function choose(book:MaterialFolderBook){const token=++generation.current;setQuestion(book);setAnswer(undefined);setPair(undefined);setNotice('');setBusy(true);setError('');try{const v=await window.omniEdu!.getMaterialBookPair(book.resourceId);if(token===generation.current)setPair(v);}catch(e){if(token===generation.current)setError(failure(e));}finally{if(token===generation.current)setBusy(false);}}
 async function save(unlink=false){if(!question||!pair||busy||!unlink&&!answer)return;const token=++generation.current;setBusy(true);setError('');setNotice('');try{const v=await window.omniEdu!.setMaterialBookPair({schemaVersion:MATERIAL_BOOK_PAIR_SCHEMA,action:unlink?'unlink':'link',resourceId:question.resourceId,version:question.version,revision:pair.revision,...(!unlink?{answerId:answer!.resourceId,answerVersion:answer!.version}:{})});if(token!==generation.current)return;setPair(v);setAnswer(undefined);refresh(v=>v+1);setNotice(unlink?'已解除关联，原件与历史记录保留。':'已保存关联。可以继续配置其他题册；开启本批AI后，答案册仅转录并后台配答，疑点保留待核对。');}catch(e){if(token===generation.current)setError(failure(e));}finally{if(token===generation.current)setBusy(false);}}
 return <section data-testid="folder-books">
  <p>先为本批PDF配置题册和独立答案册，可配置多组。关联保存在本地，不发送资料；后台逐题匹配仍核对章节、题号和来源，不会覆盖教师修改。</p>
  <label>按本批相对路径查找 PDF <input value={query} maxLength={128} onChange={e=>{setQuery(e.target.value);setOffset(0);}} data-testid="folder-books-query"/></label>
  <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>refresh(v=>v+1)} data-testid="folder-books-refresh">刷新本批文件</Button>
  {loading?<p role="status">正在读取本批PDF…</p>:page&&<>
   {!page.archiveComplete&&<p role="status" data-testid="folder-books-archiving">资料仍在归档。可先配置已收录的文件，归档结束后刷新，再开启此模式。</p>}
   {!page.books.length?<p role="status">当前没有匹配的已归档PDF，可修改查找条件或等待归档。</p>:<ul>{page.books.map(book=><li className="material-batch-file" key={book.resourceId} data-testid="folder-book" data-resource={book.resourceId}>
    <span>{book.relativePath}</span><span>{book.role?(book.role.kind==='answers'?'已关联答案册':'已关联题册'):'尚未关联'}</span>
    <Button size="sm" variant="secondary" isDisabled={busy||book.role?.kind==='answers'} onPress={()=>void choose(book)} data-testid="folder-book-question">设为题册</Button>
    <Button size="sm" variant="secondary" isDisabled={busy||!question||question.resourceId===book.resourceId||!!book.role} onPress={()=>{setAnswer(book);setNotice('');setError('');}} data-testid="folder-book-answer">设为答案册</Button>
   </li>)}</ul>}
   <div className="teacher-library-toolbar"><Button size="sm" variant="ghost" isDisabled={busy||offset===0} onPress={()=>setOffset(v=>Math.max(0,v-20))} data-testid="folder-books-previous">前20份</Button><span>共 {page.total} 份PDF（同一原件去重）</span><Button size="sm" variant="ghost" isDisabled={busy||!page.hasMore} onPress={()=>setOffset(v=>v+20)} data-testid="folder-books-next">后20份</Button></div>
  </>}
  {question&&<div data-testid="folder-books-selection"><p>所选题册：{question.relativePath}</p>{answer&&<p>所选答案册：{answer.relativePath}（尚未保存）</p>}
   {pair?.role&&<><p data-testid="folder-books-linked">已保存关联：{pair.questionTitle} → {pair.answerTitle}</p>{!pair.current&&<p role="alert">关联版本已变化，请解除后按当前原件重新关联。</p>}{pair.role.kind==='questions'&&<Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void save(true)} data-testid="folder-books-unlink">解除此关联</Button>}</>}
   {answer&&<Button size="sm" variant="secondary" isDisabled={busy||!pair||pair.role?.kind==='answers'} onPress={()=>void save()} data-testid="folder-books-save">保存题册与答案册关联</Button>}
  </div>}
  {busy&&<p role="status">正在读取或保存关联…</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  {!ready&&<p role="status" data-testid="folder-books-required">请完成归档并保存关联后，再开启本批AI；尚未保存的选择不会生效。</p>}
 </section>;
}
