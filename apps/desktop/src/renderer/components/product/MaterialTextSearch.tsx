import {useEffect,useRef,useState} from 'react';
import {Button,SearchField} from '@heroui/react';
import {MATERIAL_SEARCH_SCHEMA as schema,type MaterialTextPage,type MaterialIndexStatus} from '../../../shared/material-search';
import type {MaterialSource} from '../../../shared/materials';
import {RerankNotice} from './RerankNotice';
export function MaterialTextSearch({open}:{open:(source:MaterialSource)=>void}){
 const [query,setQuery]=useState(''),[result,setResult]=useState<MaterialTextPage>(),[index,setIndex]=useState<MaterialIndexStatus>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);const epoch=useRef(0);
 const [mode,setMode]=useState<'hybrid'|'keyword'>('hybrid');
 useEffect(()=>{let current=true,inFlight=false;async function poll(){if(inFlight)return;inFlight=true;try{const state=await window.omniEdu?.getMaterialIndexStatus();if(current)setIndex(state);}catch{}finally{inFlight=false;}}void poll();const timer=setInterval(()=>void poll(),2000);return()=>{current=false;epoch.current++;clearInterval(timer);};},[]);
 async function search(offset=0){const text=query.trim();if(!text)return;const stamp=++epoch.current;setBusy(true);setError('');try{const next=await window.omniEdu?.searchMaterialText({schemaVersion:schema,query:text,offset,mode});if(stamp!==epoch.current)return;if(!next)throw new Error();setResult(next);setIndex(next.index);}catch{if(stamp===epoch.current)setError('正文查找暂不可用，请稍后重试。');}finally{if(stamp===epoch.current)setBusy(false);}}
 return <section className="material-text-search" aria-label="查找资料正文" data-testid="material-text-search">
  <form onSubmit={event=>{event.preventDefault();void search();}} className="teacher-library-toolbar">
   <SearchField aria-label="按知识点或题干关键词查找正文" value={query} onChange={text=>{setQuery(text);setResult(undefined);epoch.current++;setBusy(false);}} className="teacher-library-search" variant="secondary"><SearchField.Group><SearchField.SearchIcon/><SearchField.Input placeholder="查正文：知识点、题干关键词、公式…" maxLength={128} data-testid="materials-text-query"/><SearchField.ClearButton aria-label="清除正文查找"/></SearchField.Group></SearchField>
   <Button type="submit" variant="secondary" isDisabled={!query.trim()||busy} isPending={busy} data-testid="materials-text-submit">查找正文</Button>
   <select className="material-search-mode" data-testid="materials-search-mode" aria-label="检索方式" value={mode} onChange={e=>{setMode(e.target.value as typeof mode);setResult(undefined);epoch.current++;setBusy(false);}}><option value="hybrid">按题意与关键词</option><option value="keyword">只查关键词</option></select>
  </form>
  {index&&<p className="teacher-library-caption" data-testid="materials-index-status">{!index.available?'正文查找暂不可用。':`${index.indexed} 段正文可查${index.pending?`，${index.pending} 段正在补充整理；当前结果还不完整`:''}。多个关键词用空格隔开，可查其中任一关键词。`}</p>}
  {error&&<p role="alert">{error}</p>}
  {result?.semantic&&<p role="note" data-testid="materials-semantic-coverage">{result.semantic.available?'已结合本地题意检索。':'本地题意检索暂不可用，当前使用关键词结果。'}{!result.semantic.complete?'语义索引尚未完整覆盖当前资料。':''}{result.semantic.exhausted?'本次候选有数量上限，可缩小关键词范围继续查找。':''}{result.semantic.reason==='source_changed'?'查询时资料发生变化，请重新查找。':''}</p>}
  <RerankNotice value={result?.semantic?.rerank}/>
  {result&&<div data-testid="materials-text-results">{!result.hits.length?<p>{result.semantic?.reason==='source_changed'?'查询过程中资料已更新，请重新查找。':result.index.pending?'当前已整理内容未命中，其余正文仍在整理。':'当前已整理内容未找到匹配项；未解析的文件不在此次查找范围。'}</p>:<>
   <ul>{result.hits.map(hit=><li key={hit.source.chunkId} className="material-text-hit"><Button variant="ghost" onPress={()=>open(hit.source)} data-testid={'material-text-hit-'+hit.source.chunkId}>{hit.citation}</Button><p>{hit.excerpt}</p></li>)}</ul>
   <div className="teacher-library-toolbar"><Button variant="ghost" isDisabled={!result.offset||busy} onPress={()=>void search(Math.max(0,result.offset-20))}>上一页结果</Button><span>第 {Math.floor(result.offset/20)+1} 页</span><Button variant="ghost" isDisabled={!result.hasMore||busy} onPress={()=>void search(result.offset+20)}>下一页结果</Button></div>
  </>}</div>}
 </section>;
}
