import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import type { TeacherResource } from '../../../shared/contracts';
import {
    MATERIAL_CATALOG_SCHEMA as schema,
    catalogPatch,
    normalizeCatalogMetadata,
    validCatalogSave,
    type CatalogMetadataView,
    type CatalogSave
} from '../../../shared/material-catalog';
import styles from '../../ui-system/material-catalog.module.css';
export function catalogSaveObserved(view: CatalogMetadataView, input: CatalogSave): boolean {
    return view.resourceId === input.resourceId && view.sourceVersion === input.sourceVersion && view.revision === input.expectedRevision + 1
        && view.receipt?.operationId === input.operationId
        && view.receipt.baseRevision === input.expectedRevision
        && view.receipt.sourceVersion === input.sourceVersion
        && catalogPatch(view.metadata) === catalogPatch(input.metadata);
}
/** Organization is teacher-authored metadata, never a file move or a source-content confirmation. */
export function MaterialCatalogMetadataEditor({ resource, revision, onDirty, onSaved }: {
    resource: TeacherResource;
    revision: number;
    onDirty: (value: boolean) => void;
    onSaved: () => void;
}) {
    const [view, setView] = useState<CatalogMetadataView>(), [directory, setDirectory] = useState(''), [tags, setTags] = useState('');
    const [busy, setBusy] = useState(false), [unknown, setUnknown] = useState(false), [message, setMessage] = useState('');
    const [reload, setReload] = useState(0);
    const pending = useRef<CatalogSave | undefined>(undefined), epoch = useRef(0), editEpoch = useRef(0), alive = useRef(true), blocked = useRef(false);
    const identity = resource.id + ':' + resource.contentHash, target = useRef(identity);
    target.current = identity;
    const dirty = !!view && (directory !== view.metadata.directory || tags !== view.metadata.tags.join(', '));
    const callbacks = useRef({ onDirty, onSaved });
    callbacks.current = { onDirty, onSaved };
    const hold = (value: boolean) => {
        blocked.current = value;
        callbacks.current.onDirty(value);
    };
    function accept(next: CatalogMetadataView) {
        setView(next);
        setDirectory(next.metadata.directory);
        setTags(next.metadata.tags.join(', '));
        pending.current = undefined;
        setUnknown(false);
        hold(false);
    }
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            ++epoch.current;
            callbacks.current.onDirty(false);
        };
    }, []);
    useEffect(() => {
        if (blocked.current)
            return;
        const stamp = ++epoch.current, edited = editEpoch.current, id = identity;
        setView(undefined);
        setMessage('');
        void window.omniEdu?.getMaterialCatalogMetadata({ schemaVersion: schema, resourceId: resource.id, sourceVersion: resource.contentHash }).then(next => {
            if (alive.current && stamp === epoch.current && target.current === id && edited === editEpoch.current
        && !blocked.current)
                accept(next);
        }).catch(() => {
            if (alive.current && stamp === epoch.current)
                setMessage('组织信息暂不可读取，请刷新资料核对当前版本。');
        });
    }, [identity, revision, reload]);
    function changed(field: 'directory' | 'tags', value: string) {
        ++editEpoch.current;
        const nextDirectory = field === 'directory' ? value : directory, nextTags = field === 'tags' ? value : tags;
        hold(!view || nextDirectory !== view.metadata.directory || nextTags !== view.metadata.tags.join(', '));
        setMessage('');
        if (field === 'directory')
            setDirectory(value);
        else
            setTags(value);
    }
    async function reconcile(input: CatalogSave, stamp: number, id: string) {
        const next = await window.omniEdu!.getMaterialCatalogMetadata({ schemaVersion: schema, resourceId: input.resourceId, sourceVersion: input.sourceVersion });
        if (!alive.current || stamp !== epoch.current || target.current !== id)
            return;
        if (catalogSaveObserved(next, input)) {
            accept(next);
            setMessage('已核实目录与标签保存在本机。');
            callbacks.current.onSaved();
        }
        else {
            setUnknown(true);
            hold(true);
            setMessage('尚不能确认此次提交结果，已保留草稿。请核实已保存状态；不会自动重提交。');
        }
    }
    async function save() {
        if (!view || busy || unknown || pending.current)
            return;
        const metadata = normalizeCatalogMetadata({ directory, tags: tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) });
        const input: CatalogSave = {
            schemaVersion: schema, resourceId: resource.id, sourceVersion: resource.contentHash, expectedRevision: view.revision, operationId: 'catalog_' + crypto.randomUUID(), metadata
        };
        if (!validCatalogSave(input)) {
            setMessage('目录最多128字，标签最多16个、每个64字；请移除控制字符。');
            return;
        }
        const stamp = ++epoch.current, id = identity;
        pending.current = input;
        hold(true);
        setBusy(true);
        setMessage('');
        try {
            const next = await window.omniEdu!.saveMaterialCatalogMetadata(input);
            if (!alive.current || stamp !== epoch.current || target.current !== id)
                return;
            if (!catalogSaveObserved(next, input))
                throw Error('unknown_save');
            accept(next);
            setMessage('目录与标签已保存；原文件与正文不变。');
            callbacks.current.onSaved();
        }
        catch {
            if (alive.current && stamp === epoch.current && target.current === id) {
                setUnknown(true);
                hold(true);
                setMessage('提交结果待核实，草稿已保留。请先只读核实，不要重复保存。');
            }
        }
        finally {
            if (alive.current && stamp === epoch.current)
                setBusy(false);
        }
    }
    async function checkSaved() {
        const input = pending.current;
        if (!input || busy)
            return;
        const stamp = ++epoch.current, id = identity;
        setBusy(true);
        try {
            await reconcile(input, stamp, id);
        }
        catch {
            if (alive.current && stamp === epoch.current)
                setMessage('当前版本或连接已变化，结果仍待核实；草稿保留，不会重写。');
        }
        finally {
            if (alive.current && stamp === epoch.current)
                setBusy(false);
        }
    }
    function cancel() {
        if (busy)
            return;
        ++epoch.current;
        ++editEpoch.current;
        if (unknown) {
            pending.current = undefined;
            setUnknown(false);
            setView(undefined);
            setDirectory('');
            setTags('');
            hold(false);
            setReload(v => v + 1);
            setMessage('已放弃本地草稿；不会撤销已提交的数据。正在重新读取已保存状态。');
        }
        else if (view) {
            accept(view);
            setMessage('已恢复已保存的目录与标签。');
        }
    }
    return <section
        className={styles.editor}
        aria-label="资料组织"
        data-testid="material-catalog-editor"
        data-resource-id={resource.id}
        data-unknown={unknown ? 'true' : 'false'}
    >
  <h3>目录与标签</h3><p className={styles.caption}>仅整理本机资料分类，不移动原文件，也不改变正文或读取权限。</p>
  <label className={styles.field}>教学目录<input
        className={styles.control}
        value={directory}
        maxLength={128}
        disabled={!view || busy || unknown}
        onChange={e => changed('directory', e.target.value)}
        placeholder="未整理"
        data-testid="material-catalog-directory"
    /></label>
  <label className={styles.field}>标签（逗号分隔）<input
        className={styles.control}
        value={tags}
        maxLength={1100}
        disabled={!view || busy || unknown}
        onChange={e => changed('tags', e.target.value)}
        data-testid="material-catalog-tags"
    /></label>
  <div className={styles.actions}><Button
        variant="secondary"
        isDisabled={!view || !dirty || busy || unknown}
        onPress={() => void save()}
        data-testid="material-catalog-save"
    >保存组织信息</Button>
   <Button variant="ghost" isDisabled={busy || !dirty && !unknown} onPress={cancel} data-testid="material-catalog-cancel">{unknown ? '放弃本地草稿（不撤销提交）' : '取消修改'}</Button>
   {unknown && <Button
        variant="secondary"
        isDisabled={busy}
        onPress={() => void checkSaved()}
        data-testid="material-catalog-reconcile"
    >只读核实已保存状态</Button>}</div>
  {message && <p role="status" data-testid="material-catalog-message">{message}</p>}
 </section>;
}
