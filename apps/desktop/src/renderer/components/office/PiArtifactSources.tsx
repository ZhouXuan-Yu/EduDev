import {useEffect,useRef,useState} from 'react';
import {Button,Modal} from '@heroui/react';
import {BookOpen} from 'lucide-react';
import {ARTIFACT_SOURCES_SCHEMA,type ArtifactSourcesView,type ArtifactSourceItem} from '../../../shared/artifact-sources';
import type {OfficeArtifactSource} from '../../../shared/xiaozhi-office-artifacts';
import {OfficeSourceItem} from './OfficeReplySources';
import {PiWorkspaceFiles} from './PiWorkspaceFiles';

/** Uses the original file panel with the cited version, including every retry/tab click. */
export function OfficeFileSource({source,sessionId}:{source:OfficeArtifactSource&{workspaceVersion?:string;availability?:string};sessionId:string}) {
 const [opened,setOpened]=useState<{id:string;path:string;version:string;workspaceVersion?:string}>();
 useEffect(()=>{setOpened(undefined);},[sessionId,source.path,source.version,source.workspaceVersion]);
 return <li><Button variant="ghost" className="pi-material-source" data-testid="artifact-file-source-open" onPress={()=>setOpened({id:crypto.randomUUID(),path:source.path,version:source.version,...(source.workspaceVersion?{workspaceVersion:source.workspaceVersion}:{})})}><BookOpen size={16}/>{source.kind==='parent_artifact'?'上一版产物':'绑定资料'} · {source.path}</Button>
  {source.availability&&source.availability!=='same'&&<p role="status" data-testid="artifact-file-source-state">{source.availability==='changed'?'来源文件已变化；打开时保留引用版本检查。':source.availability==='missing'?'来源文件已移走或删除，原关联保留。':'来源暂不可读取，原关联保留。'}</p>}
  {opened&&<Modal.Backdrop isOpen onOpenChange={open=>{if(!open)setOpened(undefined);}}><Modal.Container size="full" scroll="inside"><Modal.Dialog className="pi-themed-surface" data-testid="artifact-file-source-dialog">
   <Modal.Header><Modal.Heading>来源文件 · {source.path}</Modal.Heading><p>核对保存时绑定的文件版本；文件变化时不会改开当前同名文件。</p></Modal.Header><Modal.Body><PiWorkspaceFiles key={opened.id} sessionId={sessionId} reveal={opened} onClose={()=>setOpened(undefined)}/></Modal.Body>
   <Modal.Footer><Button variant="secondary" onPress={()=>setOpened(undefined)} data-testid="artifact-file-source-close">关闭</Button></Modal.Footer>
  </Modal.Dialog></Modal.Container></Modal.Backdrop>}
 </li>;
}
const relation:Record<ArtifactSourceItem['relation'],string>={declared:'保存时明确绑定的文件',paper:'确认试卷中的题目版本',classroom:'确认课堂关联的资料段落',read:'生成此成果前实际读取 · 不代表已用于成果'};
/** Click-only source projection shared by chat, selected history and Teaching Files. */
export function PiArtifactSources({sessionId,artifactId,label='成果来源',auto=false}:{sessionId:string;artifactId:string;label?:string;auto?:boolean}) {
 const [opened,setOpened]=useState(auto),[view,setView]=useState<ArtifactSourcesView>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const epoch=useRef(0),lock=useRef(false),identity=useRef('');identity.current=sessionId+':'+artifactId;
 async function load(offset=0){if(lock.current)return;const stamp=++epoch.current,key=identity.current;lock.current=true;setBusy(true);setError('');
  try {const result=await window.omniEdu?.artifactSources({schemaVersion:ARTIFACT_SOURCES_SCHEMA,sessionId,artifactId,offset});if(stamp!==epoch.current||identity.current!==key)return;
   if(!result?.ok)throw Error(result&&!result.ok&&result.error==='permission_denied'?'会话或原文件目录已不可用，请回来源对话检查。':result&&!result.ok&&result.error==='busy'?'文件记录正在处理中，请稍后重试。':'无法读取来源记录，请重试。');
   const next=result.value;if(next.schemaVersion!==ARTIFACT_SOURCES_SCHEMA||next.artifactId!==artifactId||next.sessionId!==sessionId||next.offset!==offset)throw Error('来源记录已变化，请重新读取。');
   setView(previous=>offset&&previous?{...next,items:[...previous.items,...next.items]}:next);
  }catch(reason){if(stamp===epoch.current)setError(reason instanceof Error?reason.message:'无法读取来源记录，请重试。');}
  finally{if(stamp===epoch.current){lock.current=false;setBusy(false);}}
 }
 useEffect(()=>{++epoch.current;lock.current=false;setView(undefined);setError('');setBusy(false);setOpened(auto);if(auto)void load();return()=>{++epoch.current;};},[sessionId,artifactId,auto]);
 return <section className="office-reply-sources" data-testid="artifact-sources" data-artifact-id={artifactId}>
  {!auto&&<Button size="sm" variant="ghost" aria-expanded={opened} data-testid="artifact-sources-toggle" onPress={()=>{setOpened(v=>!v);if(!opened&&!view)void load();}}><BookOpen size={15}/>{label}</Button>}
  {opened&&<div data-testid="artifact-sources-body">{busy&&<p role="status">正在读取原来源记录…</p>}{error&&<p role="alert" data-testid="artifact-sources-error">{error}</p>}
   {view&&<>{view.origin&&<p>{view.origin}</p>}{view.inheritedFrom&&<p>此恢复版的内容来源沿所选历史内容追溯。</p>}
    {view.readHistory==='unavailable'&&<p>没有可核对的生成前读取记录；不能据此认定来自教材。</p>}
    {view.total===0&&<p data-testid="artifact-sources-empty">此成果没有可定位的来源记录；请核对原内容，不据此认定为教材引用。</p>}
    {view.items.map((item,index)=><div key={index}><p>{relation[item.relation]}</p><ul>{item.file?<OfficeFileSource source={item.file} sessionId={sessionId}/>:item.source?<OfficeSourceItem source={item.source} sessionId={sessionId}/>:<li>旧来源记录不可读取。</li>}</ul></div>)}
    {view.nextOffset!==null&&<Button size="sm" variant="ghost" isDisabled={busy} data-testid="artifact-sources-more" onPress={()=>void load(view.nextOffset!)}>加载更多来源（已显示{view.items.length}/{view.total}）</Button>}
   </>}
   <Button size="sm" variant="ghost" isDisabled={busy} data-testid="artifact-sources-refresh" onPress={()=>void load()}>重新读取来源记录</Button>
  </div>}
 </section>;
}
