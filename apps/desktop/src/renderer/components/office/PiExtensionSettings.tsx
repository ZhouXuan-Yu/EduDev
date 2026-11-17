import {Button} from '@heroui/react';
import {type AcquisitionExtensionView} from '../../../shared/xiaozhi-acquisition';
import {DisclosureCard} from '../ui/DisclosureCard';
import {SettingsSection} from './hana-settings/SettingsSection';
import {SettingsRow} from './hana-settings/SettingsRow';
import {SettingsStack} from './hana-settings/SettingsPrimitives';
import {usePiAcquisition, acquisitionMessage as message} from './usePiAcquisition';

const phases: Record<AcquisitionExtensionView['phase'], string> = {
  quarantined: '隔离待准备', preparing: '正在安装与检查', prepared: '准备已完成',
  needs_approval: '等待授权', cancelled: '已取消', failed: '准备失败',
};

export function PiExtensionSettings({sessionId = ''}: {sessionId?: string}) {
  const {view, section, loading, pending, preparingId, notice, refresh, mutate} = usePiAcquisition(sessionId);
  const extensions = view?.extensions || [];
  const busy = pending !== null;
  return <div ref={section} data-testid="pi-extensions" data-session-id={sessionId}>
    <SettingsSection title="本地扩展" description="导入本地扩展包，在当前小智任务中准备并选择所需版本。">
      <SettingsStack gap="sm">
        {!sessionId ? <p role="status">{message('task_required')}</p> : <>
          <Button size="sm" data-testid="pi-extension-import" isDisabled={busy}
            onPress={() => void mutate({action: 'extension_import', sessionId})}>导入本地扩展</Button>
          {loading && <p role="status">正在读取扩展状态…</p>}
          {view && !view.context && <p role="status">{message('task_required')} 返回当前小智对话，启动任务后可准备或选择扩展版本。</p>}
          {view && !extensions.length && <p data-testid="pi-extension-empty">尚无本地扩展导入记录。</p>}
          {extensions.map(extension => {
            const cancellable = preparingId === extension.artifactId || extension.phase === 'preparing';
            const selectable = extension.phase === 'prepared' && !extension.revoked;
            return <div key={extension.artifactId} data-testid={`pi-extension-${extension.artifactId}`} data-phase={extension.phase}>
              <SettingsRow label={`${extension.extensionId} · ${extension.version}`}
                hint={`${phases[extension.phase]} · ${extension.revoked ? '已撤销' : extension.enabled ? '已启用' : '未启用'}${extension.active ? ' · 当前版本' : ''}`}
                control={<div className="pi-settings-actions">
                  {(extension.phase !== 'prepared' || !extension.enabled) && <Button size="sm"
                    data-testid={`pi-extension-prepare-${extension.artifactId}`}
                    isDisabled={busy || Boolean(preparingId) || !view?.context || cancellable || extension.revoked}
                    onPress={() => void mutate({action: 'extension_prepare', sessionId, artifactId: extension.artifactId, revision: extension.revision})}>
                    {extension.phase === 'failed' || extension.phase === 'cancelled' || extension.phase === 'prepared' || extension.phase === 'needs_approval' ? '重试准备' : '准备扩展'}
                  </Button>}
                  {cancellable && <Button size="sm" variant="ghost" data-testid={`pi-extension-cancel-${extension.artifactId}`} isDisabled={busy}
                    onPress={() => void mutate({action: 'extension_cancel', sessionId, artifactId: extension.artifactId, revision: extension.revision})}>取消准备</Button>}
                  {extension.phase === 'prepared' && <Button size="sm" variant="secondary" data-testid={`pi-extension-select-${extension.artifactId}`}
                    isDisabled={busy || !view?.context || !selectable || (extension.active && extension.enabled)}
                    onPress={() => void mutate({action: 'extension_select', sessionId, extensionId: extension.extensionId, version: extension.version, revision: extension.selectionRevision})}>
                    使用此版本
                  </Button>}
                  <Button size="sm" variant="ghost" data-testid={`pi-extension-disable-${extension.artifactId}`} isDisabled={busy || extension.revoked || !extension.enabled}
                    onPress={() => void mutate({action: 'extension_disable', sessionId, extensionId: extension.extensionId, version: extension.version, revision: extension.selectionRevision})}>停用</Button>
                  <Button size="sm" variant="ghost" data-testid={`pi-extension-revoke-${extension.artifactId}`} isDisabled={busy || extension.revoked}
                    onPress={() => void mutate({action: 'extension_revoke', sessionId, extensionId: extension.extensionId, version: extension.version, revision: extension.selectionRevision})}>撤销扩展</Button>
                </div>}/>
              <p>本地导入 · 信任未知 · 许可证 {extension.license || '待核查'}</p>
              {extension.error && <p role="status">{message(extension.error)}</p>}
              <DisclosureCard data-testid={`pi-extension-details-${extension.artifactId}`} title={<>来源与扩展详情</>}>
                <p>来源标识 {extension.sourceHash}</p><p>目录指纹 {extension.directoryFingerprint}</p>
                <p>声明的 Hook {extension.hooks.join('、') || '无'}</p>
                <p>当前支持 context.transform 上下文转换与 event.observe 事件观察。准备包含依赖安装与运行检查，实际启用按当前任务授权处理。使用此版本可切换到已准备的旧版。</p>
              </DisclosureCard>
            </div>;
          })}
          {preparingId && <p role="status">正在准备扩展，进度以当前扩展记录为准。</p>}
          {busy && <p role="status">正在更新扩展状态…</p>}
          {notice && <p role="alert" data-testid="pi-extension-notice">{notice}</p>}
          <Button size="sm" variant="ghost" data-testid="pi-extension-refresh" isDisabled={busy} onPress={() => void refresh()}>刷新扩展状态</Button>
        </>}
      </SettingsStack>
    </SettingsSection>
  </div>;
}
