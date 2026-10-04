import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from '@heroui/react';
import { XIAOZHI_SKILL_ERRORS, type XiaozhiSkillCatalog, type XiaozhiSkillMutation, type XiaozhiSkillPreview } from '../../../shared/xiaozhi-skills';
import { SkillRow } from './hana-skills/SkillRow';
import './pi-skill-settings.css';

export function PiSkillSettings({ running, onClose, onChanged, embedded = false, onBusyChange }: { running: boolean; onClose: () => void; onChanged: () => Promise<void>; embedded?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [catalog, setCatalog] = useState<XiaozhiSkillCatalog>();
  const [preview, setPreview] = useState<XiaozhiSkillPreview>();
  const [selected, setSelected] = useState(''), [document, setDocument] = useState('');
  const [editing, setEditing] = useState(false), [showArchived, setShowArchived] = useState(false), [archiveName, setArchiveName] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [notice, setNotice] = useState('');
  const lock = useRef(false), request = useRef(0), live = useRef(true);
  const disabled = busy || loading || running || Boolean(catalog?.locked);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  async function reload() {
    if (lock.current) return;
    setLoading(true); const stamp = ++request.current;
    try {
      const result = await window.omniEdu?.getXiaozhiSkills();
      if (!live.current || stamp !== request.current) return;
      if (result?.ok) setCatalog(result.value); else setNotice(result ? XIAOZHI_SKILL_ERRORS[result.error] : '技能列表未读取，请重试。');
    } catch { if (live.current) setNotice('技能列表未读取，请重试。'); }
    finally { if (live.current && stamp === request.current) setLoading(false); }
  }
  useEffect(() => { live.current = true; void reload(); return () => { live.current = false; request.current++; }; }, [running]);
  async function view(name: string) {
    if (lock.current) return;
    const stamp = ++request.current; setSelected(name); setPreview(undefined); setEditing(false); setArchiveName(''); setNotice(''); setLoading(true);
    try {
      const result = await window.omniEdu?.previewXiaozhiSkill({ name });
      if (!live.current || stamp !== request.current) return;
      if (result?.ok) { setPreview(result.value); setDocument(result.value.document); }
      else setNotice(result ? XIAOZHI_SKILL_ERRORS[result.error] : '说明未读取，请重试。');
    } catch { if (live.current) setNotice('说明未读取，请重试。'); }
    finally { if (live.current && stamp === request.current) setLoading(false); }
  }
  async function mutate(input: XiaozhiSkillMutation, message: string) {
    if (disabled || lock.current) return;
    lock.current = true; setBusy(true); setNotice(''); request.current++;
    try {
      const result = await window.omniEdu?.manageXiaozhiSkill(input);
      if (!live.current) return;
      if (!result?.ok) {
        setNotice(result ? XIAOZHI_SKILL_ERRORS[result.error] : '操作未确认，请重试。');
        if (result && ['stale_version', 'busy'].includes(result.error)) {
          const latest = await window.omniEdu?.getXiaozhiSkills(); if (live.current && latest?.ok) setCatalog(latest.value);
        }
        return;
      }
      const next = result.value.catalog; setCatalog(next); setArchiveName('');
      setNotice(result.value.cancelled ? '已取消导入，技能列表保持不变。' : message);
      if (!result.value.cancelled && input.action === 'archive') { setSelected(''); setPreview(undefined); setEditing(false); setDocument(''); }
      if (!result.value.cancelled && (input.action === 'edit' || input.action === 'import')) {
        const name = input.action === 'edit' ? input.name : next.skills.find(item => !item.archived && !catalog?.skills.some(old => old.name === item.name && !old.archived))?.name;
        if (name) {
          const content = await window.omniEdu?.previewXiaozhiSkill({ name });
          if (live.current && content?.ok) { setSelected(name); setPreview(content.value); setDocument(content.value.document); setEditing(false); }
        }
      }
      if (!result.value.cancelled) await onChanged().catch(() => { if (live.current) setNotice('技能已保存，工作区暂时无法刷新；请关闭后重新打开会话。'); });
    } catch { if (live.current) setNotice('操作未确认，请刷新列表后核对。'); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  }
  const skill = catalog?.skills.find(item => item.name === selected), items = catalog?.skills.filter(item => item.archived === showArchived) || [];
  const content = <>
        <div className="pi-skills-toolbar">
          <Button size="sm" variant="secondary" data-testid="pi-skill-import" isDisabled={disabled || !catalog} onPress={() => catalog && void mutate({ action: 'import', revision: catalog.revision }, '技能已导入，默认关闭。请预览后明确启用。')}>导入本地技能</Button>
          <Button size="sm" variant="ghost" data-testid="pi-skill-refresh" isDisabled={busy} onPress={() => void reload()}>刷新</Button>
          <Button size="sm" variant="ghost" data-testid="pi-skill-show-archived" isDisabled={busy} aria-pressed={showArchived} onPress={() => { setShowArchived(value => !value); setSelected(''); setPreview(undefined); setEditing(false); }}> {showArchived ? '返回可用技能' : '已归档'}</Button>
        </div>
        {(running || catalog?.locked) && <p role="status">任务进行时可以查看说明。请先完成或停止任务，再修改技能。</p>}
        {notice && <p role="status" data-testid="pi-skill-settings-notice">{notice}</p>}
        {loading && <p role="status">正在读取本地技能…</p>}
        <div className="pi-skills-layout">
          <section aria-label="技能列表" data-testid="pi-skill-list">
            {catalog && !items.length && <p>这里还没有{showArchived ? '已归档的' : '可用的'}技能。</p>}
            {items.map(item => <SkillRow key={item.name} skill={item} disabled={disabled} nameHint={`${item.origin === 'builtin' ? '内建' : '自定义'} · v${item.version}${item.archived ? ' · 已归档' : item.enabled ? ' · 已启用' : ' · 已关闭'}`}
              deletable={item.origin === 'teacher' && !item.archived} onDelete={name => setArchiveName(name)}
              onToggle={item.archived ? undefined : (name, enabled) => catalog && void mutate({ action: 'enable', name, enabled, revision: catalog.revision }, enabled ? '技能已启用。' : '技能已关闭。旧技能上下文将在下一轮隔离。')}
              extraActions={!item.archived && <Button size="sm" variant="ghost" data-testid={`pi-skill-preview-${item.name}`} isDisabled={busy || loading} onPress={() => void view(item.name)}>预览</Button>} />)}
          </section>
          <section className="pi-skills-details" aria-label="技能说明">
            {preview && skill ? <>
              <h3>{skill.title} <span>v{preview.version}</span></h3>
              <p>{skill.origin === 'builtin' ? '内建技能由应用维护，可以查看和启停。' : '说明在本机保存。启用后，小智可以使用必要的脱敏文本；技能不会增加工具权限。'}</p>
              {editing ? <><label htmlFor="pi-skill-document">完整技能说明</label><textarea id="pi-skill-document" data-testid="pi-skill-edit-document" value={document} onChange={event => setDocument(event.target.value)} disabled={busy} maxLength={32768} />
                <div className="pi-skills-toolbar"><Button size="sm" data-testid="pi-skill-save-edit" isDisabled={disabled || !catalog || !document.trim()} onPress={() => catalog && void mutate({ action: 'edit', name: skill.name, document, revision: catalog.revision }, '新版本已保存并关闭。请核对说明后重新启用。')}>保存新版本</Button><Button size="sm" variant="ghost" isDisabled={busy} onPress={() => { setEditing(false); setDocument(preview.document); }}>取消编辑</Button></div></>
                : <><pre data-testid="pi-skill-full-document">{preview.document}</pre>{skill.origin === 'teacher' && <Button size="sm" variant="secondary" data-testid="pi-skill-edit" isDisabled={disabled} onPress={() => setEditing(true)}>编辑说明</Button>}</>}
            </> : <p>选择技能查看完整说明。导入后默认关闭。</p>}
          </section>
        </div>
        {archiveName && catalog && <div className="pi-skills-archive" data-testid="pi-skill-archive-confirm"><p>归档此技能后将关闭其使用权限，原文件和旧版本保留。</p><Button size="sm" isDisabled={disabled} data-testid="pi-skill-confirm-archive" onPress={() => void mutate({ action: 'archive', name: archiveName, revision: catalog.revision }, '技能已归档，原文件和旧版本保留。')}>确认归档</Button><Button size="sm" variant="ghost" isDisabled={busy} onPress={() => setArchiveName('')}>取消</Button></div>}
  </>;
  if (embedded) return <section className="pi-skills-dialog pi-skills-embedded" data-testid="pi-skills-settings"><h1>技能</h1><p>整理小智处理教育与办公任务的工作方法。</p>{content}</section>;
  return <Modal.Backdrop isOpen isDismissable={!busy} onOpenChange={open => { if (!open && !lock.current) onClose(); }}>
    <Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-skills-dialog" data-testid="pi-skills-settings">
      <Modal.Header><Modal.Heading>技能</Modal.Heading><p>整理小智处理教育与办公任务的工作方法。</p></Modal.Header>
      <Modal.Body>{content}</Modal.Body>
      <Modal.Footer><Button variant="secondary" data-testid="pi-skills-close" isDisabled={busy} onPress={onClose}>关闭</Button></Modal.Footer>
    </Modal.Dialog></Modal.Container>
  </Modal.Backdrop>;
}
