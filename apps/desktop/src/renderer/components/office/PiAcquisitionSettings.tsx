import {useEffect, useState} from 'react';
import {Button, Input, Label, TextField} from '@heroui/react';
import {type AcquisitionArtifactView, type AcquisitionOperationView, type AcquisitionPhase, type DiscoverySource} from '../../../shared/xiaozhi-acquisition';
import {DisclosureCard} from '../ui/DisclosureCard';
import {SettingsSection} from './hana-settings/SettingsSection';
import {SettingsRow} from './hana-settings/SettingsRow';
import {SettingsStack} from './hana-settings/SettingsPrimitives';
import {usePiAcquisition, acquisitionMessage as message} from './usePiAcquisition';

type Mode = 'discovery' | 'installed' | 'environment';
const sources: Record<DiscoverySource, string> = {
  official_mcp: '官方 MCP 目录', github: 'GitHub', community: '社区目录', reviewed: '已审核目录',
};
const phases: Record<AcquisitionPhase, string> = {
  discovered: '已发现候选', quarantined: '隔离待审查', resolving: '正在核对来源与依赖',
  needs_approval: '等待授权', downloading: '正在下载', verifying: '正在验证', registering: '正在登记能力',
  ready: '已就绪', failed: '准备失败', cancelled: '已取消', interrupted: '准备已中断', revoked: '已撤销',
};
const artifactStates = {verifying: '验证中', ready: '已就绪', revoked: '已撤销', failed: '验证失败'};
const sourceStates = {online: '在线', cached: '离线缓存', unavailable: '来源不可用'};
const progress = new Set<AcquisitionPhase>(['resolving', 'downloading', 'verifying', 'registering']);
const retryable = new Set<AcquisitionPhase>(['needs_approval', 'failed', 'cancelled', 'interrupted']);

function readyValidity(artifact: AcquisitionArtifactView | undefined) {
  if (artifact?.status !== 'ready') return {current: false, notice: ''};
  const expiresAt = Date.parse(artifact.expiresAt);
  if (!Number.isFinite(expiresAt)) return {current: false, notice: '有效期无法确认，请重新核验。'};
  const current = expiresAt > Date.now();
  return {current, notice: current ? '' : '有效期已到，请重新核验。'};
}

export function PiAcquisitionSettings({sessionId = '', mode = 'discovery'}: {sessionId?: string; mode?: Mode}) {
  const {view, section, loading, pending, preparingId, notice, refresh, search, mutate} = usePiAcquisition(sessionId);
  const [query, setQuery] = useState('');
  useEffect(() => setQuery(''), [sessionId]);
  const title = mode === 'discovery' ? '发现与准备外部能力' : mode === 'installed' ? '受管外部能力' : '外部能力诊断';
  const operations = view?.operations || [];
  function latestOperation(candidateId: string) {
    return operations.filter(operation => operation.candidateId === candidateId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }
  function operationRunning(operation: AcquisitionOperationView) {
    return (operation.running ?? progress.has(operation.phase))
      || (preparingId === operation.candidateId && latestOperation(operation.candidateId)?.id === operation.id);
  }
  return <div ref={section} data-testid={`pi-acquisition-${mode}`} data-session-id={sessionId}>
    <SettingsSection title={title} surface="plain"><SettingsStack gap="sm">
      {!sessionId ? <p role="status" data-testid="pi-acquisition-task-required">{message('task_required')}</p> : <>
        {mode === 'discovery' && <>
          <form data-testid="pi-acquisition-search-form" onSubmit={event => {event.preventDefault(); void search(query);}}>
            <TextField value={query} onChange={setQuery} isDisabled={pending !== null}>
              <Label>搜索公开能力目录</Label><Input data-testid="pi-acquisition-query" maxLength={200}/>
            </TextField>
            <Button size="sm" type="submit" data-testid="pi-acquisition-search" isDisabled={pending !== null || !query.trim()}>搜索</Button>
          </form>
          {view && !view.context && !loading && <p role="status" data-testid="pi-acquisition-task-required">{message('task_required')} 返回当前小智对话，启动需要该能力的任务后再准备。</p>}
          {view?.sourceStatus?.map(source => <p key={source.source} data-testid={`pi-acquisition-source-${source.source}`}>
            {sources[source.source]} · {sourceStates[source.status]}{source.error ? ` · ${message(source.error)}` : ''}
          </p>)}
        </>}
        {loading && <p role="status">正在读取能力状态…</p>}
        {mode === 'discovery' && view && !view.candidates.length && <p data-testid="pi-acquisition-empty">没有可展示的候选，可搜索其他关键词。</p>}
        {mode === 'discovery' && view?.candidates.map(candidate => {
          const latest = latestOperation(candidate.id);
          const installed = view.artifacts.find(artifact => artifact.id === latest?.artifactId);
          const validity = readyValidity(installed);
          return <div key={candidate.id} data-testid={`pi-acquisition-candidate-${candidate.id}`}>
            <SettingsRow label={candidate.name} hint={candidate.description} control={<Button size="sm"
              data-testid={`pi-acquisition-prepare-${candidate.id}`}
              isDisabled={pending !== null || Boolean(preparingId) || !view.context || Boolean(latest && operationRunning(latest)) || validity.current}
              onPress={() => void mutate({action: 'prepare', sessionId, candidateId: candidate.id})}>
              {validity.notice ? '重新核验' : latest && retryable.has(latest.phase) ? '重试准备' : latest?.phase === 'quarantined' ? '重新核查' : '准备能力'}
            </Button>}/>
            <p>版本 {candidate.version || '待核查'} · {sources[candidate.source]} · 许可证 {installed?.license || '待核查'}</p>
            {validity.notice && <p role="status">{validity.notice}</p>}
            <DisclosureCard title={<>来源与连接详情</>}>
              <p>{candidate.repository || candidate.packageName || candidate.externalId}</p>
              <p>{candidate.transport === 'stdio' ? '本地 stdio' : candidate.transport === 'http' ? '远程 HTTP' : '连接方式待核查'}</p>
              <p>来源标识 {candidate.sourceHash}</p>
            </DisclosureCard>
          </div>;
        })}
        {operations.map(operation => <div key={operation.id} data-testid={`pi-acquisition-operation-${operation.id}`} data-phase={operation.phase}>
          <p role="status">{view?.candidates.find(candidate => candidate.id === operation.candidateId)?.name || '能力准备'} · {phases[operation.phase]}</p>
          {operation.error && <p role="status">{message(operation.error)}</p>}
          {operationRunning(operation) && <Button size="sm" variant="ghost" data-testid={`pi-acquisition-cancel-${operation.id}`}
            isDisabled={pending !== null} onPress={() => void mutate({action: 'cancel', sessionId, operationId: operation.id, revision: operation.revision})}>取消准备</Button>}
        </div>)}
        {mode !== 'discovery' && view && !view.artifacts.length && <p data-testid="pi-acquisition-installed-empty">尚无受管外部能力安装记录。</p>}
        {mode !== 'discovery' && view?.artifacts.map(artifact => {
          const validity = readyValidity(artifact);
          return <div key={artifact.id} data-testid={`pi-acquisition-artifact-${artifact.id}`} data-status={artifact.status}>
          <SettingsRow label={`${artifact.name} · ${artifact.version}`} hint={`运行状态 · ${validity.notice || artifactStates[artifact.status]}`} control={
            <Button size="sm" variant="ghost" data-testid={`pi-acquisition-revoke-${artifact.id}`} isDisabled={pending !== null || artifact.status === 'revoked'}
              onPress={() => void mutate({action: 'revoke', sessionId, artifactId: artifact.id, revision: artifact.revision})}>撤销能力</Button>}/>
          <p>{sources[artifact.source as DiscoverySource] || artifact.source} · 许可证 {artifact.license} · 已保存 {artifact.installedBytes.toLocaleString()} 字节</p>
          <DisclosureCard title={<>安装记录详情</>}>
            <p>有效期 {Number.isFinite(Date.parse(artifact.expiresAt)) ? new Date(artifact.expiresAt).toLocaleString() : '无法确认'}</p>
            {artifact.schemaHash && <p>工具目录标识 {artifact.schemaHash}</p>}
          </DisclosureCard>
        </div>;})}
        {pending && <p role="status">{pending === 'search' ? '正在检索来源…' : '正在更新能力状态…'}</p>}
        {preparingId && <p role="status">正在准备能力，进度以当前操作记录为准。</p>}
        {notice && <p role="alert" data-testid={`pi-acquisition-notice-${mode}`}>{notice}</p>}
        <Button size="sm" variant="ghost" data-testid={`pi-acquisition-refresh-${mode}`} isDisabled={pending !== null} onPress={() => void refresh()}>刷新能力状态</Button>
      </>}
    </SettingsStack></SettingsSection>
  </div>;
}
