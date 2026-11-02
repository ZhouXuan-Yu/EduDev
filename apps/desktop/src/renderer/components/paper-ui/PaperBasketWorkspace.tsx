import {useLayoutEffect, useRef, useState} from 'react';
import {Button, Label, SearchField} from '@heroui/react';
import {validPaperBlueprint} from '../../../shared/paper-blueprint';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperBasketBlueprintForm} from './PaperBasketBlueprintForm';
import {PaperBasketOrganizer} from './PaperBasketOrganizer';
import {PaperBasketPanel} from './PaperBasketPanel';
import {PaperBasketPreview} from './PaperBasketPreview';
import {PaperCandidateBrowser} from './PaperCandidateBrowser';
import {PaperSelect} from './PaperSelect';
import {usePaperBasketWorkspace} from './usePaperBasketWorkspace';
import {PaperInstanceOrphanDrafts} from './PaperInstanceOrphanDrafts';
import {usePaperReference} from './usePaperReference';
import {PaperReferencePanel} from './PaperReferencePanel';

export function PaperBasketWorkspace({initialSessionId}: {initialSessionId?: string}) {
  const state = usePaperBasketWorkspace(initialSessionId);
  const reference = usePaperReference(state.basket);
  const referenceTrigger = useRef<HTMLButtonElement>(null), wasReferenceOpen = useRef(false);
  useLayoutEffect(() => {
    if (wasReferenceOpen.current && !reference.open) referenceTrigger.current?.focus();
    wasReferenceOpen.current = reference.open;
  }, [reference.open]);
  const [newChoice, setNewChoice] = useState(false);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerLimit, setOwnerLimit] = useState(50);
  const [replaceEntryId, setReplaceEntryId] = useState('');
  const matchingOwners = state.owners.filter(owner => owner.title.includes(ownerQuery) || owner.id === ownerQuery);
  const visibleOwners = matchingOwners.slice(0, ownerLimit);
  const selectedOwner = state.owners.find(owner => owner.id === state.ownerId);
  if (selectedOwner && !visibleOwners.some(owner => owner.id === selectedOwner.id)) visibleOwners.unshift(selectedOwner);
  const {basket, ui} = state;
  const disabled = state.busy || state.loading || state.retryable || reference.open;
  const readonly = disabled || basket?.state === 'archived';
  const inputDirty = state.dirty || state.instanceDrafts.dirty;
  const replaceEntry = basket?.entries.find(entry => entry.entryId === replaceEntryId);

  async function open(id: string) {
    const item = state.summaries.find(summary => summary.id === id);
    if (!item) return;
    await state.open(item);
  }
  async function create(archive: boolean) {
    if (await state.create(archive)) setNewChoice(false);
  }
  return <div className="paper-workspace edu-paper-workspace edu-paper-basket-workspace" data-testid="paper-basket-workspace"
    data-basket-id={basket?.id || ''} data-basket-revision={basket?.revision || ''} data-stage={ui.stage}>
    <header className="edu-paper-heading">
      <div><h1>找题与组卷</h1><p>选择题目加入题篮，再整理顺序、核对试卷。</p></div>
      <div className="edu-paper-actions">
        <Button ref={referenceTrigger} variant="secondary" data-testid="paper-basket-reference" isDisabled={disabled || inputDirty || !basket || basket.state !== 'active' || !basket.entries.length}
          onPress={reference.show}>参考卷提取与核对</Button>
        <Button variant="secondary" data-testid="paper-basket-materials" isDisabled={disabled || inputDirty || !basket || basket.state !== 'active'}
          onPress={() => void state.leave('knowledge')}>从资料补充题目</Button>
        <Button variant="secondary" data-testid="paper-basket-back-teaching" isDisabled={disabled || inputDirty} onPress={() => void state.leave('teaching')}>返回教学工作台</Button>
        <Button variant="ghost" data-testid="paper-entry-automatic" isDisabled={disabled || inputDirty} onPress={() => void state.leave('automatic')}>自动组卷与历史记录</Button>
        <Button variant="secondary" data-testid="paper-basket-new" isDisabled={disabled || inputDirty || !validPaperBlueprint(state.blueprint)}
          onPress={() => basket?.entries.length ? setNewChoice(true) : void create(false)}>新建题篮</Button>
      </div>
    </header>
    <PaperReferencePanel state={reference} onMaterials={() => void state.leave('knowledge')}/>
    <div hidden={reference.open} className={reference.open ? undefined : 'edu-paper-sidebar'}>
    <div className="edu-paper-owner-fields">
      <SearchField value={ownerQuery} onChange={value => {setOwnerQuery(value); setOwnerLimit(50);}}>
        <Label>查找所属会话</Label><SearchField.Group><SearchField.Input data-testid="paper-basket-owner-search"/><SearchField.ClearButton/></SearchField.Group>
      </SearchField>
      <PaperSelect label="所属会话" value={state.ownerId} disabled={state.busy || state.retryable || inputDirty || reference.open} testId="paper-basket-owner"
        options={[{id: '', label: '创建新的本地组卷会话'}, ...visibleOwners.map(owner => ({id: owner.id, label: owner.title}))]}
        onChange={id => {void state.chooseOwner(id);}}/>
      <PaperSelect label="已保存题篮" value={basket?.id || ''} disabled={disabled || inputDirty} testId="paper-basket-saved"
        options={[{id: '', label: '选择题篮'}, ...state.summaries.filter(item => item.sessionId === state.ownerId).map(item => ({id: item.id,
          label: `${item.title} · ${item.count}题 · ${item.state === 'active' ? '继续' : '已归档'}`}))]}
        onChange={id => {if (id) void open(id);}}/>
    </div>
    {matchingOwners.length > ownerLimit && <Button variant="ghost" onPress={() => setOwnerLimit(value => value + 50)}>再显示 50 个会话</Button>}
    {state.summaryOffset < state.summaryTotal && <Button variant="secondary" isDisabled={disabled} data-testid="paper-basket-more" onPress={() => void state.loadMore()}>加载下一页题篮</Button>}
    {newChoice && <section role="alert" className="edu-paper-draft-warning" data-testid="paper-basket-new-choice">
      <h2>保留还是归档当前题篮？</h2><p>新题篮不继承手选成员。当前内容不会被静默清空。</p>
      <div className="edu-paper-actions">
        <Button variant="secondary" isDisabled={disabled} onPress={() => setNewChoice(false)}>继续当前题篮</Button>
        <Button className="edu-primary-action-contrast" data-testid="paper-basket-keep-new" isDisabled={disabled} onPress={() => void create(false)}>保留当前篮并新建</Button>
        <Button variant="secondary" data-testid="paper-basket-archive-new" isDisabled={disabled} onPress={() => void create(true)}>归档当前篮并新建</Button>
      </div>
    </section>}
    {state.loading && <p role="status">正在从宿主恢复题篮与浏览偏好…</p>}
    {state.busy && <p role="status">正在核对或保存，请稍候…</p>}
    {state.error && <div role="alert" data-testid="paper-basket-error"><p>{state.error}</p>
      {state.retryable && <Button variant="secondary" isDisabled={state.busy} onPress={() => void state.retry()}>重试同一请求</Button>}
      <Button variant="secondary" isDisabled={state.busy} data-testid="paper-basket-reload" onPress={() => void state.reload()}>重新读取题篮</Button>
    </div>}
    {state.uiDirty && <p role="status" data-testid="paper-basket-ui-pending">浏览偏好尚未保存。
      <Button variant="secondary" isDisabled={state.busy} data-testid="paper-basket-save-ui" onPress={() => void state.saveUi()}>{state.uiSaveBlocked ? '重试保存浏览偏好' : '立即保存浏览偏好'}</Button>
      <Button variant="ghost" isDisabled={state.busy} data-testid="paper-basket-discard-ui" onPress={state.discardUi}>放弃未保存浏览偏好</Button>
    </p>}
    {state.uiDiscarded && <p role="status" data-testid="paper-basket-ui-local">已放弃本地浏览偏好。本次浏览仅临时生效，未声明保存成功；题篮成员和蓝图草稿均保留。
      <Button variant="secondary" isDisabled={state.busy} onPress={() => void state.saveUi()}>恢复保存浏览偏好</Button>
    </p>}
    {!basket && !state.loading && <>
      <p>选择已有会话或新建本地会话，再保存题篮开始找题。会话与学生关联由宿主校验；浏览和整理无需调用模型。</p>
      <PaperBasketBlueprintForm value={state.blueprint} disabled={disabled} dirty={state.dirty} hasBasket={false}
        canDiscard={!state.busy && !state.loading && (state.dirty || state.retryable)}
        onChange={state.setDraft} onSave={() => {}} onDiscard={state.discardDraft}/>
      <Button className="edu-primary-action-contrast" data-testid="paper-basket-create" isDisabled={disabled || !validPaperBlueprint(state.blueprint)} onPress={() => void create(false)}>保存题篮并找题</Button>
    </>}
    {basket && <>
      {state.instanceDrafts.cacheError && <div role="alert">{state.instanceDrafts.cacheError}
        {state.instanceDrafts.ready
          ? <Button variant="secondary" onPress={state.instanceDrafts.retryCache}>用当前输入更新本机恢复副本</Button>
          : <Button variant="secondary" data-testid="paper-instance-retry-namespace" isDisabled={state.instanceDrafts.namespacePending}
            onPress={state.instanceDrafts.retryNamespace}>重新核实数据目录并恢复输入</Button>}</div>}
      <PaperInstanceOrphanDrafts basket={basket} drafts={state.instanceDrafts}/>
      <nav className="edu-paper-stages" aria-label="题篮页面">
        {([{id: 'select', label: '找题'}, {id: 'organize', label: '整理'}, {id: 'preview', label: '预览'}] as const).map(item =>
          <Button key={item.id} variant={ui.stage === item.id ? 'secondary' : 'ghost'} data-testid={`paper-basket-stage-${item.id}`}
            aria-current={ui.stage === item.id ? 'page' : undefined} isDisabled={disabled || state.instanceDrafts.dirty || basket.state === 'archived'} onPress={() => {setReplaceEntryId(''); void state.stage(item.id);}}>{item.label}</Button>)}
      </nav>
      {basket.state === 'archived' && <p role="note">此题篮已归档，内容保留只读；可从列表继续其他题篮或保留此篮并新建。</p>}
      <DisclosureCard title="蓝图与来源策略" data-testid="paper-basket-blueprint-fold">
        <PaperBasketBlueprintForm value={state.blueprint} disabled={readonly || state.instanceDrafts.dirty} dirty={state.dirty} hasBasket
          onChange={state.setDraft} onSave={() => void state.mutate({type: 'updateBlueprint', blueprint: state.blueprint})} onDiscard={state.discardDraft}/>
      </DisclosureCard>
      <div className="edu-paper-body">
        <main className="edu-paper-main">
          {ui.stage === 'select' && basket.state === 'active' && <PaperCandidateBrowser basket={basket} ui={ui} disabled={readonly || inputDirty}
            restoreKey={state.restoreKey} onUi={state.changeUi} onMutate={state.mutate} replaceEntry={replaceEntry}
            onCancelReplace={() => {setReplaceEntryId(''); void state.stage('organize');}}
            onReplaced={() => {setReplaceEntryId(''); void state.stage('organize');}}/>}
          {ui.stage === 'organize' && basket.state === 'active' && <PaperBasketOrganizer basket={basket} disabled={readonly || state.dirty}
            onMutate={state.mutate} drafts={state.instanceDrafts} onReload={() => void state.reload()}
            onReplace={entry => {void state.stage('select').then(ok => {if (ok) setReplaceEntryId(entry.entryId);});}}/>}
          {(ui.stage === 'preview' || basket.state === 'archived') && <PaperBasketPreview basket={basket} snapshot={state.snapshot}
            disabled={readonly} dirty={inputDirty} onSnapshot={() => void state.takeSnapshot()} onDecide={action => void state.decide(action)}/>}
        </main>
        <PaperBasketPanel basket={basket} disabled={readonly || state.instanceDrafts.dirty} onStage={stage => {setReplaceEntryId(''); void state.stage(stage);}}/>
      </div>
    </>}
    </div>
  </div>;
}
