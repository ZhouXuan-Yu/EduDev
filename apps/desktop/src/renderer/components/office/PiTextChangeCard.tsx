import { useEffect, useState } from 'react';
import { Button, Tabs } from '@heroui/react';
import { FilePenLine } from 'lucide-react';
import { ChatTool } from '../../heroui-pro/components/chat-tool';
import { CodeBlock } from '../../heroui-pro/components/code-block';
import { useOfficeControlState } from './OfficeComposerState';
import type { XiaozhiChangeDecision, XiaozhiChangeSummary, XiaozhiChangeReview, XiaozhiChangeError, XiaozhiChangeState } from '../../../shared/xiaozhi-changes';
import './pi-text-changes.css';
import {ScienceDemoFrame} from './ScienceDemoFrame';
import {PiOfficeCurrent,PiOfficeVersions} from './PiOfficeVersions';

const labels: Record<XiaozhiChangeState, string> = { pending: '需要你的确认', approved: '已批准，等待保存', executing: '正在保存',
  applied: '已保存并核验', rejected: '已拒绝，未写入', interrupted: '确认已失效，未继续写入', uncertain: '执行中断，需要核验',
  conflict: '文件版本已变化，未覆盖', reverting: '正在撤销', reverted: '已撤销并核验', undo_uncertain: '撤销中断，需要核验', undo_conflict: '文件已另行修改，未撤销' };
const errors: Record<XiaozhiChangeError, string> = { file_writes_disabled:'小智自动文件生成已暂停；已有文件和记录仍可读取。',invalid_input: '这次操作无效，请刷新后重试。', permission_denied: '确认或目录授权已失效，请刷新后检查。',
  conflict: '记录或文件版本已变化，请刷新后检查。', busy: '有任务正在运行，请结束后再操作。', configuration: '暂时无法读取或提交修改，请重试。' };

/** Original Pro disclosure/code block; complete differences stay local and on demand. */
export function PiTextChangeCard({ change, sessionId, running, onRefresh, onOpen, bundled=false, onReadiness }: {
  bundled?:boolean;onReadiness?:(id:string,ready:boolean)=>void;change: XiaozhiChangeSummary; sessionId: string; running: boolean; onRefresh: () => Promise<void>; onOpen: (path: string) => void;
}) {
  const { draft, update, lock } = useOfficeControlState(`text-change:${change.id}`);
  const [review, setReview] = useState<XiaozhiChangeReview>(), [reading, setReading] = useState(false);
  const [expanded, setExpanded] = useState(change.state === 'pending');
  const [tab, setTab] = useState('changes');
  const [readRevision, setReadRevision] = useState(0);
  useEffect(() => {
    if (!expanded) return;
    let live = true; setReading(true); setReview(undefined);
    void window.omniEdu?.reviewXiaozhiChange({ sessionId, changeId: change.id }).then(result => {
      if (!live) return;
      if (result?.ok && result.value.id === change.id && result.value.revision === change.revision) { setReview(result.value); update({error:''}); }
      else update({ error: result && !result.ok ? errors[result.error] : '修改记录已更新，请刷新后重试。' });
    }).catch(() => { if (live) update({error:'无法读取本地修改，请重试。'}); }).finally(() => { if (live) setReading(false); });
    return () => { live = false; };
  }, [sessionId, change.id, change.revision, expanded, readRevision]);
  async function decide(action: XiaozhiChangeDecision['action']) {
    if (lock.current) return; lock.current = true; update({busy:true,error:''});
    try {
      const result = await window.omniEdu?.decideXiaozhiChange({ schemaVersion:'xiaozhi.change.v1',sessionId,changeId:change.id,revision:change.revision,action });
      if (!result?.ok) update({error:result?errors[result.error]:'修改没有提交，请重试。'});
      await onRefresh();
    } catch { update({error:'修改状态未能确认，请刷新后检查。'}); }
    finally { lock.current = false; update({busy:false}); }
  }
  useEffect(()=>{onReadiness?.(change.id,!!review&&review.revision===change.revision&&!reading&&!draft.busy);},[change.id,change.revision,review,reading,draft.busy,onReadiness]);
  const pending = change.state === 'pending', uncertain = ['uncertain','undo_uncertain'].includes(change.state);
  const science = /\.(html|svg)$/i.test(change.path);
  const state = pending || uncertain ? 'requires-action' : ['approved','executing','reverting'].includes(change.state) ? 'input-available'
    : ['applied','reverted'].includes(change.state) ? 'output-available' : 'output-error';
  const currentFile = review?.currentFile;
  const currentText = currentFile?.state === 'readable' ? currentFile.content : currentFile?.state === 'missing' ? '当前文件不存在或位置已变化。原内容与小智提议仍保留。'
    : currentFile?.state === 'unavailable' ? currentFile.reason === 'too_large' ? '当前文件超过64KiB，未读取或截断。请从工作区查看。'
      : currentFile.reason === 'permission_denied' ? '当前文件不可读取或已超出授权范围。原内容与提议仍保留。' : '当前文件暂时无法作为文本读取。原内容与提议仍保留。' : '';
  const tabs = [['changes','修改差异'],['before','原内容'],['after','修改后'],...(currentFile ? [['current','当前文件']] : [])];
  const text = review ? tab === 'before' ? review.before ?? '（新建文件，原先不存在）' : tab === 'after' ? review.after : tab === 'current' ? currentText : review.diff : '';
  return <ChatTool state={state} isExpanded={expanded} onExpandedChange={setExpanded} className="pi-copy-approval pi-text-change"
    data-testid="pi-text-change" data-change-id={change.id} data-state={change.state} data-revision={change.revision}>
    <ChatTool.Trigger><FilePenLine size={16}/><strong>{change.operation === 'create' ? '新建文件' : '修改文件'}</strong><span title={change.path}>{change.path}</span><span>{labels[change.state]}</span></ChatTool.Trigger>
    <ChatTool.Content>
      {reading ? <p role="status">正在读取本地修改…</p> : review && <div className="pi-text-review" data-testid="pi-text-review">
        {change.path.toLowerCase().endsWith('.svg')&&<img data-testid="pi-science-preview" alt="科普图草稿：请核对科学含义" src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(review.after)} style={{display:'block',width:'100%',maxHeight:520,objectFit:'contain',background:'#fff'}}/>}
        {change.path.toLowerCase().endsWith('.html')&&<ScienceDemoFrame html={review.after}/>}
        {science ? <details data-testid="pi-science-technical">
          <summary>技术内容（通常无需查看）</summary>
          <Tabs selectedKey={tab} onSelectionChange={key=>setTab(String(key))}>
            <Tabs.ListContainer><Tabs.List aria-label="文件修改审阅">{tabs.map(([key,label])=><Tabs.Tab key={key} id={key}>{label}<Tabs.Indicator/></Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
          </Tabs>
          <CodeBlock><CodeBlock.Code code={text} language={tab==='changes'?'diff':change.path.endsWith('.md')?'markdown':'text'} data-testid="pi-text-diff"/></CodeBlock>
        </details> : <>
          <Tabs selectedKey={tab} onSelectionChange={key=>setTab(String(key))}>
            <Tabs.ListContainer><Tabs.List aria-label="文件修改审阅">{tabs.map(([key,label])=><Tabs.Tab key={key} id={key}>{label}<Tabs.Indicator/></Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
          </Tabs>
          <CodeBlock><CodeBlock.Code code={text} language={tab==='changes'?'diff':change.path.endsWith('.md')?'markdown':'text'} data-testid="pi-text-diff"/></CodeBlock>
        </>}
        {currentFile && <p data-testid="pi-text-current-status">当前文件：{currentFile.state === 'readable' ? '已读取' : currentFile.state === 'missing' ? '未找到' : '未能读取'}，读取时间 {new Date(currentFile.readAt).toLocaleTimeString()}。此处是读取时的快照；原提议不会覆盖后续修改。
          <Button size="sm" variant="ghost" isDisabled={reading||draft.busy} onPress={()=>setReadRevision(value=>value+1)} data-testid="pi-text-current-refresh">重新读取当前文件</Button>
        </p>}
        <p>{pending ? '确认后仅保存此版本；原文件另有修改时不会覆盖。' : '此处是该次操作的版本记录；当前文件请从工作区打开。'}</p>
      </div>}
      {pending && !bundled && <ChatTool.Approval><ChatTool.ApprovalActions>
        <ChatTool.Approve isDisabled={draft.busy||reading||!review} onPress={()=>void decide('approve')} data-testid="pi-text-approve">确认保存</ChatTool.Approve>
        <ChatTool.Reject isDisabled={draft.busy} onPress={()=>void decide('reject')} data-testid="pi-text-reject">拒绝</ChatTool.Reject>
      </ChatTool.ApprovalActions></ChatTool.Approval>}
      <PiDeliveryCheck key={change.id+':'+change.revision} sessionId={sessionId} path={change.path} draftId={change.id}/>
    </ChatTool.Content>
    <div className="pi-text-change-actions">
      {!pending&&<Button size="sm" variant="ghost" onPress={()=>setExpanded(value=>!value)} data-testid="pi-text-review-toggle">{expanded?'收起修改':'查看修改'}</Button>}
      {change.state==='applied'&&<>{change.path.toLowerCase().endsWith('.html')?<PiOfficeCurrent sessionId={sessionId} artifactId={change.id} fallbackPath={change.path} onOpen={onOpen} testId="pi-text-open"/>:<Button size="sm" variant="ghost" onPress={()=>onOpen(change.path)} data-testid="pi-text-open">打开文件</Button>}<Button size="sm" variant="ghost" isDisabled={draft.busy||running} onPress={()=>void decide('undo')} data-testid="pi-text-undo">撤销</Button></>}
      {uncertain&&<Button size="sm" variant="ghost" isDisabled={draft.busy||running} onPress={()=>void decide('verify')} data-testid="pi-text-verify">核验现有文件</Button>}
      {draft.busy&&<span role="status">正在提交…</span>}
    </div>
    {['applied','reverted'].includes(change.state)&&change.path.toLowerCase().endsWith('.html')&&<PiOfficeVersions sessionId={sessionId} artifactId={change.id} running={running} onOpen={onOpen} onRefresh={onRefresh}/>}
    {draft.error&&<p role="alert" data-testid="pi-text-error">{draft.error}<Button size="sm" variant="ghost" onPress={()=>void onRefresh()}>刷新状态</Button></p>}
  </ChatTool>;
}
import {PiDeliveryCheck} from './PiDeliveryCheck';
