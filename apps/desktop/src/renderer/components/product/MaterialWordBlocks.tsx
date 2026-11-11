import {useState} from 'react';
import {DisclosureCard} from '../ui/DisclosureCard';
import {Button} from '@heroui/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type {TeacherResource} from '../../../shared/contracts';
import {WORD_SCHEMA,type WordBlock,type WordInline,type WordAsset,type WordImageView} from '../../../shared/material-word';
import './material-word.css';
const missingPicture:Record<string,string>={external_image:'原文使用了外链图片，尚未从外部下载。',metafile_empty:'原文矢量图转换为空白，请对照原文件核对。',metafile_font_missing:'原文图片使用的字体在本机缺失，请安装字体后重建图文。',metafile_too_large:'原文图片超过转换范围，请对照原文件。',metafile_invalid_input:'原文矢量图结构不完整，请对照原文件。',metafile_parse_failed:'原文矢量图转换失败，请对照原文件或重建图文。'};
function Formula({value}:{value:Extract<WordInline,{kind:'formula'}>}){
 let html='';try{html=katex.renderToString(value.latex,{throwOnError:false,trust:false,strict:'error',maxExpand:1000,maxSize:12});}catch{}
 return <span className="material-word-formula" data-testid="word-formula">{html?<span dangerouslySetInnerHTML={{__html:html}}/>:<code>{value.latex||'公式内容未识别'}</code>}{!value.complete&&<span role="note">（请打开原文件核对公式）</span>}</span>;
}
function Picture({value,assets,resource}:{value:Extract<WordInline,{kind:'image'}>;assets:WordAsset[];resource:TeacherResource}){
 const [view,setView]=useState<WordImageView>(),[busy,setBusy]=useState(false),[error,setError]=useState('');const asset=assets.find(a=>a.id===value.assetId);
 async function open(){setBusy(true);setError('');try{const result=await window.omniEdu?.getMaterialWordImage({schemaVersion:WORD_SCHEMA,resourceId:resource.id,version:resource.contentHash,assetId:value.assetId});if(!result)throw Error();setView(result);}catch{setError('图片来源已变化或暂不可读取，请刷新资料后重试。');}finally{setBusy(false);}}
 return <span className="material-word-picture" data-testid="word-picture">{asset?<>{view?<img src={view.dataUrl} alt={value.alt||'Word 内嵌图片'} data-testid="word-picture-image"/>:<Button variant="secondary" isDisabled={busy} isPending={busy} onPress={()=>void open()} data-testid="word-picture-open">查看原文图片（{asset.width} × {asset.height}）</Button>}{value.alt&&<span>{value.alt}</span>}{error&&<span role="alert">{error}<Button variant="ghost" onPress={()=>void open()}>重试图片</Button></span>}</>:<span role="note" data-testid="word-picture-unavailable">{missingPicture[value.issue]||'原文图片格式暂不可显示，请对照原文件。'}</span>}</span>;
}
export function MaterialWordBlocks({blocks,assets,resource}:{blocks:WordBlock[];assets:WordAsset[];resource:TeacherResource}){
 const [offset,setOffset]=useState(0);return <>{blocks.slice(offset,offset+5).map((b,i)=><Block key={resource.id+resource.contentHash+b.id+'-'+(offset+i)} value={b} assets={assets} resource={resource}/>)}{blocks.length>5&&<div className="teacher-library-toolbar"><Button variant="ghost" isDisabled={!offset} onPress={()=>setOffset(Math.max(0,offset-5))}>前面段落</Button><span>{offset+1}–{Math.min(offset+5,blocks.length)} / {blocks.length}</span><Button variant="ghost" isDisabled={offset+5>=blocks.length} onPress={()=>setOffset(offset+5)}>后面段落</Button></div>}</>;
}
function Block({value,assets,resource}:{value:WordBlock;assets:WordAsset[];resource:TeacherResource}){
 const [row,setRow]=useState(0),[column,setColumn]=useState(0),[expanded,setExpanded]=useState(false);const columns=value.kind==='table'?Math.max(0,...value.rows.map(r=>r.cells.length)):0;
 return <article className="material-word-block" data-word-block={value.id} data-testid="word-source-block">
  {value.kind==='paragraph'?<div className="material-word-paragraph">{value.numbering?.label&&<span>{value.numbering.label}</span>}{value.inlines.map((v,i)=>v.kind==='text'?<span key={i}>{v.text}</span>:v.kind==='formula'?<Formula key={i} value={v}/>:<Picture key={resource.id+resource.contentHash+v.assetId+'-'+i} value={v} assets={assets} resource={resource}/>)}</div>:<><Button variant="secondary" onPress={()=>setExpanded(v=>!v)} data-testid="word-table-toggle">{expanded?'收起表格':'查看表格'}（{value.rows.length} 行）</Button>{expanded&&<>
   <div className="material-word-table"><table><tbody>{value.rows.slice(row,row+10).map((r,i)=><tr key={row+i}>{r.cells.slice(column,column+8).map((c,j)=><td key={column+j} colSpan={c.colSpan}><MaterialWordBlocks blocks={c.blocks} assets={assets} resource={resource}/></td>)}</tr>)}</tbody></table></div>
   {value.rows.length>10&&<div className="teacher-library-toolbar"><Button variant="ghost" isDisabled={!row} onPress={()=>setRow(Math.max(0,row-10))}>表格前10行</Button><span>第 {row+1}–{Math.min(row+10,value.rows.length)} / {value.rows.length} 行</span><Button variant="ghost" isDisabled={row+10>=value.rows.length} onPress={()=>setRow(row+10)}>表格后10行</Button></div>}
   {columns>8&&<div className="teacher-library-toolbar"><Button variant="ghost" isDisabled={!column} onPress={()=>setColumn(Math.max(0,column-8))}>表格前8列</Button><span>第 {column+1}–{Math.min(column+8,columns)} / {columns} 列</span><Button variant="ghost" isDisabled={column+8>=columns} onPress={()=>setColumn(column+8)}>表格后8列</Button></div>}
  </>}</>}
  <DisclosureCard className="material-word-anchor" bodyClassName="material-evidence-fields" headingLevel={5} data-word-part={value.anchor.part} data-word-path={value.anchor.path} title="原文件来源"><dl><div><dt>原文件</dt><dd>{resource.originalFileName}</dd></div><div><dt>文件位置</dt><dd>{/header/i.test(value.anchor.part)?'页眉':/footer/i.test(value.anchor.part)?'页脚':/footnote/i.test(value.anchor.part)?'脚注':/endnote/i.test(value.anchor.part)?'尾注':'正文'}</dd></div></dl><p>可点击上方“定位文件”打开原件对照。</p></DisclosureCard>
 </article>;
}
