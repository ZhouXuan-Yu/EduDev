import {PaperPurposeControls} from './PaperPurposeControls';
import {PaperBasketCreateDialog} from './PaperBasketCreateDialog';
import {PaperLibraryBrowser} from './PaperLibraryBrowser';
import {PaperStudioHeading} from './PaperStudioHeading';
import {usePaperLibrarySelection, type PaperLibrarySelection} from './usePaperLibrarySelection';
import {usePaperSourceIntent, type PaperSourceAction} from './usePaperSourceIntent';
import type {PaperWorkspaceBasket} from './paper-basket-client';
import {PaperFulfillmentPanel} from './PaperFulfillmentPanel';
import {PaperEntryAdaptation} from './PaperEntryAdaptation';
import {PAPER_BASKET_V2_SCHEMA,type PaperBasketV2View} from '../../../shared/paper-basket-v2';
import {validPracticeSetup} from '../../../shared/paper-purpose';
import {useId, useLayoutEffect, useRef, useState, type KeyboardEvent} from 'react';
import {Button} from '@heroui/react';
import {validPaperBlueprint} from '../../../shared/paper-blueprint';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperBasketBlueprintForm} from './PaperBasketBlueprintForm';
import {PaperBasketOrganizer} from './PaperBasketOrganizer';
import {PaperBasketPanel} from './PaperBasketPanel';
import {PaperBasketPreview} from './PaperBasketPreview';
import {PaperCandidateBrowser} from './PaperCandidateBrowser';
import {usePaperBasketWorkspace} from './usePaperBasketWorkspace';
import {PaperInstanceOrphanDrafts} from './PaperInstanceOrphanDrafts';
import {usePaperReference} from './usePaperReference';
import {PaperReferencePanel} from './PaperReferencePanel';
import {usePaperTemplates} from './usePaperTemplates';
import {PaperTemplatePanel} from './PaperTemplatePanel';
import {PaperTemplateRetained} from './PaperTemplateRetained';
import {PaperPastePanel} from './PaperPastePanel';
import {PaperBasketSessionControls} from './PaperBasketSessionControls';
import {PaperBasketLibrary} from './PaperBasketLibrary';
import {PaperWorkspaceSaveStatus} from './PaperWorkspaceSaveStatus';
import {PaperEditorToolbar} from './PaperEditorToolbar';
import {PaperEditorSettings} from './PaperEditorSettings';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';
import previewStyles from '../../ui-system/paper-studio/paper-preview.module.css';
import editorStyles from '../../ui-system/paper-studio/paper-editor.module.css';

const studioTabs = [
  {id: 'select', label: '找题与选题'},
  {id: 'organize', label: '整理与编辑'},
  {id: 'saved', label: '我的练习与试卷'},
  {id: 'templates', label: '模板'},
] as const;
type StudioTab = typeof studioTabs[number]['id'];

export function PaperBasketWorkspace({initialSessionId}: {initialSessionId?: string}) {
  const state = usePaperBasketWorkspace(initialSessionId);
  const selection = usePaperLibrarySelection(state);
  const title = useRef<HTMLHeadingElement>(null);
  const reference = usePaperReference(state.basket);
  const templates=usePaperTemplates(state.basket,reference,state.reload);
  const referenceTrigger = useRef<HTMLButtonElement>(null);
  const templateReferenceTrigger = useRef<HTMLButtonElement>(null);
  const referenceReturn = useRef<HTMLButtonElement | null>(null);
  const wasReferenceOpen = useRef(false);
  useLayoutEffect(() => {
    if (wasReferenceOpen.current && !reference.open) {
      const origin = referenceReturn.current;
      const fallback = libraryTab === 'templates' ? templateReferenceTrigger.current : referenceTrigger.current;
      if (origin?.isConnected && !origin.closest('[hidden]')) origin.focus();
      else fallback?.focus();
    }
    wasReferenceOpen.current = reference.open;
  }, [reference.open]);
  const [requirementsDirty,setRequirementsDirty]=useState(false);
  const [requirementsExpanded, setRequirementsExpanded] = useState(false);
  const [adaptationDirty,setAdaptationDirty]=useState(false);
  const [pasteDirty,setPasteDirty]=useState(false);
  const [newChoice, setNewChoice] = useState(false);
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'saved' | 'templates'>();
  const configurationId = useId();
  const tabsId = useId();
  const [replaceEntryId, setReplaceEntryId] = useState('');
  const [adaptEntryId,setAdaptEntryId]=useState('');
  const sourceIntent = usePaperSourceIntent(state, action => {
    setLibraryTab(undefined);
    if (action === 'reference') {
      referenceReturn.current = referenceTrigger.current;
      reference.show();
    } else {
      setConfigurationOpen(true);
      setRequirementsExpanded(true);
    }
  });
  const {basket, ui} = state;
  const disabled = state.busy || state.loading || state.retryable || selection.busy || reference.open || templates.busy || templates.retryable;
  const readonly = disabled || basket?.state === 'archived';
  const inputDirty = state.dirty || state.instanceDrafts.dirty || state.pointsDirty || requirementsDirty || adaptationDirty || pasteDirty;
  const creationReady=state.draftPurpose==='practice'?validPracticeSetup({title:state.blueprint.title,subject:state.blueprint.subject,grade:state.blueprint.grade}):validPaperBlueprint(state.blueprint);
  const replaceEntry = basket?.entries.find(entry => entry.entryId === replaceEntryId);
  const workingTab = ui.stage === 'select' && basket?.state !== 'archived' ? 'select' : 'organize';
  const previewing = ui.stage === 'preview' || basket?.state === 'archived';
  const editing = ui.stage === 'organize' && basket?.state === 'active';
  const otherInputDirty = state.instanceDrafts.dirty || state.pointsDirty || requirementsDirty || adaptationDirty || pasteDirty;
  const activeTab = reference.open ? 'templates' : libraryTab ?? workingTab;
  const configurationVisible = configurationOpen && activeTab !== 'saved' && activeTab !== 'templates';
  const focusTab = tabDisabled(activeTab) ? studioTabs.find(item => !tabDisabled(item.id))?.id : activeTab;

  function tabDisabled(tab: StudioTab) {
    if (tab === 'select' && !basket) return disabled;
    if (tab === 'saved' || tab === 'templates') return disabled || inputDirty;
    return disabled || !basket || pasteDirty || requirementsDirty || state.instanceDrafts.dirty || state.pointsDirty || basket.state === 'archived';
  }
  function moveTabFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    let next = (index + direction + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    tabs[next].focus();
  }
  async function open(id: string) {
    const item = state.summaries.find(summary => summary.id === id);
    if (!item) return;
    if (await state.open(item)) {
      selection.cancel();
      sourceIntent.cancel();
      setLibraryTab(undefined);
      setConfigurationOpen(false);
    }
  }
  async function create(archive: boolean) {
    const completeSelection = selection.creationHandler();
    const completeSource = sourceIntent.creationHandler();
    const onCreated = completeSelection || completeSource ? (next: PaperWorkspaceBasket) => {
      if (completeSelection?.(next) || completeSource?.(next)) {
        setNewChoice(false);
        setConfigurationOpen(false);
        setLibraryTab(undefined);
        requestAnimationFrame(() => title.current?.focus({preventScroll: true}));
      }
    } : undefined;
    if (await state.create(archive, onCreated)) {
      setNewChoice(false);
      setConfigurationOpen(false);
      setLibraryTab(undefined);
    }
  }
  function newBasket() {
    selection.cancel();
    sourceIntent.cancel();
    setLibraryTab(undefined);
    setConfigurationOpen(true);
    if (!basket) return;
    if (basket.entries.length) setNewChoice(true);
    else void create(false);
  }
  function selectFromLibrary(choice: PaperLibrarySelection) {
    sourceIntent.cancel();
    const next = selection.begin(choice);
    if (!next) return;
    setLibraryTab(undefined);
    setConfigurationOpen(next === 'configure');
    if (next === 'ready') void create(false);
  }
  function chooseSource(action: PaperSourceAction) {
    selection.cancel();
    if (sourceIntent.begin(action) && !basket) {
      setLibraryTab(undefined);
      setConfigurationOpen(true);
    }
  }
  async function showStage(stage: typeof ui.stage) {
    if (await state.stage(stage)) {
      setLibraryTab(undefined);
      setReplaceEntryId('');
    }
  }
  const sourceActions = <div className={styles.sourceActions}>
        <PaperPastePanel key={basket?.id ?? 'first-library'} allowFileImport hasBasket={!!basket}
          disabled={readonly || state.dirty || state.instanceDrafts.dirty || state.pointsDirty || requirementsDirty || adaptationDirty}
          onDirtyChange={setPasteDirty} onMaterials={() => void state.leave('knowledge')}/>
    <Button variant="secondary" data-testid="paper-basket-requirements" isDisabled={disabled || pasteDirty || !!basket && (inputDirty || basket.state !== 'active')}
      onPress={() => chooseSource('requirements')}>按要求出题</Button>
    <Button ref={referenceTrigger} variant="secondary" data-testid="paper-basket-reference"
      isDisabled={disabled || pasteDirty || !!basket && (inputDirty || basket.state !== 'active')}
      onPress={() => chooseSource('reference')}>参考卷出题</Button>
  </div>;
  const additionalActions = <>
      <Button variant="secondary" data-testid="paper-basket-materials" isDisabled={disabled || inputDirty || !basket || basket.state !== 'active'}
        onPress={() => void state.leave('knowledge')}>从资料补充题目</Button>
      <Button variant="ghost" data-testid="paper-entry-automatic" isDisabled={disabled || inputDirty}
        onPress={() => void state.leave('automatic')}>自动组卷与历史记录</Button>
  </>;
  return <div className={`paper-workspace edu-paper-workspace edu-paper-basket-workspace ${styles.workspace}`}
    data-testid="paper-basket-workspace" data-basket-id={basket?.id || ''} data-basket-revision={basket?.revision || ''}
    data-stage={ui.stage} data-has-basket={!!basket}>
    <PaperStudioHeading titleRef={title} backDisabled={disabled || inputDirty} onBack={() => void state.leave('teaching')}
      context={basket ? `${basket.blueprint.grade} · ${basket.blueprint.subject}` : undefined}>
        <Button variant="secondary" size="sm" data-testid="paper-basket-new" isDisabled={disabled || pasteDirty || !!basket && (inputDirty || !creationReady)}
          onPress={newBasket}>新建题篮</Button>
        <Button variant="ghost" size="sm" data-testid="paper-basket-configuration-toggle" aria-controls={basket ? configurationId : undefined}
          aria-haspopup={basket ? undefined : 'dialog'}
          aria-expanded={configurationVisible} isDisabled={reference.open || pasteDirty}
          onPress={() => {setLibraryTab(undefined); setConfigurationOpen(value => libraryTab ? true : !value);}}>会话与组卷配置{inputDirty ? ' · 有未保存输入' : ''}</Button>
    </PaperStudioHeading>
    <nav className={styles.tabNavigation} aria-label="组卷工作区">
      <div className={styles.studioTabs} role="tablist" aria-label="组卷页签" onKeyDown={moveTabFocus}>
      {studioTabs.map(item => <button key={item.id} type="button" className={styles.studioTab} role="tab"
        id={`${tabsId}-tab-${item.id}`} aria-controls={`${tabsId}-panel-${item.id}`}
        data-testid={`paper-basket-stage-${item.id}`} aria-selected={activeTab === item.id}
        tabIndex={focusTab === item.id ? 0 : -1} disabled={tabDisabled(item.id)}
        onClick={() => {
          if (item.id === 'saved' || item.id === 'templates') setLibraryTab(item.id);
          else if (!basket) setLibraryTab(undefined);
          else void showStage(item.id);
        }}>{item.label}</button>)}
      </div>
    </nav>
    <div className={styles.content}>
      {selection.busy && <p role="status" data-testid="paper-library-selection-pending">正在核对所选题目并加入题篮…</p>}
      {selection.error && <p role="alert" data-testid="paper-library-selection-error">{selection.error}</p>}
      {state.error && <div role="alert" data-testid="paper-basket-error"><p>{state.error}</p>
        {state.retryable && <Button variant="secondary" isDisabled={state.busy} onPress={() => void state.retry()}>重试同一请求</Button>}
        <Button variant="secondary" isDisabled={state.busy} data-testid="paper-basket-reload" onPress={() => void state.reload()}>重新读取题篮</Button>
        {selection.pending && !selection.busy && <Button variant="ghost" isDisabled={state.busy}
          data-testid="paper-library-cancel-selection" onPress={selection.cancel}>取消后续加题</Button>}
        {sourceIntent.pending && <Button variant="ghost" isDisabled={state.busy}
          data-testid="paper-source-cancel-intent" onPress={sourceIntent.cancel}>取消后续来源操作</Button>}
      </div>}
      {newChoice && <section role="alert" className="edu-paper-draft-warning" data-testid="paper-basket-new-choice">
        <h2>保留还是归档当前题篮？</h2><p>新题篮不继承手选成员。当前内容不会被静默清空。</p>
        <div className="edu-paper-actions">
          <Button variant="secondary" isDisabled={disabled} onPress={() => setNewChoice(false)}>继续当前题篮</Button>
          <Button className="edu-primary-action-contrast" data-testid="paper-basket-keep-new" isDisabled={disabled} onPress={() => void create(false)}>保留当前篮并新建</Button>
          <Button variant="secondary" data-testid="paper-basket-archive-new" isDisabled={disabled} onPress={() => void create(true)}>归档当前篮并新建</Button>
        </div>
      </section>}
      <section className={styles.sessionSurface} inert={pasteDirty} hidden={(!basket || !configurationVisible) && activeTab !== 'saved'} aria-label="会话与已保存题篮">
        <PaperBasketSessionControls state={state} disabled={disabled} inputDirty={inputDirty} onOpen={open}/>
      </section>
      {basket && <section id={configurationId} className={styles.configuration} inert={pasteDirty} hidden={!configurationVisible} aria-label="会话与组卷配置">
        <div className={styles.configurationFields}>
          {(!basket || ui.stage !== 'select') && <div className={styles.resultActions}>{additionalActions}</div>}
          {!editing && <PaperPurposeControls purpose={basket?.purpose??(basket?'paper':state.draftPurpose)} requirementsMissing={basket?.paperRequirements==='required'} disabled={disabled||!!basket&&inputDirty||basket?.state==='archived'}
            onPurpose={purpose=>{if(basket)void state.mutate({type:'setPurpose',purpose});else state.setPurposeDraft(purpose);}}/>}
          {basket && <>
            <PaperFulfillmentPanel basket={basket} disabled={readonly||state.dirty||state.instanceDrafts.dirty||state.pointsDirty||adaptationDirty} onMutate={state.mutate} onDirty={setRequirementsDirty} isExpanded={requirementsExpanded} onExpandedChange={setRequirementsExpanded}/>
            <DisclosureCard title="蓝图与来源策略" data-testid="paper-basket-blueprint-fold">
              <PaperBasketBlueprintForm value={state.blueprint} purpose={basket.purpose??'paper'} requirementsMissing={basket.purpose==='paper'&&basket.paperRequirements==='required'} disabled={readonly || adaptationDirty || requirementsDirty || state.instanceDrafts.dirty || state.pointsDirty} dirty={state.dirty} hasBasket
                onChange={state.setDraft} onSave={() => void state.mutate({type: 'updateBlueprint', blueprint: state.blueprint})} onDiscard={state.discardDraft}/>
            </DisclosureCard>
          </>}
        </div>
      </section>}
      <div className={styles.librarySurface} hidden={activeTab !== 'saved'} role="tabpanel"
        id={`${tabsId}-panel-saved`} aria-labelledby={`${tabsId}-tab-saved`}>
        <PaperBasketLibrary state={state} disabled={disabled || inputDirty} canCreate={creationReady} onOpen={open} onNew={newBasket}
          onContinue={() => {if (basket?.state === 'archived') setLibraryTab(undefined); else void showStage('organize');}}/>
      </div>
      <section className={styles.librarySurface} hidden={activeTab !== 'templates'} role="tabpanel"
        id={`${tabsId}-panel-templates`} aria-labelledby={`${tabsId}-tab-templates`} data-testid="paper-template-library">
        <div className={styles.templateActions}>
          <Button ref={templateReferenceTrigger} variant="secondary" data-testid="paper-template-reference"
            isDisabled={disabled || inputDirty || !basket || basket.state !== 'active'}
            onPress={() => {referenceReturn.current = templateReferenceTrigger.current; reference.show();}}>参考卷出题</Button>
        </div>
        <PaperReferencePanel state={reference} onMaterials={() => void state.leave('knowledge')}/>
        {basket ? <PaperTemplatePanel state={templates} basket={basket} reference={reference}
          disabled={state.busy || state.loading || state.retryable || inputDirty || reference.busy}/>
          : <div><h2>命题结构与卷面模板</h2><p>先创建或打开题篮，再核实此会话可使用的模板版本。</p>
            <Button variant="secondary" isDisabled={disabled || inputDirty} onPress={newBasket}>创建或打开题篮</Button></div>}
      </section>
      {!basket && activeTab === 'select' && <PaperLibraryBrowser disabled={disabled || configurationVisible || pasteDirty}
        onSelect={selectFromLibrary} sourceActions={sourceActions}/>}
      {basket && <>
        <div className={styles.recovery} inert={pasteDirty} hidden={activeTab === 'saved' || activeTab === 'templates'}>
            {state.instanceDrafts.cacheError && <div role="alert">{state.instanceDrafts.cacheError}
              {state.instanceDrafts.ready
                ? <Button variant="secondary" onPress={state.instanceDrafts.retryCache}>用当前输入更新本机恢复副本</Button>
                : <Button variant="secondary" data-testid="paper-instance-retry-namespace" isDisabled={state.instanceDrafts.namespacePending}
                  onPress={state.instanceDrafts.retryNamespace}>重新核实数据目录并恢复输入</Button>}</div>}
            <PaperInstanceOrphanDrafts basket={basket} drafts={state.instanceDrafts}/>
            <PaperTemplateRetained basket={basket} disabled={readonly||inputDirty} onArrange={templates.arrange}/>
            {basket.state === 'archived' && <p role="note">此题篮已归档，内容保留只读；可从列表继续其他题篮或保留此篮并新建。</p>}
            <section data-testid="paper-adaptation-host">
              {basket.schemaVersion===PAPER_BASKET_V2_SCHEMA&&basket.entries.some(e=>e.entryId===adaptEntryId)&&window.omniEdu&&<PaperEntryAdaptation key={basket.id+adaptEntryId} basket={basket as PaperBasketV2View} studentId={basket.studentId??''} entryId={adaptEntryId} api={window.omniEdu}
                onDirtyChange={setAdaptationDirty} onRequestPi={state.requestAdaptationPi} onChanged={()=>void state.reload()}/>}
            </section>
        </div>
        {editing && activeTab === 'organize' && <PaperEditorToolbar blueprint={state.blueprint} dirty={state.dirty}
          disabled={readonly} otherInputDirty={otherInputDirty} requirementsMissing={basket.purpose === 'paper' && basket.paperRequirements === 'required'}
          hasEntries={!!basket.entries.length} onTitle={value => state.setDraft({...state.blueprint, title: value})}
          onSave={() => {void state.mutate({type: 'updateBlueprint', blueprint: state.blueprint});}} onDiscard={state.discardDraft}
          onSelect={() => {void showStage('select');}} onPreview={() => {void showStage('preview');}}/>}
        <div className={`${styles.body} ${previewing ? previewStyles.singleColumn : editing ? editorStyles.layout : ''}`}
          data-editor={editing} hidden={activeTab === 'saved' || activeTab === 'templates'}>
          <main className={`${styles.main} ${previewing ? previewStyles.main : editing ? editorStyles.document : ui.stage === 'select' && basket.state === 'active' ? '' : styles.document}`}>
            <section className={styles.selectionPanel} role="tabpanel" id={`${tabsId}-panel-select`}
              aria-labelledby={`${tabsId}-tab-select`} hidden={workingTab !== 'select'}>
              {ui.stage === 'select' && basket.state === 'active' && <PaperCandidateBrowser basket={basket} ui={ui} disabled={readonly || inputDirty}
                sourceActions={sourceActions} additionalActions={additionalActions}
                restoreKey={state.restoreKey} onUi={state.changeUi} onMutate={state.mutate} replaceEntry={replaceEntry}
                onCancelReplace={() => {setReplaceEntryId(''); void state.stage('organize');}}
                onReplaced={() => {setReplaceEntryId(''); void state.stage('organize');}}/>}
            </section>
            <section className={styles.editingPanel} role="tabpanel" id={`${tabsId}-panel-organize`}
              aria-labelledby={`${tabsId}-tab-organize`} hidden={workingTab !== 'organize'}>
              {editing && <PaperBasketOrganizer compact basket={basket} disabled={readonly || state.dirty || requirementsDirty || adaptationDirty}
                recovery={{error: state.error, busy: state.busy, retryable: state.retryable, onRetry: async () => state.retry()}}
                onAdapt={entry=>setAdaptEntryId(entry.entryId)}
                onMutate={state.mutate} drafts={state.instanceDrafts} onPointsDirty={state.setPointsDirty} pointsDirty={state.pointsDirty} onReload={() => void state.reload()}
                onReplace={entry => {void state.stage('select').then(ok => {if (ok) setReplaceEntryId(entry.entryId);});}}/>}
              {(ui.stage === 'preview' || basket.state === 'archived') && <PaperBasketPreview basket={basket} snapshot={state.snapshot}
                backAction={basket.state === 'active' ? <Button variant="secondary" data-testid="paper-basket-preview-back"
                  isDisabled={disabled || inputDirty} onPress={() => void showStage('organize')}>返回编辑</Button> : undefined}
                disabled={readonly} dirty={inputDirty} onSnapshot={() => void state.takeSnapshot()} onConfirmAll={()=>void state.confirmAll()} onDecide={action => void state.decide(action)}/>}
            </section>
          </main>
          {editing && <PaperEditorSettings basket={basket} disabled={readonly || inputDirty}
            pointsDisabled={readonly || state.dirty || state.instanceDrafts.dirty || requirementsDirty || adaptationDirty || pasteDirty}
            onPurpose={purpose => {void state.mutate({type: 'setPurpose', purpose});}} onMutate={state.mutate} onPointsDirty={state.setPointsDirty}
            onTemplates={() => setLibraryTab('templates')} onConfiguration={() => setConfigurationOpen(value => !value)} sourceActions={sourceActions}/>}
          {!previewing && !editing && <PaperBasketPanel basket={basket} stage={ui.stage} disabled={readonly || inputDirty}
            onMutate={state.mutate} onStage={stage => {void showStage(stage);}}/>}
        </div>
      </>}
    </div>
    <PaperWorkspaceSaveStatus loading={state.loading} busy={state.busy} retryable={state.retryable} hasBasket={!!basket}
      archived={basket?.state === 'archived'} inputDirty={inputDirty} uiDirty={state.uiDirty}
      uiSaveBlocked={state.uiSaveBlocked} uiDiscarded={state.uiDiscarded}
      onSave={async () => !!(state.uiSaveBlocked && state.retryable ? await state.retry() : await state.saveUi())}
      onDiscard={state.discardUi}/>
    {!basket && configurationVisible && <PaperBasketCreateDialog state={state} onOpen={open}
      selectingQuestion={!!selection.pending}
      sourceAction={sourceIntent.pending}
      onClose={() => {selection.cancel(); sourceIntent.cancel(); setConfigurationOpen(false);}} onCreate={() => void create(false)}/>}
  </div>;
}
