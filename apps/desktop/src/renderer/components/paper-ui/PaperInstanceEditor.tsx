import {useState} from 'react';
import {Button, Form} from '@heroui/react';
import {validPaperInstanceContent} from '../../../shared/paper-instance';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperQuestionContent} from './PaperQuestionContent';
import {PaperInstanceRoleEditor} from './PaperInstanceRoleEditor';
import {PaperInstanceDialog, type PaperEditorRecovery} from './PaperInstanceDialog';
import {instanceRoles, instanceRoleLabels} from './paper-instance-content';
import type {PaperWorkspaceEntry, PaperWorkspaceOperation} from './paper-basket-client';
import type {PaperInstanceDraftController} from './usePaperInstanceDrafts';

export function PaperInstanceEditor({entry, drafts, disabled, onMutate, onReplace, onReload,imagesReady=true,presentation='inline',recovery}: {
  entry: PaperWorkspaceEntry; drafts: PaperInstanceDraftController; disabled: boolean;
  onMutate: (operation: PaperWorkspaceOperation) => Promise<boolean>; onReplace: () => void; onReload: () => void;
  imagesReady?:boolean;
  presentation?: 'inline' | 'dialog';
  recovery?: PaperEditorRecovery;
}) {
  const draft = drafts.drafts[entry.entryId];
  const [open, setOpen] = useState(false), [restoring, setRestoring] = useState(false);
  const [originalOpened, setOriginalOpened] = useState(false);
  const instance = entry.instance;
  if (!instance) return null;
  disabled = disabled || !drafts.ready;
  const content = draft?.content || instance.content;
  const conflicted = !!draft && (draft.baseRevision !== instance.instanceRevision || draft.baseDigest !== instance.contentDigest);
  const valid = validPaperInstanceContent(content);
  const reviewState = <p data-testid="paper-instance-review-state">本卷修订 {instance.instanceRevision} · {entry.reviewCurrent ? '当前修订已核对' : instance.review?.action === 'reject' ? '当前修订已退回' : '待重新核对'}</p>;
  const restoreButton = <Button variant="ghost" data-testid="paper-instance-restore" isDisabled={disabled || drafts.dirty} onPress={() => setRestoring(true)}>恢复这道题的原题内容</Button>;
  const restorePrompt = restoring && <section role="group" aria-label="确认恢复原题">
      <p>将题干、答案和解析恢复为当前绑定的原题版本。历史快照保留；恢复后需要重新核对。</p>
      <Button variant="secondary" data-testid="paper-instance-restore-confirm" isDisabled={disabled} onPress={() => {void onMutate({type: 'restoreEntrySource',
        entryId: entry.entryId, expectedInstanceRevision: instance.instanceRevision}).then(ok => {if (ok) setRestoring(false);});}}>确认恢复原题</Button>
      <Button variant="ghost" onPress={() => setRestoring(false)}>取消</Button>
    </section>;
  const form = (open || draft) && <Form onSubmit={event => {event.preventDefault(); if (!disabled && valid && !conflicted) void drafts.save(entry);}}
      aria-label="本卷题目编辑" data-testid="paper-instance-form">
      {draft && <p role="status">本机未保存输入：以下修改尚未写入题篮。上方题面仍为宿主保存版本。</p>}
      {instanceRoles.map(role => <DisclosureCard key={role} title={instanceRoleLabels[role]} defaultExpanded={role === 'question'}
        data-testid={`paper-instance-edit-fold-${role}`}>
        <PaperInstanceRoleEditor entry={entry} role={role} content={content[role]} disabled={disabled}
          onChange={value => drafts.update(entry, {...content, [role]: value})}/>
      </DisclosureCard>)}
      {!valid && <p role="alert">请补全空白内容，检查重复标号、表格列数和公式；不能填入网页、文件路径或 HTML。输入仍保留。</p>}
      {conflicted && <section role="alert" data-testid="paper-instance-conflict">
        <p>已保存题目发生变化，您的输入仍保留。先对照当前版本，再决定保留输入覆盖当前版本，或放弃本地输入。</p>
        <Button variant="secondary" isDisabled={disabled} onPress={() => drafts.rebase(entry)}>以当前已保存版本为基准保留这些修改</Button>
      </section>}
      <div className="edu-paper-actions">
        <Button type="submit" className="edu-primary-action-contrast" data-testid="paper-instance-save" isDisabled={disabled || !draft || !valid || conflicted}>保存本卷修改</Button>
        <Button variant="secondary" data-testid="paper-instance-discard" isDisabled={disabled || !draft} onPress={() => drafts.discard(entry.entryId)}>放弃此题未保存修改</Button>
        <Button variant="ghost" data-testid="paper-instance-reload" isDisabled={disabled} onPress={onReload}>重新读取已保存版本</Button>
      </div>
      <p>保存后需要重新核对；未保存输入保存在本机恢复副本中，不能作为正式试卷。</p>
    </Form>;
  const comparison = <DisclosureCard title="当前绑定原题对照" data-testid="paper-instance-original"
      onExpandedChange={expanded => {if (expanded) setOriginalOpened(true);}}>
      {originalOpened && <>
      <p>以下是加入或换题时绑定的原题，尚未应用本卷修改。</p>
      <PaperQuestionContent question={entry.question} contentVersion={entry.contentVersion} generation={entry.generation}/>
      </>}
    </DisclosureCard>;
  const reviewActions = <div className="edu-paper-actions" aria-label="核对当前修订">
      <Button className="edu-primary-action-contrast" data-testid="paper-instance-confirm" isDisabled={disabled || drafts.dirty || !imagesReady || entry.reviewCurrent || !entry.availability.available || !!entry.deliveryBlock && entry.deliveryBlock !== 'needs_review'}
        onPress={() => void onMutate({type: 'reviewEntry', entryId: entry.entryId, expectedInstanceRevision: instance.instanceRevision,
          expectedContentDigest: instance.contentDigest, action: 'confirm'})}>已核对当前修订</Button>
      <Button variant="secondary" data-testid="paper-instance-reject" isDisabled={disabled || drafts.dirty}
        onPress={() => void onMutate({type: 'reviewEntry', entryId: entry.entryId, expectedInstanceRevision: instance.instanceRevision,
          expectedContentDigest: instance.contentDigest, action: 'reject'})}>退回此修订</Button>
    </div>;
  return <section className="edu-paper-instance-editor" data-testid="paper-instance-editor" data-entry-id={entry.entryId}>
    {presentation === 'inline' && reviewState}
    <div className="edu-paper-actions">
      <Button variant={presentation === 'dialog' ? 'ghost' : 'secondary'} data-testid="paper-instance-open" isDisabled={disabled}
        onPress={() => setOpen(!open)}>{presentation === 'dialog' ? '编辑与核对' + (draft ? ' · 未保存' : '') : open ? '收起编辑' : '编辑本卷题目'}</Button>
      <Button variant={presentation === 'dialog' ? 'ghost' : 'secondary'} data-testid="paper-instance-replace" isDisabled={disabled || drafts.dirty} onPress={onReplace}>换一道题</Button>
      {presentation === 'inline' && restoreButton}
    </div>
    {presentation === 'dialog' ? <PaperInstanceDialog open={open} blocked={!!draft || disabled} entryId={entry.entryId}
      recovery={recovery} onReload={onReload} onClose={() => {setOpen(false); setRestoring(false);}}>
      {drafts.cacheError && <section role="alert" data-testid="paper-instance-dialog-cache-error">
        <p>{drafts.cacheError}</p>
        {drafts.ready
          ? <Button variant="secondary" onPress={drafts.retryCache}>用当前输入更新本机恢复副本</Button>
          : <Button variant="secondary" data-testid="paper-instance-dialog-retry-namespace" isDisabled={drafts.namespacePending}
            onPress={drafts.retryNamespace}>重新核实数据目录并恢复输入</Button>}
      </section>}
      {reviewState}{form}{comparison}<div className="edu-paper-actions">{restoreButton}</div>{restorePrompt}{reviewActions}
    </PaperInstanceDialog> : <>{restorePrompt}{form}{comparison}{reviewActions}</>}
  </section>;
}
