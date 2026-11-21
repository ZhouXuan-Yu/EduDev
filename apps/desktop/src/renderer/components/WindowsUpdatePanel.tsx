import {useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {WindowsUpdateCandidate,WindowsUpdateSnapshot,WindowsUpdateStatus} from '../../shared/windows-update';
import {SettingsSection} from './office/hana-settings/SettingsSection';

const messages: Record<WindowsUpdateStatus,string> = {
  ready:'已核对公开发行记录、Windows 签名、文件摘要和升级来源版本。',
  invalid_name:'请选择文件名符合发布格式的小智 Windows x64 安装包。',
  same_or_older:'此安装包的版本没有高于当前小智。',
  signature_invalid:'Windows 未能确认安装包签名有效。',
  release_missing:'项目公开发行记录中找不到对应安装包及其摘要。',
  release_unavailable:'暂时无法查询项目公开发行记录，请稍后重试。',
  package_mismatch:'安装包未与公开发行的 SHA-256 和大小匹配。',
  incompatible:'发行记录未确认支持从当前版本和数据库格式升级。',
  file_unavailable:'暂时无法读取安装包，请重新选择。',
};

export function WindowsUpdatePanel({disabled,onBusyChange}: {
  disabled: boolean; onBusyChange: (busy:boolean) => void;
}) {
  const [candidate,setCandidate] = useState<WindowsUpdateCandidate>();
  const [snapshot,setSnapshot] = useState<WindowsUpdateSnapshot>();
  const [busy,setBusy] = useState(false), [message,setMessage] = useState('');
  const locked = useRef(false);
  async function run(action:'inspect'|'prepare') {
    if (disabled || locked.current) return;
    locked.current = true; setBusy(true); onBusyChange(true); setMessage('');
    try {
      const api = window.omniEdu;
      if (!api) throw Error('更新检查暂不可用，请重新打开小智。');
      if (action === 'inspect') {
        setCandidate(undefined); setSnapshot(undefined);
        const result = await api.inspectWindowsUpdate();
        if (result) setCandidate(result);
        else setMessage('已取消选择安装包。');
      } else if (candidate?.status === 'ready') {
        const result = await api.prepareWindowsUpdate(candidate.id);
        if (result) setSnapshot(result);
        else setMessage('已取消创建更新前快照。');
      }
    } catch(error) {
      setMessage(error instanceof Error ? error.message : '无法完成更新准备，请重试。');
    } finally { locked.current = false; setBusy(false); onBusyChange(false); }
  }
  return <div data-testid="windows-update-panel"><SettingsSection title="Windows 版本更新">
    <p>检查已下载的安装包，先保存可恢复的数据快照。检查签名有效后，会查询小智的公开发行记录。</p>
    <div className="pi-settings-actions">
      <Button variant="outline" isDisabled={disabled||busy} onPress={()=>void run('inspect')}
        data-testid="windows-update-inspect">检查安装包</Button>
      {candidate?.status === 'ready' && !snapshot && <Button variant="secondary" isDisabled={disabled||busy}
        onPress={()=>void run('prepare')} data-testid="windows-update-prepare">创建更新前快照</Button>}
    </div>
    {busy && <p role="status">正在处理更新准备…</p>}
    {candidate && <div data-testid="windows-update-candidate" data-check={candidate.status}>
      <p>{candidate.fileName}</p>
      <p>当前版本 {candidate.currentVersion} · 数据格式 {candidate.dataVersion}{candidate.targetVersion &&
        ` · 安装包版本 ${candidate.targetVersion}`}{candidate.targetDataVersion !== undefined &&
        ` · 目标数据格式 ${candidate.targetDataVersion}`}</p>
      <p role="status">{messages[candidate.status]}</p>
    </div>}
    {snapshot && <div data-testid="windows-update-snapshot" role="status">
      <p>更新前快照已创建并通过校验，应用当前仍为 {snapshot.currentVersion}。</p>
      <p className="pi-settings-location">{snapshot.snapshotPath}</p>
      <p className="pi-settings-location">{snapshot.recordPath}</p>
      <p>请将旧版安装包和这份快照一并保留，以便需要时恢复。</p>
    </div>}
    {message && <p role="status" data-testid="windows-update-feedback">{message}</p>}
  </SettingsSection></div>;
}
