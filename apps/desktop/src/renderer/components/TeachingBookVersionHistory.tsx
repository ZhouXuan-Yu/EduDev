import {useEffect,useState} from 'react';
import {Button,Modal} from '@heroui/react';
import type {TeachingBookVersionHistory,TeachingBookVersionPreview,TeachingBookVersionResult} from '../../shared/teaching-book-version';
import {TeachingHandoutPreview} from './TeachingHandoutPreview';
import {DisclosureCard} from './ui/DisclosureCard';
import styles from '../ui-system/teaching-book-version.module.css';

const versionLabels={confirmed:'教师已确认',before_restore:'恢复前保留',restored_draft:'恢复草稿'};
const unavailable='讲义版本暂时无法读取，请重试。';
function value<T>(result:TeachingBookVersionResult<T>|undefined):T {
  if(!result?.ok)throw Error(result?.message??unavailable);
  return result.value;
}

export function TeachingBookVersionHistory({bookId,digest,disabled,archived,sourceChanged,onChanged}:{
  bookId:string; digest:string; disabled:boolean; archived:boolean; sourceChanged:boolean;
  onChanged:(action:'confirm'|'restore')=>Promise<void>;
}) {
  const [history,setHistory]=useState<TeachingBookVersionHistory>();
  const [review,setPreview]=useState<{entry:TeachingBookVersionPreview;baseDigest:string}>();
  const preview=review?.entry;
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let live=true;
    setHistory(undefined);
    window.omniEdu?.listTeachingBookVersions(bookId).then(result=>{
      if(live)setHistory(value(result));
    }).catch(error=>{if(live)setError(error.message||unavailable);});
    return()=>{live=false;};
  },[bookId,digest,reload]);

  async function run(action:()=>Promise<void>){
    setWorking(true);
    setError('');
    try{await action();}
    catch(error){setError(error instanceof Error?error.message:unavailable);}
    finally{setWorking(false);}
  }
  function open(versionId?:string){
    void run(async()=>{
      const entry=value(await window.omniEdu?.previewTeachingBookVersion({bookId,...(versionId?{versionId}:{})}));
      if(!versionId&&entry.digest!==digest)throw Error('当前草稿已变化，请刷新讲义后核对。');
      setPreview({entry,baseDigest:digest});
    });
  }
  function decide(){
    if(!review||!preview||disabled||archived)return;
    void run(async()=>{
      const action=preview.version?'restore':'confirm';
      if(preview.version)value(await window.omniEdu?.restoreTeachingBookVersion({bookId,currentDigest:review.baseDigest,versionId:preview.version.id,versionDigest:preview.digest}));
      else value(await window.omniEdu?.confirmTeachingBookVersion({bookId,digest:preview.digest}));
      setPreview(undefined);
      await onChanged(action);
      setReload(count=>count+1);
    });
  }
  const confirmed=history?.currentConfirmed?.digest===digest?history.currentConfirmed:undefined;
  const status=archived?'已归档':sourceChanged?'引用已变化，待重新核对':confirmed
    ?`第 ${confirmed.revision} 版已确认`:history?'当前草稿待确认':'正在读取版本状态…';
  const revisions=new Map(history?.versions.map(item=>[item.id,item.revision]));
  const visibleError=error&&<p role="alert" data-testid="teaching-book-version-error">{error}</p>;
  function loadOlder(before:number){
    void run(async()=>{
      const older=value(await window.omniEdu?.listTeachingBookVersions(bookId,before));
      setHistory(old=>({...older,versions:[...(old?.versions??[]),...older.versions]}));
    });
  }
  return <section className="work-panel" aria-label="讲义确认与版本" data-testid="teaching-book-versions">
    <div className="panel-heading">
      <div><h3>确认与版本</h3><p className="muted" role="status" data-testid="teaching-book-version-status">{status}</p></div>
      {!archived&&!confirmed&&<Button size="sm" variant="secondary" isDisabled={disabled||working} data-testid="teaching-book-review-current" onPress={()=>open()}>核对当前草稿</Button>}
    </div>
    {!preview&&visibleError}
    {error&&!history&&!working&&<Button size="sm" variant="ghost" onPress={()=>{setError('');setReload(count=>count+1);}}>重新读取版本</Button>}
    <DisclosureCard title="历史版本" data-testid="teaching-book-version-disclosure">
      {history&&history.total===0&&<p className="muted">首次确认后，可以在这里查看版本。</p>}
      {history?.versions.map(item=><div className="edu-plan-history-row" key={item.id}>
        <div><strong>第 {item.revision} 版 · {item.title}</strong>
          <p className="edu-plan-muted">{versionLabels[item.kind]}{item.restoredFrom&&revisions.has(item.restoredFrom)&&` · 来自第 ${revisions.get(item.restoredFrom)} 版`}</p></div>
        <Button size="sm" variant="secondary" isDisabled={working} data-testid={`teaching-book-version-open-${item.revision}`} onPress={()=>open(item.id)}>查看正文</Button>
      </div>)}
      {history&&history.total>history.versions.length&&history.versions.length>0&&<Button variant="ghost"
        isDisabled={working} onPress={()=>loadOlder(history.versions.at(-1)!.revision)}>加载更早版本</Button>}
    </DisclosureCard>
    {preview&&<Modal.Backdrop isOpen isDismissable={!working} isKeyboardDismissDisabled={working} onOpenChange={open=>{if(!open&&!working){setPreview(undefined);setError('');}}}>
      <Modal.Container className={styles.container} scroll="inside">
        <Modal.Dialog className="pi-themed-surface" data-testid="teaching-book-version-dialog">
          <Modal.Header>
            <Modal.Heading>{preview.title}</Modal.Heading>
            <p className="edu-plan-muted">{preview.version?`第 ${preview.version.revision} 版 · ${versionLabels[preview.version.kind]}`:'当前草稿 · 确认后保存此版本'}</p>
          </Modal.Header>
          <Modal.Body>
            <div className={styles.document} data-testid="teaching-book-version-preview">
              <TeachingHandoutPreview markdown={preview.markdown.replace(/^# [^\r\n]*(?:\r?\n)+/u,'')}/>
            </div>
            {!!preview.sourceTitles.length&&<p className="muted">来源 {preview.sourceTitles.join('、')}</p>}
            {!!preview.patchCount&&<p className="muted">该版保留 {preview.patchCount} 条局部修改记录。</p>}
            {preview.version&&preview.digest!==digest&&!archived&&<p className="muted">恢复会先保存当前草稿，再把这个版本放回编辑器，等待重新确认。</p>}
            {visibleError}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" isDisabled={working} onPress={()=>{setPreview(undefined);setError('');}}>关闭</Button>
            {!archived&&preview.digest!==confirmed?.digest&&(!preview.version||preview.digest!==digest)&&<Button
              data-testid={preview.version?'teaching-book-version-restore':'teaching-book-version-confirm'}
              isDisabled={disabled||working} isPending={working} onPress={decide}>
              {preview.version?'恢复为新草稿':'确认这一版'}
            </Button>}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>}
  </section>;
}
