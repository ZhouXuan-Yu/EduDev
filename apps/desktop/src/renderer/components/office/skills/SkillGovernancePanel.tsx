import {AppNativeSelect} from '../../ui/AppNativeSelect';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Button} from '@heroui/react';
import {SKILL_GOVERNANCE_ERRORS, type SkillGovernanceMutation, type SkillGovernanceView} from '../../../../shared/xiaozhi-skill-governance';
import {SkillPublicationForm} from './SkillPublicationForm';
import {DisclosureCard} from '../../ui/DisclosureCard';

const scopeLabels = {personal: '个人', team: '团队', official: '官方'};
const stateLabels = {draft: '检查未通过', published: '已发布', pending_review: '待审核', rejected: '审核拒绝', withdrawn: '已撤回'};
const provenanceLabels = {legacy: '历史技能', creator: '小智创建', teacher: '教师创建', team_copy: '团队分享副本', official_review: '官方审核副本'};
export function SkillGovernancePanel({disabled, onChanged}: {disabled: boolean; onChanged: () => Promise<void>}) {
  const [view, setView] = useState<SkillGovernanceView>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [readNotice, setReadNotice] = useState('');
  const readRevisionRef = useRef(0);
  const [creating, setCreating] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);
  const [selected, setSelected] = useState('');
  const [teamName, setTeamName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [officialSource, setOfficialSource] = useState('');
  const [license, setLicense] = useState('');
  const [tests, setTests] = useState('');
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const teamTriggerRef = useRef<HTMLButtonElement>(null);
  const personalFormRef = useRef<HTMLFormElement>(null);
  const teamFormRef = useRef<HTMLFormElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  function closePublicationForm(team: boolean) {
    const active = document.activeElement;
    const form = team ? teamFormRef.current : personalFormRef.current;
    returnFocusRef.current = active === document.body || form?.contains(active)
      ? (team ? teamTriggerRef.current : createTriggerRef.current) : null;
    if (team) setEditingTeam(false);
    else setCreating(false);
  }
  async function refresh() {
    const revision = ++readRevisionRef.current;
    try {
      const result = await window.omniEdu?.getXiaozhiSkillGovernance();
      if (revision !== readRevisionRef.current) return;
      if (result?.ok) { setView(result.value); setReadNotice(''); }
      else setReadNotice(result ? SKILL_GOVERNANCE_ERRORS[result.error] : '技能治理数据暂时无法读取。');
    } catch {
      if (revision === readRevisionRef.current) setReadNotice('技能治理数据暂时无法读取。');
    }
  }
  useEffect(() => { void refresh(); return () => { readRevisionRef.current++; }; }, []);
  async function mutate(input: SkillGovernanceMutation) {
    if (busy || disabled) return;
    readRevisionRef.current++;
    setBusy(true); setNotice('');
    try {
      const result = await window.omniEdu?.mutateXiaozhiSkillGovernance(input);
      if (!result?.ok) setNotice(result ? SKILL_GOVERNANCE_ERRORS[result.error] : '操作暂时无法确认。');
      else {
        setView(result.value);
        setReadNotice('');
        setNotice('变更已保存。版本状态和检查结果已更新。');
        if (input.action === 'create') {
          closePublicationForm(false);
          const created = result.value.skills.find(skill => skill.scope === 'personal' && skill.name === input.draft.name);
          if (created) {
            setSelected(created.id);
            const version = result.value.versions.find(version => version.skillId === created.id && version.version === input.draft.version);
            if (version?.state === 'draft') setNotice('检查未通过，草稿已安全保存。请按下面的检查结果修正后重试。');
          }
        }
        if (input.action === 'team_edit') closePublicationForm(true);
        await onChanged();
      }
    } catch { setNotice('操作暂时无法确认，请刷新后核对。'); }
    finally { setBusy(false); }
  }
  const skill = view?.skills.find(item => item.id === selected);
  const versions = view?.versions.filter(item => item.skillId === selected) || [];
  const blocked = disabled || busy;
  useLayoutEffect(() => {
    const trigger = returnFocusRef.current;
    if (!trigger) return;
    if (!trigger.isConnected || (document.activeElement !== document.body && document.activeElement !== trigger)) {
      returnFocusRef.current = null;
      return;
    }
    if (blocked) return;
    returnFocusRef.current = null;
    trigger.focus();
  }, [creating, editingTeam, blocked]);
  return <section data-testid="pi-skill-governance" aria-label="技能归属与版本">
    <div className="pi-skills-toolbar">
      <Button ref={createTriggerRef} size="sm" variant="secondary" data-testid="pi-skill-create" isDisabled={blocked} onPress={() => setCreating(true)}>保存工作方法</Button>
      <Button size="sm" variant="ghost" data-testid="pi-skill-governance-refresh" isDisabled={busy} onPress={() => void refresh()}>刷新版本</Button>
    </div>
    {(readNotice || notice) && <p role="status" data-testid="pi-skill-governance-notice">{readNotice || notice}</p>}
    {!view && !readNotice && !notice && <p role="status">正在读取归属与版本…</p>}
    {creating && <SkillPublicationForm formRef={personalFormRef} disabled={blocked} close={() => closePublicationForm(false)} publish={draft => mutate({action: 'create', draft})} />}
    {view && <>
      <p>当前教师 {view.actor.displayName}。个人技能默认私有。</p>
      <label>版本与来源<AppNativeSelect data-testid="pi-skill-governance-select" value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">选择技能</option>
        {view.skills.map(item => <option key={item.id} value={item.id}>{scopeLabels[item.scope]} · {item.title}{item.archived ? ' · 已归档' : ''}</option>)}
      </AppNativeSelect></label>
      {skill && <div data-testid="pi-skill-version-history">
        <h3>{scopeLabels[skill.scope]} · {skill.title}</h3>
        <p>当前版本 {skill.activeVersion || '未激活'}{skill.autoActivate ? `，待安全点激活 ${skill.autoActivate}` : ''}</p>
        {skill.scope === 'team' && ['admin', 'maintainer'].includes(view.membership?.role || '') && <>
          <Button ref={teamTriggerRef} size="sm" variant="secondary" data-testid="pi-skill-team-edit" isDisabled={blocked}
            onPress={() => setEditingTeam(true)}>提交团队新版本</Button>
          {editingTeam && <SkillPublicationForm key={skill.id} formRef={teamFormRef} disabled={blocked} team initialName={skill.name}
            initialVersion={`${Math.max(0, ...versions.map(version => Number(version.version.split('.')[0]))) + 1}.0.0`}
            close={() => closePublicationForm(true)} publish={draft => mutate({action: 'team_edit', skillId: skill.id, revision: skill.revision, draft})} />}
        </>}
        {versions.map(version => <article key={version.version} data-testid="pi-skill-version" data-version={version.version}>
          <p>v{version.version} · {stateLabels[version.state]}{skill.activeVersion === version.version ? ' · 当前' : ''}</p>
          <p>来源 {provenanceLabels[version.provenance.kind]}{version.provenance.sourceVersion ? ` · 原版本 ${version.provenance.sourceVersion}` : ''}</p>
          <DisclosureCard title="版本详情">
            <p>内容指纹 <code>{version.sha256}</code></p>
            {version.provenance.sourceSkillId && <p>原技能标识 <code>{version.provenance.sourceSkillId}</code></p>}
          </DisclosureCard>
          {version.validation.checks.filter(check => check.reasons.length).map(check => <p key={check.kind} role="status">{check.kind} · {check.reasons.join('、')}</p>)}
          {version.dependencies.map(dependency => <p key={dependency.capabilityId}>依赖 {dependency.capabilityId} · {dependency.contractVersion}{dependency.required ? ' · 必需' : ' · 可选'}</p>)}
          {version.permissionRequirements.length > 0 && <p>使用时核对实际授权 {version.permissionRequirements.join('、')}。发布记录不能授予这些权限。</p>}
          <div className="pi-skills-toolbar">
            <Button size="sm" variant="secondary" data-testid="pi-skill-version-activate" isDisabled={blocked || version.state !== 'published' || skill.activeVersion === version.version}
              onPress={() => void mutate({action: 'activate', skillId: skill.id, version: version.version, revision: skill.revision})}>使用此版本</Button>
            {skill.scope === 'personal' && <>
              <Button size="sm" variant="ghost" data-testid="pi-skill-share" isDisabled={blocked || version.state !== 'published' || !view.membership}
                onPress={() => void mutate({action: 'share', skillId: skill.id, version: version.version, revision: skill.revision})}>分享团队副本</Button>
              <Button size="sm" variant="ghost" data-testid="pi-skill-version-withdraw" isDisabled={blocked || version.state === 'withdrawn'}
                onPress={() => void mutate({action: 'withdraw', skillId: skill.id, version: version.version, revision: skill.revision})}>撤回此版本</Button>
            </>}
          </div>
        </article>)}
        {skill.scope === 'personal' && <fieldset disabled={blocked}>
          <legend>申请官方审核</legend>
          <label>来源<input value={officialSource} onChange={event => setOfficialSource(event.target.value)} /></label>
          <label>许可证<input value={license} onChange={event => setLicense(event.target.value)} /></label>
          <label>测试证据<input value={tests} onChange={event => setTests(event.target.value)} /></label>
          <Button size="sm" variant="ghost" isDisabled={blocked || !skill.activeVersion || !officialSource || !license || !tests}
            onPress={() => skill.activeVersion && void mutate({action: 'official_submit', skillId: skill.id, version: skill.activeVersion,
              revision: skill.revision, metadata: {source: officialSource, license, compatibility: 'xiaozhi.skill.v1', testReferences: [tests]}})}>提交审核副本</Button>
        </fieldset>}
      </div>}
      <section aria-label="团队技能">
        <h3>{view.team ? `团队 · ${view.team.name}` : '团队'}</h3>
        {view.team && view.membership ? <>
          <p>{view.membership.role === 'admin' ? '团队管理员' : view.membership.role === 'maintainer' ? '团队维护者' : '团队成员'}。分享副本经管理员审核后对成员可用。</p>
          {view.membership.role === 'admin' && <div>
            <label>本地教师 ID<input data-testid="pi-skill-team-member" value={memberId} onChange={event => setMemberId(event.target.value)} /></label>
            <Button size="sm" variant="ghost" isDisabled={blocked || !memberId} onPress={() => void mutate({action: 'team_add',
              userId: memberId, role: 'member', revision: view.team!.revision})}>添加成员</Button>
          </div>}
          <Button size="sm" variant="ghost" data-testid="pi-skill-team-leave" isDisabled={blocked}
            onPress={() => void mutate({action: 'team_leave', revision: view.membership!.revision})}>离开团队</Button>
        </> : <div>
          <label>本地团队名称<input data-testid="pi-skill-team-name" value={teamName} onChange={event => setTeamName(event.target.value)} /></label>
          <Button size="sm" variant="secondary" data-testid="pi-skill-team-create" isDisabled={blocked || !teamName}
            onPress={() => void mutate({action: 'team_create', name: teamName})}>创建本地团队</Button>
        </div>}
      </section>
      <section aria-label="技能审核" data-testid="pi-skill-reviews">
        {view.reviews.filter(review => review.status === 'pending').map(review => <article key={review.id} data-testid="pi-skill-review" data-review-id={review.id}>
          <p>{scopeLabels[review.scope]}审核 · v{review.version} · 待审核</p>
          {review.metadata.license === 'private-team-copy'
            ? <p>来源 个人技能副本 · 团队内分享</p>
            : <p>来源 {review.metadata.source} · 许可证 {review.metadata.license}</p>}
          <DisclosureCard title="审核副本详情">
            {review.metadata.license === 'private-team-copy' && <p>原来源 <code>{review.metadata.source}</code> · {review.metadata.license}</p>}
            <p>副本标识 <code>{review.skillId}</code></p>
            <p>内容指纹 <code>{review.sha256}</code></p>
          </DisclosureCard>
          {(review.scope === 'team' && view.membership?.role === 'admin' || review.scope === 'official' && view.officialReviewer) && <div className="pi-skills-toolbar">
            <Button size="sm" data-testid="pi-skill-review-approve" isDisabled={blocked} onPress={() => void mutate({action: 'review', reviewId: review.id, revision: review.revision, approve: true})}>批准发布</Button>
            <Button size="sm" variant="ghost" data-testid="pi-skill-review-reject" isDisabled={blocked} onPress={() => void mutate({action: 'review', reviewId: review.id, revision: review.revision, approve: false})}>拒绝</Button>
          </div>}
        </article>)}
      </section>
    </>}
  </section>;
}
