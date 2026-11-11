import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Pagination, SearchField } from '@heroui/react';
import { FolderPlus, Plus, RefreshCw, Square, X } from 'lucide-react';
import type { KnowledgeImportResult, TeacherResource } from '../../../shared/contracts';
import {
    MATERIALS_SCHEMA,
    MATERIAL_PAGE_SIZE,
    type MaterialJob,
    type MaterialSourceView,
    type MaterialFolderResult
} from '../../../shared/materials';
import { LibraryEmpty } from './LibraryEmpty';
import { MaterialBodyPanel } from './MaterialBodyPanel';
import { selectMaterialSnapshot, materialTaskForSelection, type MaterialSelectionSnapshot } from './MaterialSelectionState';
import './teacher-library.css';
import '../../ui-system/materials-workspace.css';
import {useMaterialDraftGuard} from './useMaterialDraftGuard';
import { MaterialCatalogFilters } from './MaterialCatalogFilters';
import { MaterialCatalogMetadataEditor } from './MaterialCatalogMetadataEditor';
import {
    MATERIAL_CATALOG_SCHEMA,
    emptyCatalogScope,
    catalogScopeKey,
    hasCatalogScope,
    type CatalogPage,
    type CatalogScope
} from '../../../shared/material-catalog';
import styles from '../../ui-system/material-library/material-library.module.css';
import { MaterialLibraryLayout, type MaterialLibraryMode } from './material-library-ui/MaterialLibraryLayout';
import { MaterialLibraryCatalog } from './material-library-ui/MaterialLibraryCatalog';
import { MaterialLibraryActivity, MaterialLibraryTask, MaterialLibraryDisclosure, materialQueueSummary } from './material-library-ui/MaterialLibraryActivity';
import { MATERIAL_TASK_SCHEMA, type MaterialQueueView } from '../../../shared/material-parse-task';
import { MaterialImportPanel } from './MaterialImportPanel';
import { MaterialQuestionStatus } from './MaterialQuestionStatus';
import { MaterialTextSearch } from './MaterialTextSearch';
import { RetrievalProgress } from './RetrievalProgress';
import type { PaperReturnReference } from '../paper-ui/paper-material-handoff';
/** Local catalogue and committed body pages; never uploads or grants paths. */
export function MaterialsWorkspace({ sourceView, onAsk, paperReturn, onReturnToPaper, onOpenQuestionNotebook }: {
    sourceView?: MaterialSourceView;
    onAsk?: (prompt: string) => void;
    paperReturn?: PaperReturnReference;
    onReturnToPaper?: () => void;
    onOpenQuestionNotebook?: () => void;
}) {
    const [catalog, setCatalog] = useState<CatalogPage>(), [query, setQuery] = useState(''), [offset, setOffset] = useState(0), [selected, setSelected] = useState('');
    const [mode, setMode] = useState<'catalog' | 'text'>('catalog'), [filters, setFilters] = useState<CatalogScope>(emptyCatalogScope);
    const [clearEpoch, setClearEpoch] = useState(0);
    const scopeKey = catalogScopeKey(filters);
    const sourceEpoch = useRef(0);
    const [loadedQuery, setLoadedQuery] = useState('');
    const [loading, setLoading] = useState(true), [localBusy, setBusy] = useState(false), [hostBusy, setHostBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [revision, setRevision] = useState(0);
    const [studyDirty, setStudyDirty] = useState(false), studyDirtyRef = useRef(false);
    studyDirtyRef.current = studyDirty;
    const [organizationDirty, setOrganizationDirty] = useState(false), organizationDirtyRef = useRef(false);
    const organizationChanged = useCallback((value: boolean) => {
        organizationDirtyRef.current = value;
        setOrganizationDirty(value);
    }, []);
    const detailBlocked = studyDirty || organizationDirty;
    useMaterialDraftGuard(organizationDirty);
    const canChangeSource = () => {
        if (!studyDirtyRef.current && !organizationDirtyRef.current)
            return true;
        setError('资料中有未保存或待核实的目录、标签、版本登记、笔记或校对文字，请先保存、核实或处理草稿后再切换。');
        return false;
    };
    const busy = localBusy || hostBusy;
    const [queue, setQueue] = useState<MaterialQueueView>();
    const [scan, setScan] = useState<MaterialJob['scan']>();
    const [folderProgress, setFolderProgress] = useState<MaterialJob['folder']>();
    const [imported, setImported] = useState<KnowledgeImportResult>();
    const listEpoch = useRef(0), lock = useRef(false), alive = useRef(true);
    const [sourceActive, setSourceActive] = useState(!!sourceView);
    const [textSource, setTextSource] = useState<MaterialSourceView>();
    const [batchResource, setBatchResource] = useState<TeacherResource>();
    useEffect(() => {
        ++sourceEpoch.current;
        setSourceActive(!!sourceView);
    }, [sourceView]);
    const location = useRef({ query, offset, filters });
    location.current = { query, offset, filters };
    const requestKey = (q: string, n: number, f: CatalogScope) => JSON.stringify([q, n, catalogScopeKey(f)]);
    const selectedTask = useRef(selected);
    selectedTask.current = sourceActive ? sourceView?.body.resource.id || selected : selected;
    async function load(search = query, start = offset, scope = location.current.filters) {
        const stamp = ++listEpoch.current, key = requestKey(search, start, scope);
        setLoading(true);
        setError('');
        try {
            const next = await window.omniEdu?.listMaterialCatalog({ schemaVersion: MATERIAL_CATALOG_SCHEMA, query: search, offset: start, scope });
            if (!next)
                throw new Error();
            if (alive.current && stamp === listEpoch.current && key === requestKey(location.current.query, location.current.offset, location.current.filters)) {
                setCatalog(next);
                setLoadedQuery(key);
            }
        }
        catch {
            if (alive.current && stamp === listEpoch.current)
                setError('无法读取资料，请重试。');
        }
        finally {
            if (alive.current && stamp === listEpoch.current)
                setLoading(false);
        }
    }
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            ++listEpoch.current;
            ++sourceEpoch.current;
        };
    }, []);
    useEffect(() => {
        let mounted = true, inFlight = false, last = '';
        const poll = async () => {
            if (inFlight)
                return;
            inFlight = true;
            try {
                const requested = selectedTask.current;
                const [state, next] = await Promise.all([window.omniEdu?.getMaterialJob(), window.omniEdu?.getMaterialQueue(selectedTask.current || undefined)]);
                if (!mounted || !state)
                    return;
                setHostBusy(state.active);
                setScan(state.scan);
                setFolderProgress(state.folder);
                if (requested === selectedTask.current)
                    setQueue(next);
                const signature = JSON.stringify(next);
                if (last && last !== signature && !lock.current) {
                    void load(location.current.query, location.current.offset);
                    setRevision(v => v + 1);
                }
                last = signature;
            }
            catch {
                if (mounted)
                    setError('后台收录状态暂不可用，请刷新重试。');
            }
            finally {
                inFlight = false;
            }
        };
        void poll();
        const timer = setInterval(() => void poll(), 500);
        return () => {
            mounted = false;
            clearInterval(timer);
        };
    }, []);
    useEffect(() => {
        ++sourceEpoch.current;
        setSelected('');
        setTextSource(undefined);
        const timer = setTimeout(() => void load(query, offset), 150);
        return () => {
            clearTimeout(timer);
            ++listEpoch.current;
        };
    }, [query, offset, scopeKey]);
    async function work(retry = false, folder = false) {
        if (lock.current || !canChangeSource())
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            if (!window.omniEdu)
                throw new Error();
            if (retry) {
                if (!resource)
                    throw new Error();
                setQueue(await window.omniEdu.controlMaterialTask({
                    schemaVersion: MATERIAL_TASK_SCHEMA, resourceId: resource.id, version: resource.contentHash, action: 'retry'
                }));
                if (!alive.current)
                    return;
                setNotice('已安排优先收录，可以继续浏览其他资料。');
                await load();
            }
            else if (folder) {
                const result = await window.omniEdu.createMaterialBatch();
                if (!alive.current)
                    return;
                setNotice(result.canceled ? '已取消选择文件夹。' : '文件夹已开始自动归档，可以继续使用小智。进度会保留，重启后自动接着处理。');
            }
            else {
                const result = await window.omniEdu.importMaterialsBackground();
                if (!alive.current)
                    return;
                setImported(result);
                const summary = (result as Partial<MaterialFolderResult>).summary;
                const saved = summary ? summary.imported + summary.reused : result.items.filter(item => item.ok).length, reused = summary?.reused ?? result.items.filter(item => item.ok
        && item.reused).length, ready = result.resources.filter(row => row.parseStatus === 'ready').length;
                setNotice(summary ? `${result.status === 'canceled' ? '已停止添加。' : ''}已新增 ${summary.imported} 份资料，复用 ${summary.reused} 份；${summary.failed} 项未能添加，${summary.skipped} 项已跳过（非支持文件、链接或不可收录目录）。新资料在本机后台收录，停止或失败状态保留。` : result.status === 'canceled' ? (saved ? `已停止添加，${saved} 份资料保留在本机。` : '已取消添加资料。') : `已新增 ${saved - reused} 份资料${reused ? `，${reused} 份内容未变，已复用原资料` : ''}；${ready} 份正文已收录。新资料在本机后台收录，原有停止或失败状态保留${result.items.some(item => !item.ok) ? '，部分文件未能添加。' : '。'}`);
                if (canChangeSource()) {
                    setSourceActive(false);
                    setTextSource(undefined);
                    setQuery('');
                    setOffset(0);
                    await load('', 0);
                    if (!studyDirtyRef.current && !organizationDirtyRef.current && result.resources[0])
                        setSelected(result.resources[0].id);
                }
            }
            setRevision(value => value + 1);
        }
        catch {
            if (alive.current)
                setError('未能处理资料，请检查文件是否可读取后重试。');
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    async function stop() {
        try {
            await window.omniEdu?.cancelMaterialImport();
            setNotice('正在停止收录，已保存的资料会保留。');
        }
        catch {
            setError('未能停止，请重试。');
        }
    }
    async function control(action: 'prioritize' | 'cancel') {
        if (!resource || !window.omniEdu)
            return;
        try {
            setQueue(await window.omniEdu.controlMaterialTask({
                schemaVersion: MATERIAL_TASK_SCHEMA, resourceId: resource.id, version: resource.contentHash, action
            }));
            setNotice(action === 'cancel' ? '已停止这份资料的收录，原文件仍保存在本机。' : '已安排优先处理这份资料。');
        }
        catch {
            setError('未能调整收录，请刷新确认原件版本后重试。');
        }
    }
    async function locate() {
        if (!resource || busy)
            return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            if (!window.omniEdu)
                throw new Error();
            await window.omniEdu.showKnowledgeResource(resource.localPath);
            setNotice('已在文件夹中定位资料。');
        }
        catch {
            setError('无法定位这份资料，请检查本地文件是否仍存在。');
        }
        finally {
            if (alive.current)
                setBusy(false);
        }
    }
    async function openBatchResource(id: string) {
        if (!canChangeSource())
            return;
        const stamp = ++sourceEpoch.current;
        try {
            const body = await window.omniEdu?.getMaterialBody({ schemaVersion: MATERIALS_SCHEMA, resourceId: id, offset: 0 });
            if (!body || !alive.current || stamp !== sourceEpoch.current || !canChangeSource())
                return;
            setSourceActive(false);
            setTextSource(undefined);
            setBatchResource(body.resource);
            setSelected(id);
        }
        catch {
            if (alive.current && stamp === sourceEpoch.current)
                setError('这份资料暂不可读取，请刷新后重试。');
        }
    }
    const stale = loadedQuery !== requestKey(query, offset, filters);
    const fetching = loading || stale && !error;
    const rows = stale ? [] : catalog?.items.map(item => item.resource) || [], activeSource = sourceActive ? sourceView : textSource, candidateResource = activeSource?.body.resource || rows.find(row => row.id === selected) || (batchResource?.id === selected ? batchResource : undefined);
    const protectedSelection = useRef<MaterialSelectionSnapshot>({ resource: undefined, source: undefined });
    protectedSelection.current = selectMaterialSnapshot(protectedSelection.current, { resource: candidateResource, source: activeSource }, detailBlocked);
    const { resource, source: detailSource } = protectedSelection.current;
    const task = materialTaskForSelection(queue, resource), background = !!queue && (queue.pending > 0 || queue.running > 0);
    const visibleRows = rows;
    function clearFilters() {
        if (!canChangeSource())
            return;
        setQuery('');
        setOffset(0);
        setFilters(emptyCatalogScope());
        setClearEpoch(v => v + 1);
    }
    function changeFilters(next: CatalogScope) {
        if (!canChangeSource()) return;
        setFilters(next);
        setOffset(0);
    }
    function changeMode(next: MaterialLibraryMode) {
        if (!canChangeSource()) return;
        setMode(next);
        if (next === 'text') {
            setQuery('');
            setOffset(0);
        }
    }
    function selectResource(id: string) {
        if (!canChangeSource()) return;
        ++sourceEpoch.current;
        setSourceActive(false);
        setTextSource(undefined);
        setSelected(id);
    }
    function closeDetail() {
        if (!canChangeSource()) return;
        ++sourceEpoch.current;
        setSourceActive(false);
        setTextSource(undefined);
        setSelected('');
        setBatchResource(undefined);
    }
    const filterProps = {
        facets: catalog?.facets, value: filters, disabled: busy || detailBlocked,
        onChange: changeFilters, onClear: clearFilters, active: !!query || hasCatalogScope(filters)
    };
    return <MaterialLibraryLayout
        actions={<>
            <Button variant="secondary" onPress={() => void work(false, true)} isDisabled={busy}
                data-testid="materials-import-folder"><FolderPlus size={17}/>添加文件夹</Button>
            <Button onPress={() => void work()} isDisabled={busy} isPending={busy}
                data-testid="materials-import"><Plus size={17}/>添加资料</Button>
        </>}
        handoff={paperReturn && <div className={styles.progress} data-testid="materials-paper-handoff">
            <p>资料整理后，可到题本核对保存，再返回原题篮选题。</p>
            <Button variant="secondary" data-testid="materials-paper-notebook" isDisabled={localBusy || detailBlocked}
                onPress={onOpenQuestionNotebook}>到题本核对</Button>
            <Button variant="secondary" data-testid="materials-return-paper" isDisabled={localBusy || detailBlocked}
                onPress={onReturnToPaper}>返回原题篮</Button>
        </div>}
        navigation={<MaterialCatalogFilters {...filterProps} placement="navigation"/>}
        mode={mode} modeDisabled={detailBlocked} changeMode={changeMode} queueSummary={materialQueueSummary(queue)}
        controls={<>
            <div hidden={mode !== 'catalog'} className={styles.search}>
                <SearchField aria-label="按资料名称或格式查找" value={query}
                    onChange={value => {
                        if (canChangeSource()) {
                            setQuery(value);
                            setOffset(0);
                        }
                    }} isDisabled={busy || detailBlocked}>
                    <SearchField.Group><SearchField.SearchIcon/>
                        <SearchField.Input placeholder="查找名称、格式…" maxLength={128} data-testid="materials-search"/>
                        <SearchField.ClearButton aria-label="清除资料查找"/>
                    </SearchField.Group>
                </SearchField>
            </div>
            <MaterialCatalogFilters {...filterProps} placement="toolbar"/>
            <Button variant="ghost" isIconOnly aria-label="刷新资料库" onPress={() => {
                void load();
                setRevision(value => value + 1);
            }} isDisabled={busy || fetching || detailBlocked} data-testid="materials-refresh"><RefreshCw size={16}/></Button>
        </>}
        feedback={<>
            {(busy || background) && <div className={styles.progress}>
                <p role="status" data-testid="materials-progress">{folderProgress
                    ? `正在添加文件夹：已查看 ${folderProgress.scanned} 个文件，新增 ${folderProgress.imported} 份、复用 ${folderProgress.reused} 份；原件不会上传…`
                    : scan ? `正在本机识别第 ${scan.page} / ${scan.total} 页，原文件不会上传…`
                        : background ? `${queue?.pending} 份等待收录，${queue?.running} 份正在处理，可以继续浏览…`
                            : '正在保存本地资料，原文件不会上传…'}</p>
                <Button variant="secondary" onPress={() => void stop()} data-testid="materials-stop"><Square size={14}/>停止收录</Button>
            </div>}
            {!!queue?.invalid && <p role="alert" className={styles.error}>有收录记录不可读取，尚未执行。请保留原件并重新添加。</p>}
            {!!folderProgress?.failed && <p role="alert" className={styles.error}>当前文件夹有 {folderProgress.failed} 项未能添加，请在处理队列的“文件夹批次与恢复”中查看和重试。</p>}
            {notice && <p role="status" className={styles.notice} data-testid="materials-notice">{notice}</p>}
            {error && <p role="alert" className={styles.error} data-testid="materials-error">{error}</p>}
            {detailBlocked && <p role="note" className={styles.notice} data-testid="materials-draft-status">
                当前资料有未保存或待核实内容。请展开目录与标签编辑，或返回原页、题目与校正、阅读笔记处理草稿后再切换。
            </p>}
            {imported?.items.some(item => !item.ok) && <ul className={styles.error} data-testid="materials-import-failures">
                {imported.items.filter(item => !item.ok).map((item, index) => <li key={index}>{item.fileName}：未能添加，请检查文件是否可读取。</li>)}
            </ul>}
            {detailBlocked && candidateResource && resource && candidateResource.contentHash !== resource.contentHash &&
                <p role="alert">资料版本已更新，当前草稿仍绑定旧版本。请先处理未保存内容，再重新打开当前资料。</p>}
        </>}
        activity={<MaterialLibraryActivity queue={queue} disabled={busy || detailBlocked}
            open={id => void openBatchResource(id)}
            batches={<MaterialImportPanel revision={revision} changed={() => {
                void load(location.current.query, location.current.offset);
                setRevision(value => value + 1);
            }} open={id => void openBatchResource(id)}/>}
            diagnostics={<><MaterialQuestionStatus/><RetrievalProgress/></>}/>}>
        <div className={styles.columns} data-mode={mode} data-has-detail={!!resource}>
            <div className={styles.catalog}>
                <div hidden={mode !== 'catalog'}>
                    <MaterialLibraryCatalog items={stale ? [] : catalog?.items || []} selected={resource?.id}
                        onSelect={selectResource} disabled={busy || fetching || detailBlocked}
                        empty={fetching ? <p role="status">正在读取资料…</p> : <LibraryEmpty
                            title={query || hasCatalogScope(filters) ? '没有匹配的资料' : '先添加一份资料'}
                            description={query || hasCatalogScope(filters) ? '请调整或清除筛选，恢复查看全部资料。' : '从本机选择教材、教案、图片或其他教学文件。'}/>}/>
                    {!!catalog?.total && <Pagination aria-label="资料目录翻页" className={styles.pagination}>
                        <Pagination.Summary>第 {Math.floor(catalog.offset / MATERIAL_PAGE_SIZE) + 1} / {Math.ceil(catalog.total / MATERIAL_PAGE_SIZE)} 页</Pagination.Summary>
                        <Pagination.Content><Pagination.Item><Pagination.Previous
                            isDisabled={busy || fetching || detailBlocked || offset === 0}
                            onPress={() => setOffset(Math.max(0, offset - MATERIAL_PAGE_SIZE))} data-testid="materials-previous">上一页</Pagination.Previous></Pagination.Item>
                            <Pagination.Item><Pagination.Next isDisabled={busy || fetching || detailBlocked || !catalog.hasMore}
                                onPress={() => setOffset(offset + MATERIAL_PAGE_SIZE)} data-testid="materials-next">下一页</Pagination.Next></Pagination.Item>
                        </Pagination.Content>
                    </Pagination>}
                </div>
                <div hidden={mode !== 'text'} className={styles.textSearch}>
                    <MaterialTextSearch scope={filters} resetKey={clearEpoch} disabled={busy || detailBlocked}
                        open={source => {
                            if (!canChangeSource()) return;
                            const stamp = ++sourceEpoch.current;
                            void window.omniEdu?.getMaterialSource(source).then(view => {
                                if (!alive.current || stamp !== sourceEpoch.current || !canChangeSource()) return;
                                setSourceActive(false);
                                setTextSource(view);
                                setSelected(source.resourceId);
                                requestAnimationFrame(() => document.querySelector('[data-testid="materials-detail"]')?.scrollIntoView({ block: 'start' }));
                            }).catch(() => {
                                if (alive.current && stamp === sourceEpoch.current) setError('资料来源已变化，请重新查找。');
                            });
                        }}/>
                </div>
                <footer className={styles.count} data-testid="materials-count">
                    <span>{fetching ? '正在读取资料…' : `${catalog?.total || 0} 份资料${mode === 'catalog' ? ' · 当前页显示 ' + visibleRows.length + ' / ' + rows.length + ' 份' : ''}`}</span>
                    <span>原文件保存在本机</span>
                </footer>
            </div>
            {resource && <aside className={styles.detail} aria-label="资料详情">
                <div className={styles.detailHeading}><h2>资料详情</h2>
                    <Button variant="ghost" isIconOnly aria-label="收起资料详情" isDisabled={busy || detailBlocked}
                        onPress={closeDetail} data-testid="materials-detail-close"><X size={16}/></Button>
                </div>
                <MaterialLibraryTask task={task} disabled={busy} prioritize={() => void control('prioritize')}
                    cancel={() => void control('cancel')} retry={() => void work(true)}/>
                <MaterialLibraryDisclosure title="编辑目录、标签与元数据" testId="materials-metadata">
                    <MaterialCatalogMetadataEditor key={'catalog:' + resource.id + resource.contentHash}
                        resource={resource} revision={revision} onDirty={organizationChanged}
                        onSaved={() => {
                            void load(location.current.query, location.current.offset);
                            setRevision(value => value + 1);
                        }}/>
                </MaterialLibraryDisclosure>
                <MaterialBodyPanel key={resource.id + resource.contentHash} resource={resource} onAsk={onAsk}
                    onStudyDirty={setStudyDirty} sourceView={detailSource} busy={busy || organizationDirty}
                    revision={revision} taskStatus={task?.status} locate={() => void locate()} retry={() => void work(true)}/>
            </aside>}
        </div>
    </MaterialLibraryLayout>;
}
