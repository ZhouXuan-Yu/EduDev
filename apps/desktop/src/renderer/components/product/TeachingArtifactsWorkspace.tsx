import {useEffect,useRef,useState} from 'react';
import {Button,SearchField} from '@heroui/react';
import {FileText,FolderOpen,MessageSquare,RefreshCw} from 'lucide-react';
import {ListView} from '../../heroui-pro/components/list-view';
import type {DocumentArtifactExportResult} from '../../../shared/contracts';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {PiWorkspaceFiles} from '../office/PiWorkspaceFiles';
import {Markdown} from '../../heroui-pro/components/markdown';
import {LibraryEmpty} from './LibraryEmpty';
import {libraryDate,libraryFileSize,matchesMaterial} from './material-library';
import './teacher-library.css';

/** Read existing durable artifact facts; preview uses the same authorized host. */
export function TeachingArtifactsWorkspace() {
  const navigation=useDesktopNavigation();const [rows,setRows]=useState<DocumentArtifactExportResult[]>([]),[query,setQuery]=useState(''),[selected,setSelected]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [reveal,setReveal]=useState<{id:string;path:string}>();const epoch=useRef(0);
  async function load(){const stamp=++epoch.current;setLoading(true);setError('');try{const result=await window.omniEdu?.listDocumentArtifacts();if(!result)throw new Error();if(stamp===epoch.current)setRows(result);}catch{if(stamp===epoch.current)setError('无法读取教学文件，请重试。');}finally{if(stamp===epoch.current)setLoading(false);}}
  useEffect(()=>{void load();return()=>{++epoch.current;};},[]);
  const filtered=rows.filter(row=>matchesMaterial(query,row.title,row.fileName,row.type)),artifact=filtered.find(row=>row.id===selected);
  async function locate(){if(!artifact||busy)return;setBusy(true);setError('');setNotice('');try{if(!window.omniEdu)throw new Error();await window.omniEdu.showDocumentArtifact(artifact.id);setNotice('已在文件夹中定位教学文件。');}catch{setError('无法定位教学文件，请检查文件是否仍存在。');}finally{setBusy(false);}}
  function select(id:string){setSelected(id);setReveal(undefined);setNotice('');setError('');}
  return <section className="teacher-library" data-testid="teaching-artifacts-workspace" aria-label="教学文件">
    <header className="teacher-library-heading"><div><h1>教学文件</h1><p>小智生成并保存的文档，随时重新查看和使用。</p></div><Button variant="secondary" onPress={()=>navigation.navigate({view:'ai'})}><MessageSquare size={17}/>请小智制作</Button></header>
    <div className="teacher-library-toolbar"><SearchField aria-label="按教学文件名称或格式查找" value={query} onChange={value=>{setQuery(value);setReveal(undefined);}} className="teacher-library-search" variant="secondary"><SearchField.Group><SearchField.SearchIcon/><SearchField.Input placeholder="查找教学文件或格式" maxLength={128} data-testid="artifacts-search"/><SearchField.ClearButton aria-label="清除教学文件查找"/></SearchField.Group></SearchField>
      <Button variant="ghost" onPress={()=>void load()} isDisabled={loading||busy} data-testid="artifacts-refresh"><RefreshCw size={16}/>刷新</Button></div>
    {error&&<p role="alert" className="teacher-library-error" data-testid="artifacts-error">{error}</p>}{notice&&<p role="status" className="teacher-library-notice">{notice}</p>}
    <p className="teacher-library-count">{loading?'正在读取教学文件…':`${filtered.length} 份教学文件${rows.length===100?' · 显示最近100份':' · 来自所有对话'}`}</p>
    <div className="teacher-library-grid">
      <ListView aria-label="教学文件列表" className="teacher-library-list" selectionMode="single" selectionBehavior="replace" disallowEmptySelection selectedKeys={new Set(artifact?[artifact.id]:[])} onSelectionChange={keys=>{if(keys!=='all')select(String([...keys][0]||''));}} renderEmptyState={()=>loading?<p role="status">正在读取教学文件…</p>:<LibraryEmpty title={query?'没有匹配的教学文件':'还没有教学文件'} description={query?'换个名称或格式，或清除查找条件。':'请小智制作讲义、试卷或课件。确认保存后会出现在这里。'}/>}>
        {filtered.map(row=><ListView.Item id={row.id} key={row.id} textValue={row.title} data-testid={`artifact-${row.id}`}><FileText size={19}/><ListView.ItemContent><ListView.Title>{row.title}</ListView.Title><ListView.Description>{row.type.toUpperCase()} · {libraryDate(row.updatedAt)} · {libraryFileSize(row.fileSize)}</ListView.Description></ListView.ItemContent><span className="teacher-library-state" data-tone={row.status==='exported'?'ready':row.status==='failed'?'error':'waiting'}>{row.status==='exported'?'已保存':row.status==='failed'?'保存失败':'未保存'}</span></ListView.Item>)}
      </ListView>
      <section className="teacher-library-detail" data-testid="artifacts-detail" aria-label="教学文件内容">
        {artifact?<><header><div><h2>{artifact.title}</h2><p>{artifact.fileName}</p></div></header><div className="teacher-library-detail-actions">
          <Button variant="secondary" isDisabled={artifact.status!=='exported'||!artifact.sessionId} onPress={()=>setReveal({id:crypto.randomUUID(),path:artifact.fileName})} data-testid="artifacts-preview">预览文件</Button>
          <Button variant="ghost" isDisabled={busy||artifact.status!=='exported'} onPress={()=>void locate()} data-testid="artifacts-locate"><FolderOpen size={16}/>定位文件</Button>
          <Button variant="ghost" isDisabled={!artifact.sessionId} onPress={()=>navigation.navigate({view:'ai',sessionId:artifact.sessionId})} data-testid="artifacts-conversation"><MessageSquare size={16}/>查看来源对话</Button></div>
          {reveal?<div className="teacher-artifact-preview pi-themed-surface"><PiWorkspaceFiles sessionId={artifact.sessionId} reveal={reveal} onChoose={()=>setError('请在来源对话中选择教学工作目录，再返回这里预览。')} onClose={()=>setReveal(undefined)}/></div>:<><p className="teacher-library-caption">保存时的内容 · 预览文件可查看当前本地版本</p><Markdown components={{img:({alt})=><span>［图片：{alt||'未加载'}］</span>,a:({children})=><span>{children}</span>}}>{artifact.contentMd||'没有保存内容摘要，请定位查看文件。'}</Markdown></>}
        </>:<LibraryEmpty title="选择一份教学文件" description="查看内容、预览当前文件，或回到制作时的对话继续修改。"/>}
      </section>
    </div>
  </section>;
}
