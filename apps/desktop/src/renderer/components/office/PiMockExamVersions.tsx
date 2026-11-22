import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {type MockExamCatalog,type MockExamCatalogKey,type MockExamHistoryEntry} from '../../../shared/mock-exam-compilation';
import styles from '../../ui-system/mock-exam-catalog.module.css';

export function PiMockExamVersions({identity,current,blocked,onRestore}:{identity:MockExamCatalogKey;current:MockExamCatalog['summary'];
  blocked:boolean;onRestore:(catalog:MockExamCatalog)=>Promise<void>}){
  const [open,setOpen]=useState(false),[history,setHistory]=useState<MockExamHistoryEntry[]>(),[reload,setReload]=useState(0);
  const [preview,setPreview]=useState<MockExamCatalog>(),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [restoring,setRestoring]=useState(false);
  const ticket=useRef(0),lock=useRef(false);

  useEffect(()=>{
    if(!open)return;
    let live=true;
    setError('');setHistory(undefined);setPreview(undefined);setLoading(false);
    void (async()=>{
      try{
        const result=await window.omniEdu?.listMockExamHistory(identity);
        if(!live)return;
        if(result?.ok)setHistory(result.value);
        else setError(result?.message||'目录历史暂时无法读取。');
      }catch{if(live)setError('目录历史暂时无法读取。');}
    })();
    return()=>{live=false;ticket.current++;};
  },[open,current.revision,identity.id,identity.sessionId,reload]);

  async function read(version:MockExamHistoryEntry){
    const stamp=++ticket.current;
    setLoading(true);setError('');setPreview(undefined);
    try{
      const result=await window.omniEdu?.reviewMockExamCatalog({...identity,revision:version.revision});
      if(stamp!==ticket.current)return;
      if(result?.ok&&result.value.summary.digest===version.digest)setPreview(result.value);
      else setError(result&&!result.ok?result.message:'目录版本已变化，请重新读取。');
    }catch{if(stamp===ticket.current)setError('这份历史版本暂时无法读取。');}
    finally{if(stamp===ticket.current)setLoading(false);}
  }

  async function restore(){
    if(blocked||lock.current||!preview)return;
    lock.current=true;setRestoring(true);setError('');
    try{
      const result=await window.omniEdu?.restoreMockExamVersion({...identity,revision:current.revision,digest:current.digest,
        sourceRevision:preview.summary.revision,sourceDigest:preview.summary.digest});
      if(result?.ok)await onRestore(result.value);
      else setError(result?.message||'历史恢复未保存。');
    }catch{setError('暂时无法核对恢复结果，请重新读取。');}
    finally{lock.current=false;setRestoring(false);}
  }

  return <details className={styles.versions} data-testid="mock-exam-versions" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>目录版本历史</summary>
    {open&&<>
      {!history&&!error&&<p role="status">正在读取版本历史…</p>}
      {history&&<ol aria-label="目录版本列表">{history.map(version=><li key={version.revision}>
        <span>第 {version.revision} 版 · {version.state==='confirmed'?'已确认':'待核对'} · {version.count} 份
          {version.restoredFrom?` · 恢复自第 ${version.restoredFrom} 版`:''}</span>
        {version.revision===current.revision?<small>当前版本</small>:<Button size="sm" variant="ghost" isDisabled={restoring}
          data-testid={`mock-exam-view-version-${version.revision}`} onPress={()=>void read(version)}>查看历史</Button>}
      </li>)}</ol>}
      {loading&&<p role="status">正在打开历史版本…</p>}
      {preview&&<section className={styles.historyPreview} data-testid="mock-exam-history-preview" aria-label="历史目录只读预览">
        <h4>第 {preview.summary.revision} 版 · 历史只读</h4>
        <ul className={styles.entries}>{preview.entries.map(entry=><li className={styles.entry} key={entry.resourceId}>
          <strong>{entry.title}</strong>
          <span>{[entry.metadata.district,entry.metadata.year,entry.metadata.grade,entry.metadata.subject,entry.metadata.round]
            .map(value=>value??'待核对').join(' · ')} · {entry.include?'已收录':'未收录'}</span>
        </li>)}</ul>
        <p>恢复会创建一份待核对的新版本，使用许可沿用当前设置。</p>
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" isDisabled={restoring} onPress={()=>setPreview(undefined)}>关闭历史预览</Button>
          <Button size="sm" variant="secondary" isDisabled={blocked||restoring} data-testid="mock-exam-restore-version"
            onPress={()=>void restore()}>{restoring?'正在复核原件…':'从此版本恢复'}</Button>
        </div>
      </section>}
      {error&&<p role="alert">{error} <Button size="sm" variant="ghost" onPress={()=>{setLoading(false);setReload(value=>value+1);}}>重新读取</Button></p>}
    </>}
  </details>;
}
