import {useEffect,useState} from 'react';
import {Button,Pagination} from '@heroui/react';
import {FolderOpen,RefreshCw} from 'lucide-react';
import {Markdown} from '../../heroui-pro/components/markdown';
import {MATERIALS_SCHEMA,materialFailureText,materialIsOcr,type MaterialBody,type MaterialSourceView} from '../../../shared/materials';
import type {ResourceChunk,TeacherResource} from '../../../shared/contracts';
import {LibraryEmpty} from './LibraryEmpty';
import {libraryDate} from './material-library';
import {MaterialOriginalPreview} from './MaterialOriginalPreview';
import type {MaterialTaskStatus} from '../../../shared/material-parse-task';

export function MaterialOcrNotice(){return <p role="note" className="teacher-library-caption" data-testid="materials-ocr-notice">以下为本机文字识别结果，尚未由教师核对。公式、题图和手写批注请以原件为准；收录正文不代表题目或答案已确认。</p>;}
export function MaterialExcerpt({chunk,sourceId}:{chunk:ResourceChunk;sourceId?:string}){return <article className="teacher-library-excerpt" data-testid={`materials-chunk-${chunk.id}`} data-source={chunk.id===sourceId||undefined}><h3>{chunk.pageNumber?`原件第 ${chunk.pageNumber} 页 · `:''}{chunk.heading||'内容摘录'}</h3><Markdown components={{img:({alt})=><span>［图片：{alt||'未加载'}］</span>,a:({children})=><span>{children}</span>}}>{chunk.contentMd}</Markdown></article>;}

export function MaterialBodyPanel({resource,sourceView,busy,revision,locate,retry,taskStatus}:{resource?:TeacherResource;sourceView?:MaterialSourceView;busy:boolean;revision:number;locate:()=>void;retry:()=>void;taskStatus?:MaterialTaskStatus}){
 const [body,setBody]=useState<MaterialBody>(),[offset,setOffset]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setOffset(sourceView?.source.offset||0);},[resource?.id,sourceView]);
 useEffect(()=>{let current=true;setBody(undefined);setError('');if(!resource){setLoading(false);return;}
  setLoading(true);const reading=sourceView&&offset===sourceView.source.offset?window.omniEdu?.getMaterialSource(sourceView.source).then(result=>result.body):window.omniEdu?.getMaterialBody({schemaVersion:MATERIALS_SCHEMA,resourceId:resource.id,offset});
  void reading?.then(next=>{if(current)setBody(next);}).catch(()=>{if(current)setError(sourceView?'来源内容已变化，请返回小智重新查找后再打开。':'无法读取这份资料，请刷新后重试。');}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};
 },[resource?.id,offset,revision,sourceView]);
 const current=body?.resource||resource;
 return <section className="teacher-library-detail" data-testid="materials-detail" aria-label="资料内容">
  {current?<><header><div><h2>{current.title}</h2><p>{current.originalFileName} · 添加于 {libraryDate(current.createdAt)}</p></div><Button variant="secondary" onPress={locate} isDisabled={busy} data-testid="materials-locate"><FolderOpen size={16}/>定位文件</Button></header>
   <MaterialOriginalPreview key={current.id+current.contentHash} resource={current} initialPage={body?.chunks[0]?.pageNumber||1} busy={busy}/>
   {loading?<p role="status">正在读取正文…</p>:error?<p role="alert">{error}</p>:body?.chunks.length?<><p className="teacher-library-caption" data-testid="materials-body-location">{sourceView?'已打开小智引用来源 · ':''}已收录内容 · 第 {body.offset+1}–{body.offset+body.chunks.length} 段，共 {body.total} 段{body.chunks.every(c=>c.pageNumber)?'（每段保留原件页码）':'（部分原页码未定位）'}</p>{materialIsOcr(current.parseEngine)&&<MaterialOcrNotice/>}{body.chunks.map(chunk=><MaterialExcerpt key={chunk.id} chunk={chunk} sourceId={sourceView?.source.chunkId}/>)}
    <Pagination aria-label="资料正文翻页" className="teacher-library-pagination"><Pagination.Content><Pagination.Item><Pagination.Previous isDisabled={busy||offset===0} onPress={()=>setOffset(Math.max(0,offset-(sourceView?1:10)))} data-testid="materials-body-previous">前面内容</Pagination.Previous></Pagination.Item><Pagination.Item><Pagination.Next isDisabled={busy||!body.hasMore} onPress={()=>setOffset(offset+(sourceView?1:10))} data-testid="materials-body-next">后面内容</Pagination.Next></Pagination.Item></Pagination.Content></Pagination></>
    :<><LibraryEmpty title="正文尚未收录" description={taskStatus==='running'?'正在本机后台收录，完成后可以查找正文。':taskStatus==='pending'?'等待本机后台收录，可以继续浏览或选择优先处理。':taskStatus==='cancelled'?'已停止收录，原文件仍保存在本机。':materialFailureText(current.parseEngine)}/>{!['pending','running'].includes(taskStatus||'')&&<Button variant="secondary" onPress={retry} isDisabled={busy} data-testid="materials-retry"><RefreshCw size={16}/>重新收录</Button>}</>}
  </>:<LibraryEmpty title="选择一份资料" description="查看已收录内容，或在本机打开原文件。"/>}
 </section>;
}
