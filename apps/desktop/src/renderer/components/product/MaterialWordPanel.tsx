import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type {TeacherResource} from '../../../shared/contracts';
import {WORD_SCHEMA,type WordPage,type WordBlock,type WordInline,type WordAsset,type WordImageView,type WordRebuildView} from '../../../shared/material-word';
import './material-word.css';
function Formula({value}:{value:Extract<WordInline,{kind:'formula'}>}){
 let html='';try{html=katex.renderToString(value.latex,{throwOnError:false,trust:false,strict:'error',maxExpand:1000,maxSize:12});}catch{}
 return <span className="material-word-formula" data-testid="word-formula">{html?<span dangerouslySetInnerHTML={{__html:html}}/>:<code>{value.latex||'公式内容未识别'}</code>}{!value.complete&&<span role="note">（请打开原文件核对公式）</span>}</span>;
}
function Picture({value,assets,resource}:{value:Extract<WordInline,{kind:'image'}>;assets:WordAsset[];resource:TeacherResource}){
 const [view,setView]=useState<WordImageView>(),[busy,setBusy]=useState(false),[error,setError]=useState('');const asset=assets.find(a=>a.id===value.assetId);
 async function open(){setBusy(true);setError('');try{const result=await window.omniEdu?.getMaterialWordImage({schemaVersion:WORD_SCHEMA,resourceId:resource.id,version:resource.contentHash,assetId:value.assetId});if(!result)throw Error();setView(result);}catch{setError('图片来源已变化或暂不可读取，请刷新资料后重试。');}finally{setBusy(false);}}
 return <span className="material-word-picture" data-testid="word-picture">{asset?<>{view?<img src={view.dataUrl} alt={value.alt||'Word 内嵌图片'} data-testid="word-picture-image"/>:<Button variant="secondary" isDisabled={busy} isPending={busy} onPress={()=>void open()} data-testid="word-picture-open">查看原文图片（{asset.width} × {asset.height}）</Button>}{value.alt&&<span>{value.alt}</span>}{error&&<span role="alert">{error}<Button variant="ghost" onPress={()=>void open()}>重试图片</Button></span>}</>:<span role="note">{value.issue==='external_image'?'原文使用了外链图片，尚未从外部下载。':'原文图片格式暂不可显示，请对照原文件。'}</span>}</span>;
}
function Blocks({blocks,assets,resource}:{blocks:WordBlock[];assets:WordAsset[];resource:TeacherResource}){
 const [offset,setOffset]=useState(0);return <>{blocks.slice(offset,offset+5).map(b=><Block key={b.id} value={b} assets={assets} resource={resource}/>)}{blocks.length>5&&<div className="teacher-library-toolbar"><Button variant="ghost" isDisabled={!offset} onPress={()=>setOffset(Math.max(0,offset-5))}>前面段落</Button><span>{offset+1}–{Math.min(offset+5,blocks.length)} / {blocks.length}</span><Button variant="ghost" isDisabled={offset+5>=blocks.length} onPress={()=>setOffset(offset+5)}>后面段落</Button></div>}</>;
}
function Block({value,assets,resource}:{value:WordBlock;assets:WordAsset[];resource:TeacherResource}){
 const [row,setRow]=useState(0),[column,setColumn]=useState(0),[expanded,setExpanded]=useState(false);const columns=value.kind==='table'?Math.max(0,...value.rows.map(r=>r.cells.length)):0;
 return <article className="material-word-block" data-word-block={value.id} data-testid="word-source-block">
  {value.kind==='paragraph'?<div className="material-word-paragraph">{value.numbering?.label&&<span>{value.numbering.label}</span>}{value.inlines.map((v,i)=>v.kind==='text'?<span key={i}>{v.text}</span>:v.kind==='formula'?<Formula key={i} value={v}/>:<Picture key={i} value={v} assets={assets} resource={resource}/>)}</div>:<><Button variant="secondary" onPress={()=>setExpanded(v=>!v)} data-testid="word-table-toggle">{expanded?'收起表格':'查看表格'}（{value.rows.length} 行）</Button>{expanded&&<>
   <div className="material-word-table"><table><tbody>{value.rows.slice(row,row+10).map((r,i)=><tr key={row+i}>{r.cells.slice(column,column+8).map((c,j)=><td key={column+j} colSpan={c.colSpan}><Blocks blocks={c.blocks} assets={assets} resource={resource}/></td>)}</tr>)}</tbody></table></div>
   {value.rows.length>10&&<div className="teacher-library-toolbar"><Button variant="ghost" isDisabled={!row} onPress={()=>setRow(Math.max(0,row-10))}>表格前10行</Button><span>第 {row+1}–{Math.min(row+10,value.rows.length)} / {value.rows.length} 行</span><Button variant="ghost" isDisabled={row+10>=value.rows.length} onPress={()=>setRow(row+10)}>表格后10行</Button></div>}
   {columns>8&&<div className="teacher-library-toolbar"><Button variant="ghost" isDisabled={!column} onPress={()=>setColumn(Math.max(0,column-8))}>表格前8列</Button><span>第 {column+1}–{Math.min(column+8,columns)} / {columns} 列</span><Button variant="ghost" isDisabled={column+8>=columns} onPress={()=>setColumn(column+8)}>表格后8列</Button></div>}
  </>}</>}
  <details className="material-word-anchor" data-word-part={value.anchor.part} data-word-path={value.anchor.path}><summary>原文件来源</summary><p>{resource.originalFileName} · {/header/i.test(value.anchor.part)?'页眉':/footer/i.test(value.anchor.part)?'页脚':/footnote/i.test(value.anchor.part)?'脚注':/endnote/i.test(value.anchor.part)?'尾注':'正文'}。可点击上方“定位文件”打开原件对照。</p></details>
 </article>;
}
const warningText:Record<string,string>={formula_incomplete:'部分公式尚不能完整显示，已保留原式',image_missing:'有图片关系缺失',unsupported_image:'有图片格式暂不可显示',external_image:'有外链图片未下载',embedded_object:'有嵌入对象未执行',tracked_changes:'原文含修订内容，请对照原文件',numbering_missing:'有自动编号无法完整还原',numbering_format:'有特殊编号格式需核对',numbering_override:'有编号重启规则需核对',merged_table:'表格含合并单元格，请对照原文件',supplemental_part:'包含页眉、页脚或注释内容',field_or_symbol:'有域或特殊符号需核对',alternate_content:'原文含兼容布局',external_content:'有外部内容未加载',part_missing:'有原文部件缺失'};
export function MaterialWordPanel({resource,disabled=false,onRebuilt}:{resource:TeacherResource;disabled?:boolean;onRebuilt:()=>void}){
 const [view,setView]=useState<WordPage>(),[offset,setOffset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[requesting,setRequesting]=useState(false),[job,setJob]=useState<WordRebuildView>(),[message,setMessage]=useState('');const seen=useRef('');
 const rebuilding=requesting||job?.status==='running',rebuildMessage=rebuilding?'正在本机重新整理 Word 图文…':message||(job?.status==='complete'?'Word 图文已整理，正文与索引已更新。':job?.status==='cancelled'?'已停止整理，原有正文仍保留。':job?.status==='failed'?'整理失败，原有正文仍保留。请定位原文件检查格式后重试。':'');
 useEffect(()=>{let active=true,inFlight=false;const poll=async()=>{if(inFlight)return;inFlight=true;try{const next=await window.omniEdu?.getMaterialWordJob({schemaVersion:WORD_SCHEMA,resourceId:resource.id,version:resource.contentHash});if(!active||!next)return;setJob(next);if(next.jobId&&next.status==='complete'&&seen.current!==next.jobId){seen.current=next.jobId;setOffset(0);setRevision(v=>v+1);onRebuilt();}}catch{if(active)setMessage('整理状态暂不可读取，请刷新资料后重试。');}finally{inFlight=false;}};void poll();const timer=setInterval(()=>void poll(),400);return()=>{active=false;clearInterval(timer);};},[resource.id,resource.contentHash]);
 async function rebuild(){setRequesting(true);setMessage('');try{if(!window.omniEdu)throw Error('unavailable');await window.omniEdu.rebuildMaterialWord({schemaVersion:WORD_SCHEMA,resourceId:resource.id,version:resource.contentHash});}catch(error){const message=String(error);setMessage(/cancelled|AbortError/.test(message)?'已停止整理，原有正文仍保留。':/source_changed/.test(message)?'资料已变化，请刷新后重试。':/material_busy|busy/.test(message)?'资料正在处理，请稍后重试。':'整理失败，原有正文仍保留。请定位原文件检查格式后重试。');}finally{setRequesting(false);}}
 useEffect(()=>{let active=true;setBusy(true);setView(undefined);setError('');void window.omniEdu?.getMaterialWord({schemaVersion:WORD_SCHEMA,resourceId:resource.id,version:resource.contentHash,offset}).then(v=>{if(active)setView(v);}).catch(()=>{if(active)setError('Word 结构暂不可读取，请刷新或对照原文件。');}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[resource.id,resource.contentHash,resource.parseStatus,resource.parseEngine,offset,revision]);
 return <section className="material-word-source" data-testid="material-word-source" aria-label="Word 原文结构"><h3>Word 图文与公式</h3><p>保留原文图片、公式和表格。Word 段落位置不等于打印页码；显示内容仍可对照原文件核对。</p>
  <p>重新整理会更新这份资料的正文和检索索引，已入库题目仍保留；引用旧正文的题目需重新核对来源。</p>
  <div className="teacher-library-toolbar"><Button variant="secondary" onPress={()=>void rebuild()} isPending={rebuilding} isDisabled={disabled||rebuilding} data-testid="word-source-rebuild">重新整理 Word 图文</Button>{rebuilding&&<Button variant="ghost" onPress={()=>void window.omniEdu?.cancelMaterialWord({schemaVersion:WORD_SCHEMA,resourceId:resource.id,version:resource.contentHash}).catch(()=>setMessage('停止请求未成功，请重试。'))} data-testid="word-source-cancel">停止整理</Button>}</div>
  {rebuildMessage&&<p role="status" data-testid="word-source-rebuild-status">{rebuildMessage}</p>}
  {busy?<p role="status">正在读取 Word 图文…</p>:error?<p role="alert">{error}<Button variant="secondary" onPress={()=>setRevision(v=>v+1)}>重试读取</Button></p>:view?<>
   {view.warnings.length>0&&<p role="note" data-testid="word-source-warnings">需对照原件：{view.warnings.map(w=>warningText[w]||'部分结构需核对').join('；')}。</p>}
   <p data-testid="word-source-location">原文结构 {view.offset+1}–{Math.min(view.offset+view.blocks.length,view.total)} / {view.total}</p>
   <Blocks key={offset} blocks={view.blocks} assets={view.assets} resource={resource}/>
   <div className="teacher-library-toolbar"><Button variant="secondary" isDisabled={!offset} onPress={()=>setOffset(Math.max(0,offset-5))} data-testid="word-source-previous">前面结构</Button><Button variant="secondary" isDisabled={!view.hasMore} onPress={()=>setOffset(offset+5)} data-testid="word-source-next">后面结构</Button></div>
  </>:<p>这份资料尚未建立完整 Word 结构。点击“重新整理 Word 图文”可从本机原文件补齐；此前的文字内容仍保留。</p>}
 </section>;
}
