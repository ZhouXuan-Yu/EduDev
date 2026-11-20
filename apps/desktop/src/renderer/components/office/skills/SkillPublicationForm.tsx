import {useState, type Ref} from 'react';
import {Button} from '@heroui/react';
import type {SkillDraftInput} from '../../../../shared/xiaozhi-skill-governance';

export function SkillPublicationForm({disabled, publish, close, formRef, initialName = '', initialVersion = '1.0.0', team = false}: {
  disabled: boolean; publish: (draft: SkillDraftInput) => Promise<void>; close: () => void;
  formRef?: Ref<HTMLFormElement>; initialName?: string; initialVersion?: string; team?: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [document, setDocument] = useState('');
  const [version, setVersion] = useState(initialVersion);
  return <form ref={formRef} data-testid="pi-skill-publication-form" onSubmit={event => {
    event.preventDefault();
    void publish({name, description, document, version, dependencies: [], permissionRequirements: []});
  }}>
    <h3>{team ? '提交团队新版本' : '保存个人工作方法'}</h3>
    <p>仅保存通用说明。学生信息、私有资料正文、凭据和执行脚本会被发布检查阻断。</p>
    <label>技能名称<input data-testid="pi-skill-create-name" value={name} maxLength={64}
      placeholder="lesson-review" required pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={disabled || team} onChange={event => setName(event.target.value)} /></label>
    <label>用途<input data-testid="pi-skill-create-description" value={description} maxLength={1024}
      required disabled={disabled} onChange={event => setDescription(event.target.value)} /></label>
    <label>版本<input data-testid="pi-skill-create-version" value={version} pattern="[0-9]+\.[0-9]+\.[0-9]+"
      required disabled={disabled} onChange={event => setVersion(event.target.value)} /></label>
    <label>可复用说明<textarea data-testid="pi-skill-create-document" value={document} maxLength={30000}
      rows={8} required disabled={disabled} onChange={event => setDocument(event.target.value)} /></label>
    <div className="pi-skills-toolbar">
      <Button type="submit" size="sm" isDisabled={disabled || !name || !description || !document} data-testid="pi-skill-publish">检查并发布</Button>
      <Button type="button" size="sm" variant="ghost" isDisabled={disabled} onPress={close}>取消</Button>
    </div>
  </form>;
}
