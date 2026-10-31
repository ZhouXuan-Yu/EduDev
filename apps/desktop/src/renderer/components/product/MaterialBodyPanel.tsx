import {MaterialStudyPanel} from './MaterialStudyPanel';
import {MaterialWordPanel} from './MaterialWordPanel';
import {useCallback,useEffect,useState} from 'react';
import {Button,Pagination} from '@heroui/react';
import {FolderOpen} from 'lucide-react';
import {Markdown} from '../../heroui-pro/components/markdown';
import {MATERIALS_SCHEMA,materialIsOcr,type MaterialBody,type MaterialSourceView} from '../../../shared/materials';
import type {ResourceChunk,TeacherResource} from '../../../shared/contracts';
import {LibraryEmpty} from './LibraryEmpty';
import {libraryDate,libraryFileSize,materialReadiness} from './material-library';
import {MaterialDetailNavigation,type MaterialDetailSection} from './MaterialDetailNavigation';
import {MaterialOriginalPreview} from './MaterialOriginalPreview';
import type {MaterialTaskStatus} from '../../../shared/material-parse-task';
import {MaterialPdfProgress} from './MaterialPdfProgress';
import {MaterialAiPanel} from './MaterialAiPanel';
import {MaterialAiPagePanel} from './MaterialAiPagePanel';
import {MaterialBodyAvailability} from './MaterialBodyAvailability';
import {useMaterialDraftGuard} from './useMaterialDraftGuard';
import {validAiTextSource} from '../../../shared/material-ai-text';

export function MaterialOcrNotice(){return <p role="note" className="teacher-library-caption" data-testid="materials-ocr-notice">以下为本机文字识别结果，尚未由教师核对。公式、题图和手写批注请以原件为准；收录正文不代表题目或答案已确认。</p>;}
export function MaterialExcerpt({chunk,sourceId}:{chunk:ResourceChunk;sourceId?:string}){return <article className="teacher-library-excerpt" data-testid={`materials-chunk-${chunk.id}`} data-source={chunk.id===sourceId||undefined}><h3>{chunk.pageNumber?`原件第 ${chunk.pageNumber} 页 · `:''}{chunk.heading||'内容摘录'}</h3><Markdown components={{img:({alt})=><span>［图片：{alt||'未加载'}］</span>,a:({children})=><span>{children}</span>}}>{chunk.contentMd}</Markdown></article>;}

export function MaterialBodyPanel({resource,sourceView,busy,revision,locate,retry,taskStatus,onAsk,onStudyDirty}:{resource?:TeacherResource;sourceView?:MaterialSourceView;busy:boolean;revision:number;locate:()=>void;retry:()=>void;taskStatus?:MaterialTaskStatus;onAsk?:(prompt:string)=>void;onStudyDirty?:(dirty:boolean)=>void}){
 const [originalVisited,setOriginalVisited]=useState(false),[previewRequest,setPreviewRequest]=useState(0),[originalDirty,setOriginalDirty]=useState(false);
 const [aiDirty,setAiDirty]=useState(false);
 const reportAiDirty=useCallback((value:boolean)=>setAiDirty(value),[]);
 const [questionsVisited,setQuestionsVisited]=useState(false);
 const [previewOpen,setPreviewOpen]=useState(false);
 const [section,setSection]=useState<MaterialDetailSection>(sourceView?'content':'overview');
 const [studying,setStudying]=useState(false),[studyDirty,setStudyDirty]=useState(false),[wordRevision,setWordRevision]=useState(0);
 useMaterialDraftGuard(originalDirty||aiDirty||studyDirty);
 const reportDirty=useCallback((value:boolean)=>{setStudyDirty(value);},[]);
 const reportOriginalDirty=useCallback((value:boolean)=>setOriginalDirty(value),[]);
 useEffect(()=>{onStudyDirty?.(studyDirty||originalDirty||aiDirty);},[studyDirty,originalDirty,aiDirty,onStudyDirty]);
 useEffect(()=>{setSection(sourceView?'content':'overview');setPreviewOpen(false);setQuestionsVisited(false);setOriginalVisited(false);setPreviewRequest(0);setOriginalDirty(false);setAiDirty(false);setStudying(false);setStudyDirty(false);onStudyDirty?.(false);},[resource?.id,resource?.contentHash,sourceView?.source.chunkId,sourceView?.source.offset,sourceView?.source.bodyVersion]);
 const [body,setBody]=useState<MaterialBody>(),[offset,setOffset]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setOffset(sourceView?.source.offset||0);},[resource?.id,sourceView]);
 useEffect(()=>{let current=true;setBody(undefined);setError('');if(!resource){setLoading(false);return;}
  setLoading(true);const reading=sourceView&&offset===sourceView.source.offset?window.omniEdu?.getMaterialSource(sourceView.source).then(result=>result.body):window.omniEdu?.getMaterialBody({schemaVersion:MATERIALS_SCHEMA,resourceId:resource.id,offset});
  void reading?.then(next=>{if(current&&next){if(next.resource.id!==resource.id||next.resource.contentHash!==resource.contentHash){setError('资料版本已变化，请刷新目录后重新打开。');return;}setBody(next);}}).catch(()=>{if(current)setError(sourceView?'来源内容已变化，请返回小智重新查找后再打开。':'无法读取这份资料，请刷新后重试。');}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};
 },[resource?.id,resource?.contentHash,offset,revision,wordRevision,sourceView]);
 const current=body?.resource||resource;
 if(sourceView&&validAiTextSource(sourceView.source))return <section className="teacher-library-detail" data-testid="materials-detail" aria-label="AI还原资料来源"><header><h2>{sourceView.body.resource.originalFileName}</h2><p data-testid="materials-ai-restored-source">AI还原参考正文 · 原件第{sourceView.source.page}页 · 未经教师逐字核验</p></header><MaterialAiPagePanel onDraftDirty={reportAiDirty} batchId={sourceView.source.batchId} ordinal={sourceView.source.ordinal} reference={sourceView.source} initiallyOpen/></section>;
 return <section className="teacher-library-detail" data-testid="materials-detail" aria-label="资料内容" data-resource-id={resource?.id} data-resource-version={resource?.contentHash}>
  {current?<><header><div><h2>{current.title}</h2><p>{current.originalFileName} · 添加于 {libraryDate(current.createdAt)}</p></div><div className="teacher-library-toolbar">{section!=='original'&&/\.pdf$/i.test(current.originalFileName)&&<Button variant="secondary" isDisabled={busy||studyDirty} onPress={()=>{setOriginalVisited(true);setPreviewRequest(v=>v+1);setPreviewOpen(true);setSection('original');}} data-testid="materials-original-open">查看原页</Button>}<Button variant="secondary" onPress={locate} isDisabled={busy} data-testid="materials-locate"><FolderOpen size={16}/>定位文件</Button></div></header>
   {aiDirty&&<p role="note" data-testid="materials-unsaved-ai">题目与校正中有临时校对文字，切换分区会保留。离开资料前请先复制所需文字，再返回该原页清除选择和暂存文字。</p>}
   {originalDirty&&<p role="note" data-testid="materials-unsaved-original">原页有临时校对文字，切换分区会保留。离开资料或更换原页前，请返回“原页”清除选择和暂存文字。</p>}
   <MaterialDetailNavigation section={section} disabled={studyDirty} onChange={next=>{setSection(next);if(next==='original')setOriginalVisited(true);if(next==='questions')setQuestionsVisited(true);if(next==='notes')setStudying(true);}}/>
   {section==='overview'&&<div className="edu-material-overview" data-testid="materials-overview">
    {(taskStatus==='running'||taskStatus==='pending')&&<p role="status" data-testid="materials-background-status">{taskStatus==='running'?'正在本机后台收录，完成后可以查找正文。':'等待本机后台收录，可以继续浏览或选择优先处理。'}</p>}
    <dl><div><dt>收录状态</dt><dd>{materialReadiness(current).label}</dd></div><div><dt>已收录正文</dt><dd>{current.chunkCount} 段</dd></div><div><dt>原件大小</dt><dd>{libraryFileSize(current.fileSize)}</dd></div><div><dt>更新时间</dt><dd>{libraryDate(current.updatedAt)}</dd></div></dl>
    <p>原件保存在本机。正文可查找不代表题目、公式或答案已经教师核验。</p>
    <div className="teacher-library-toolbar"><Button variant="secondary" isDisabled={busy||studyDirty||!body?.chunks.length} onPress={()=>{setStudying(true);setSection('notes');}} data-testid="materials-study-toggle">开始／继续阅读</Button><Button variant="ghost" onPress={()=>setSection('content')}>阅读已收录正文</Button></div>
    {loading?<p role="status">正在读取资料概要…</p>:error?<p role="alert">{error}</p>:body?.chunks[0]?<details><summary>查看正文首段</summary><MaterialExcerpt chunk={body.chunks[0]}/></details>:<MaterialBodyAvailability resource={current} taskStatus={taskStatus} busy={busy} retry={retry}/>}
   </div>}
   {section==='advanced'&&<div data-testid="materials-processing-detail">{/\.pdf$/i.test(current.originalFileName)&&<MaterialPdfProgress resource={current}/>}<p>收录、索引与题目核对是独立状态；已保存原件与成功页不会因停止而删除。</p></div>}
   {(questionsVisited||section==='questions')&&<div hidden={section!=='questions'} data-testid="materials-question-detail"><p className="teacher-library-caption">对照原件整理题目、配套答案和来源。完整题面与教师确认继续使用原有题本流程。</p><MaterialAiPanel key={'ai-'+current.id+current.contentHash} resource={current} onDraftDirty={reportAiDirty}/>{/\.docx$/i.test(current.originalFileName)&&<MaterialWordPanel key={'word-'+current.id+current.contentHash} resource={current} disabled={busy||studyDirty||!!sourceView} onRebuilt={()=>{setOffset(0);setWordRevision(v=>v+1);}}/>}</div>}
   {(originalVisited||section==='original')&&<div hidden={section!=='original'}>{!/\.pdf$/i.test(current.originalFileName)&&<LibraryEmpty title="当前格式没有页图预览" description="Word 图文、公式与题目可在“题目与校正”查看；其他格式可定位本机原文件。"/>}<MaterialOriginalPreview key={current.id+current.contentHash} resource={current} initialPage={body?.chunks[0]?.pageNumber||1} busy={busy} initiallyOpen={previewOpen} openRequest={previewRequest} onDraftDirty={reportOriginalDirty}/></div>}
   {studying&&<div hidden={section!=='notes'}><MaterialStudyPanel key={current.id+current.contentHash} resourceId={current.id} onAsk={onAsk} onDirty={reportDirty}/></div>}
   {section==='content'&&<>
   {loading?<p role="status">正在读取正文…</p>:error?<p role="alert">{error}</p>:body?.chunks.length?<><p className="teacher-library-caption" data-testid="materials-body-location">{sourceView?'已打开小智引用来源 · ':''}已收录内容 · 第 {body.offset+1}–{body.offset+body.chunks.length} 段，共 {body.total} 段{body.chunks.every(c=>c.pageNumber)?'（每段保留原件页码）':'（部分原页码未定位）'}</p>{materialIsOcr(current.parseEngine)&&<MaterialOcrNotice/>}{body.chunks.map(chunk=><MaterialExcerpt key={chunk.id} chunk={chunk} sourceId={sourceView?.source.chunkId}/>)}
    <Pagination aria-label="资料正文翻页" className="teacher-library-pagination"><Pagination.Content><Pagination.Item><Pagination.Previous isDisabled={busy||offset===0} onPress={()=>setOffset(Math.max(0,offset-(sourceView?1:10)))} data-testid="materials-body-previous">前面内容</Pagination.Previous></Pagination.Item><Pagination.Item><Pagination.Next isDisabled={busy||!body.hasMore} onPress={()=>setOffset(offset+(sourceView?1:10))} data-testid="materials-body-next">后面内容</Pagination.Next></Pagination.Item></Pagination.Content></Pagination></>
    :<MaterialBodyAvailability resource={current} taskStatus={taskStatus} busy={busy} retry={retry}/>}
   </>}
  </>:<LibraryEmpty title="选择一份资料" description="查看已收录内容，或在本机打开原文件。"/>}
 </section>;
}
