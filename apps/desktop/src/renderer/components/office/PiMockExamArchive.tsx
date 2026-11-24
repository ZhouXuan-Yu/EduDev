import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {MOCK_EXAM_ARCHIVE_SCHEMA,mockExamArchiveOmissions,type MockExamArchiveItem,type MockExamArchivePreview,type SavedMockExamArchive} from '../../../shared/mock-exam-archive';
import type {MockExamCatalogSummary} from '../../../shared/mock-exam-compilation';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import styles from '../../ui-system/mock-exam-catalog.module.css';

const decision=(item:MockExamArchiveItem)=>item.path?(item.shared?'共用文件，入包一次':'入包'):item.omission?mockExamArchiveOmissions[item.omission]:'待核对';

export function PiMockExamArchive({catalog,sessionId}:{catalog:MockExamCatalogSummary;sessionId:string}){
  const navigation=useDesktopNavigation(),lock=useRef(false),live=useRef(true);
  const [plan,setPlan]=useState<MockExamArchivePreview>(),[saved,setSaved]=useState<SavedMockExamArchive>();
  const [busy,setBusy]=useState(false),[issue,setIssue]=useState('');
  const key={schemaVersion:MOCK_EXAM_ARCHIVE_SCHEMA,sessionId,catalogId:catalog.id,revision:catalog.revision,digest:catalog.digest} as const;
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  async function run(action:'preview'|'save'){
    if(lock.current||action==='save'&&!plan)return;
    lock.current=true;setBusy(true);setIssue('');
    try{
      const api=window.omniEdu;
      if(!api)throw Error('unavailable');
      if(action==='preview'){
        const response=await api.previewMockExamArchive(key);
        if(live.current){if(response.ok)setPlan(response.value);else setIssue(response.message);}
      }else if(plan){
        const response=await api.saveMockExamArchive({...key,previewDigest:plan.previewDigest});
        if(live.current){
          if(response.ok){setSaved(response.value);setPlan(undefined);}
          else {setIssue(response.message);if(['version_conflict','source_changed','not_confirmed'].includes(response.error))setPlan(undefined);}
        }
      }
    }catch{if(live.current)setIssue('暂时无法处理原件包，请重试。');}
    finally{lock.current=false;if(live.current)setBusy(false);}
  }
  return <div data-testid="mock-exam-archive" className={styles.review}>
    {!plan&&!saved&&<Button size="sm" variant="secondary" isDisabled={busy} onPress={()=>void run('preview')}
      data-testid="mock-exam-archive-preview">预览原件包</Button>}
    {plan&&<section aria-label="原件包预览" data-testid="mock-exam-archive-plan">
      <p>第 {plan.revision} 版 · {plan.paperCount} 份试卷 · {plan.answerCount} 份独立答案册</p>
      {plan.embeddedCount>0&&<p>{plan.embeddedCount} 份试卷含卷内答案，随原件保存。</p>}
      <p>{plan.paperCount?'ZIP 将保存到教学文件，仅限本地使用。':'没有可入包的试卷。可在目录里核对原件使用许可。'}</p>
      <ul className={styles.entries} tabIndex={0} aria-label="入包及排除记录">
        {plan.entries.map(({district,round,paper,answer})=><li key={paper.resourceId} className={styles.entry}>
          <strong>{district} · {round}</strong>
          <span>{paper.title} · {decision(paper)}</span>
          <span>{answer.title} · {decision(answer)}</span>
        </li>)}
      </ul>
      <div className={styles.actions}>
        <Button size="sm" variant="primary" isDisabled={busy||!plan.paperCount} onPress={()=>void run('save')}
          data-testid="mock-exam-archive-save">确认保存 ZIP</Button>
        <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>{setPlan(undefined);setIssue('');}}>取消预览</Button>
      </div>
    </section>}
    {busy&&<p role="status">{plan?'正在核对并保存原件…':'正在读取本地许可…'}</p>}
    {issue&&<p role="alert">{issue}</p>}
    {saved&&<div className={styles.actions}>
      <span role="status" data-testid="mock-exam-archive-saved">已保存 {saved.fileName}</span>
      <Button size="sm" variant="secondary" onPress={()=>navigation.navigate({view:'artifacts',artifactId:saved.artifactId})}>在教学文件查看</Button>
    </div>}
  </div>;
}
