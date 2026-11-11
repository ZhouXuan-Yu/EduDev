import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Button,SearchField} from '@heroui/react';
import {ClassroomWorkspace} from './ClassroomWorkspace';
import {TeachingDeliveryWorkspace} from './TeachingDeliveryWorkspace';
import {FileText,FolderOpen,MessageSquare,RefreshCw} from 'lucide-react';
import {ResourceTable} from '../../ui-system/ResourceTable';
import type {TeachingFileCatalogEntry} from '../../../shared/contracts';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {PiWorkspaceFiles} from '../office/PiWorkspaceFiles';
import {SavedArtifactPreview} from '../office/SavedArtifactPreview';
import {PiOfficeVersions,PiOfficeCurrent} from '../office/PiOfficeVersions';
import {PiDeliveryCheck} from '../office/PiDeliveryCheck';
import {PiArtifactSources} from '../office/PiArtifactSources';
import {OfficeMarkdown as Markdown} from '../office/OfficeMarkdown';
import {LibraryEmpty} from './LibraryEmpty';
import {libraryDate,libraryFileSize,matchesMaterial} from './material-library';
import alignment from '../../ui-system/teaching-catalogue-alignment.module.css';

/** Read existing durable artifact facts; preview uses the same authorized host. */
export function TeachingArtifactsWorkspace() {
  const [view,setView]=useState<'files'|'deliveries'|'classrooms'>('files');
  const [visited,setVisited]=useState({deliveries:false,classrooms:false});
  function show(next:typeof view){
    setView(next);
    if(next!=='files')setVisited(current=>({...current,[next]:true}));
  }
  const links=<nav className={alignment.links} aria-label="教学内容">
    {view!=='files'&&<Button variant="ghost" onPress={()=>show('files')} data-testid="teaching-files-tab">返回教学文件</Button>}
    <Button variant="ghost" aria-current={view==='deliveries'?'page':undefined} onPress={()=>show('deliveries')} data-testid="teaching-deliveries-tab">整包任务</Button>
    <Button variant="ghost" aria-current={view==='classrooms'?'page':undefined} onPress={()=>show('classrooms')} data-testid="teaching-classrooms-tab">课堂设计与预演</Button>
  </nav>;
  return <div className={alignment.frame}>
    {view!=='files'&&links}
    <div className={alignment.pane} hidden={view!=='files'}><TeachingFilesWorkspace auxiliaryActions={view==='files'?links:undefined}/></div>
    {visited.deliveries&&<div className={alignment.pane} hidden={view!=='deliveries'}><TeachingDeliveryWorkspace/></div>}
    {visited.classrooms&&<div className={alignment.pane} hidden={view!=='classrooms'}><ClassroomWorkspace/></div>}
  </div>;
}
function TeachingFilesWorkspace({auxiliaryActions}:{auxiliaryActions?:ReactNode}) {
  const navigation=useDesktopNavigation();const [rows,setRows]=useState<TeachingFileCatalogEntry[]>([]),[query,setQuery]=useState(''),[selected,setSelected]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [reveal,setReveal]=useState<{id:string;path:string}>();const epoch=useRef(0);
  async function load(){const stamp=++epoch.current;setLoading(true);setError('');try{const result=await window.omniEdu?.listDocumentArtifacts();if(!result)throw new Error();if(stamp===epoch.current){setRows(result);setReveal(undefined);}}catch{if(stamp===epoch.current)setError('无法读取教学文件，请重试。');}finally{if(stamp===epoch.current)setLoading(false);}}
  useEffect(()=>{void load();return()=>{++epoch.current;};},[]);
  const visible=rows.filter(row=>!row.officeVersion||row.officeVersion.currentArtifactId===row.id);
  const filtered=visible.filter(row=>matchesMaterial(query,row.title,row.fileName,row.type)),artifact=filtered.find(row=>(row.officeVersion?.familyId||row.id)===selected);
  async function locate(){if(!artifact||busy)return;setBusy(true);setError('');setNotice('');try{if(!window.omniEdu)throw new Error();await window.omniEdu.showDocumentArtifact(artifact.id);setNotice('已在文件夹中定位教学文件。');}catch{setError('无法定位教学文件，请检查文件是否仍存在。');}finally{setBusy(false);}}
  function select(id:string){const row=rows.find(r=>r.id===id);setSelected(row?.officeVersion?.familyId||id);setReveal(undefined);setNotice('');setError('');}
  return <section className={alignment.workspace} data-edu-domain="" data-testid="teaching-artifacts-workspace" aria-label="教学文件">
    <header className={alignment.heading}><div><h1>教学文件</h1><p>打开已有成果继续使用，或请小智制作新的教学文件。</p></div><div className={alignment.links}>{auxiliaryActions}<Button onPress={()=>navigation.navigate({view:'ai'})}><MessageSquare size={17}/>请小智制作</Button></div></header>
    <div className={alignment.toolbar}><SearchField aria-label="按教学文件名称或格式查找" value={query} onChange={value=>{setQuery(value);setReveal(undefined);}} className={alignment.search} variant="secondary"><SearchField.Group><SearchField.SearchIcon/><SearchField.Input placeholder="查找教学文件或格式" maxLength={128} data-testid="artifacts-search"/><SearchField.ClearButton aria-label="清除教学文件查找"/></SearchField.Group></SearchField>
      <Button variant="ghost" onPress={()=>void load()} isDisabled={loading||busy} data-testid="artifacts-refresh"><RefreshCw size={16}/>刷新</Button></div>
    {error&&<p role="alert" className={alignment.error} data-testid="artifacts-error">{error}</p>}{notice&&<p role="status" className={alignment.notice}>{notice}</p>}
    <p className={alignment.count}>{loading?'正在读取教学文件…':`${filtered.length} 份当前教学文件 · 文档与HTML各取最近100条保存记录及对应当前版本 · 旧版保留在版本历史`}</p>
    <div className={alignment.columns} data-detail-open={Boolean(artifact)}>
      <ResourceTable className={alignment.catalogue} label="教学文件列表" rows={filtered.map(row=>({id:row.id,title:row.title,description:(row.htmlVersion?(row.htmlVersion.savedAt?libraryDate(row.htmlVersion.savedAt):row.htmlVersion.verifiedAt?'保存时间未知 · 已核验':'保存时间未知'):libraryDate(row.updatedAt))+' · '+libraryFileSize(row.fileSize)+(row.officeVersion?` · 当前第 ${row.officeVersion.version} 版`:''),type:row.type.toUpperCase(),state:row.status==='exported'?'已保存':row.status==='failed'?'保存失败':'未保存'}))} selected={artifact?.id} onSelect={select} testPrefix="artifact" empty={loading?<p role="status">正在读取教学文件…</p>:<LibraryEmpty title={query?'没有匹配的教学文件':'还没有教学文件'} description={query?'换个名称或格式，或清除查找条件。':'请小智制作讲义、试卷或课件。确认保存后会出现在这里。'}/>}/>
      <section className={alignment.detail} hidden={!artifact} data-testid="artifacts-detail" aria-label="教学文件内容">
        <Button variant="ghost" onPress={()=>{setSelected('');setReveal(undefined);}} data-testid="artifacts-back">返回文件列表</Button>
        {artifact?<><header><div><h2>{artifact.title}</h2><p>{artifact.fileName}</p></div></header><div className={alignment.actions}>
          {artifact.officeVersion?<PiOfficeCurrent key={artifact.id+'preview'} sessionId={artifact.sessionId} artifactId={artifact.id} fallbackPath={artifact.fileName} onOpen={path=>setReveal({id:crypto.randomUUID(),path})} label="预览当前文件" testId="artifacts-preview"/>:<Button variant="secondary" isDisabled={artifact.status!=='exported'||!artifact.sessionId} onPress={()=>setReveal({id:crypto.randomUUID(),path:artifact.fileName})} data-testid="artifacts-preview">预览文件</Button>}
          {artifact.officeVersion?<><PiOfficeCurrent key={artifact.id+'open'} sessionId={artifact.sessionId} artifactId={artifact.id} fallbackPath={artifact.fileName} onOpen={()=>{}} action="open" label="系统打开" testId="artifacts-open"/><PiOfficeCurrent key={artifact.id+'locate'} sessionId={artifact.sessionId} artifactId={artifact.id} fallbackPath={artifact.fileName} onOpen={()=>{}} action="locate" label="定位当前文件" testId="artifacts-locate"/></>:<Button variant="ghost" isDisabled={busy||artifact.status!=='exported'} onPress={()=>void locate()} data-testid="artifacts-locate"><FolderOpen size={16}/>定位文件</Button>}
          <Button variant="ghost" isDisabled={!artifact.sessionId} onPress={()=>navigation.navigate({view:'ai',sessionId:artifact.sessionId})} data-testid="artifacts-conversation"><MessageSquare size={16}/>查看来源对话</Button></div>
          {artifact.status==='exported'&&artifact.sessionId&&['pptx','docx','pdf','xlsx','html'].includes(artifact.type)&&<PiOfficeVersions key={artifact.id} sessionId={artifact.sessionId} artifactId={artifact.id} onOpen={path=>setReveal({id:crypto.randomUUID(),path})} onRefresh={load}/>}
          {artifact.status==='exported'&&artifact.officeVersion&&<PiDeliveryCheck key={artifact.id+':checks'} sessionId={artifact.sessionId} path={artifact.fileName} artifactId={artifact.id}/>}
          {artifact.status==='exported'&&artifact.officeVersion&&<PiArtifactSources key={artifact.id+':sources'} sessionId={artifact.sessionId} artifactId={artifact.id}/>}
          {reveal?<div className={`${alignment.preview} pi-themed-surface`}>{artifact.savedArtifactKind==='paper'&&!artifact.officeVersion&&!artifact.htmlVersion&&['docx','pdf'].includes(artifact.type)?<SavedArtifactPreview key={artifact.sessionId+':'+artifact.id+':'+reveal.id} sessionId={artifact.sessionId} artifactId={artifact.id} onClose={()=>setReveal(undefined)}/>:<PiWorkspaceFiles key={artifact.sessionId+':'+artifact.id} sessionId={artifact.sessionId} reveal={reveal} onChoose={()=>setError('请在来源对话中选择教学工作目录，再返回这里预览。')} onClose={()=>setReveal(undefined)}/>}</div>:<><p className={alignment.caption}>{artifact.htmlVersion?'HTML内容按需预览；历史和保存时间来自原修改记录。':'保存时的内容 · 预览文件可查看当前本地版本'}</p><Markdown components={{img:({alt})=><span>［图片：{alt||'未加载'}］</span>,a:({children})=><span>{children}</span>}}>{artifact.contentMd||(artifact.htmlVersion?'点击“预览当前文件”查看，或展开版本历史对照先前内容。':'没有保存内容摘要，请定位查看文件。')}</Markdown></>}
        </>:<LibraryEmpty title="选择一份教学文件" description="查看内容、预览当前文件，或回到制作时的对话继续修改。"/>}
      </section>
    </div>
  </section>;
}
