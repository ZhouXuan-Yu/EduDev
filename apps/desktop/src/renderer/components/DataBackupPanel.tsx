import { CheckCircle2, HardDrive, LoaderCircle, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import type { DataBackupVerificationResult, ExportDataRootResult } from '../../shared/contracts';

export type DataBackupPanelStatus =
  | 'idle'
  | 'exporting'
  | 'verifying'
  | 'export_success'
  | 'verify_success'
  | 'verification_failed'
  | 'cancelled'
  | 'error';

export type DataBackupPanelState = {
  status: DataBackupPanelStatus;
  message: string;
  exportResult?: ExportDataRootResult;
  verificationResult?: DataBackupVerificationResult;
};

type DataBackupPanelProps = {
  dataRoot: string;
  setStatus?: (message: string) => void;
  modern?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

function issueList(label: string, items: string[]) {
  if (!items.length) return null;
  return <li><strong>{label}：</strong>{items.slice(0, 5).join('、')}{items.length > 5 ? ` 等 ${items.length} 项` : ''}</li>;
}

export function DataBackupState({ state }: { state: DataBackupPanelState }) {
  if (state.status === 'idle') {
    return <div className="backup-feedback neutral" data-testid="data-backup-idle">选择数据目录之外的位置创建完整备份，或选择已有备份进行只读校验。</div>;
  }
  if (state.status === 'exporting' || state.status === 'verifying') {
    return <div className="backup-feedback neutral" data-testid="data-backup-loading"><LoaderCircle className="backup-spinner" size={17} />{state.message}</div>;
  }
  if (state.status === 'cancelled') {
    return <div className="backup-feedback neutral" data-testid="data-backup-cancelled"><XCircle size={17} />{state.message}</div>;
  }
  if (state.status === 'error') {
    return <div className="backup-feedback error" role="alert" data-testid="data-backup-error"><TriangleAlert size={17} />{state.message}</div>;
  }
  if (state.status === 'export_success' && state.exportResult) {
    return (
      <div className="backup-feedback success" data-testid="data-backup-export-success">
        <CheckCircle2 size={17} />
        <div><strong>{state.message}</strong><span data-testid="data-backup-export-path">{state.exportResult.exportPath}</span><span data-testid="data-backup-manifest-path">{state.exportResult.manifestPath}</span><small>{state.exportResult.fileCount} 个源文件 · manifest 已回读校验</small></div>
      </div>
    );
  }
  const result = state.verificationResult;
  if (state.status === 'verify_success' && result) {
    return (
      <div className="backup-feedback success" data-testid="data-backup-verify-success">
        <CheckCircle2 size={17} />
        <div><strong>{state.message}</strong><span data-testid="data-backup-verify-path">{result.backupPath}</span><small>{result.fileCount} 个文件与 manifest 的大小、SHA-256 一致</small></div>
      </div>
    );
  }
  if (state.status === 'verification_failed' && result) {
    return (
      <div className="backup-feedback error" role="alert" data-testid="data-backup-verify-failed">
        <TriangleAlert size={17} />
        <div>
          <strong>{state.message}</strong>
          <span>{result.errorMessage || '备份文件与清单不一致'}</span>
          <ul data-testid="data-backup-issues">
            {issueList('缺失', result.missingFiles)}
            {issueList('被修改', result.changedFiles)}
            {issueList('清单外文件', result.unexpectedFiles)}
          </ul>
        </div>
      </div>
    );
  }
  return null;
}

export function DataBackupPanel({ dataRoot, setStatus, modern = false, disabled = false, onBusyChange }: DataBackupPanelProps) {
  const [state, updateState] = useState<DataBackupPanelState>({ status: 'idle', message: '' });
  const live = useRef(true), lock = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const setState = (next: DataBackupPanelState) => { if (live.current) updateState(next); };
  const busy = state.status === 'exporting' || state.status === 'verifying';
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);

  const exportBackup = async () => {
    if (disabled || lock.current) return;
    lock.current = true;
    setState({ status: 'exporting', message: modern ? '正在创建本地备份…' : '正在复制本地数据并生成 SHA-256 manifest…' });
    try {
      if (!window.omniEdu?.exportDataRoot) throw new Error('完整备份接口不可用，请重新启动应用。');
      const result = await window.omniEdu.exportDataRoot();
      if (!result) {
        const message = '已取消完整数据备份，未创建新备份目录。';
        setState({ status: 'cancelled', message });
        setStatus?.(message);
        return;
      }
      const message = result.verified ? '完整数据备份已生成并通过校验。' : '备份已生成，但完整性校验未通过。';
      setState({ status: result.verified ? 'export_success' : 'error', message, exportResult: result });
      setStatus?.(message);
    } catch (error) {
      const message = modern ? '备份未完成。请确认任务已结束、目标位置可写且空间充足，再重试。' : error instanceof Error ? error.message : '完整数据备份失败。';
      setState({ status: 'error', message });
      setStatus?.(message);
    } finally { lock.current = false; }
  };

  const verifyBackup = async () => {
    if (disabled || lock.current) return;
    lock.current = true;
    setState({ status: 'verifying', message: modern ? '正在检查备份文件…' : '正在逐文件核对大小与 SHA-256…' });
    try {
      if (!window.omniEdu?.verifyDataBackup) throw new Error('备份校验接口不可用，请重新启动应用。');
      const result = await window.omniEdu.verifyDataBackup();
      if (!result) {
        const message = '已取消备份校验，未修改任何备份文件。';
        setState({ status: 'cancelled', message });
        setStatus?.(message);
        return;
      }
      const message = result.verified
        ? '备份完整性校验通过。'
        : `备份校验失败：缺失 ${result.missingFiles.length}、被修改 ${result.changedFiles.length}、清单外 ${result.unexpectedFiles.length}。`;
      setState({ status: result.verified ? 'verify_success' : 'verification_failed', message, verificationResult: result });
      setStatus?.(message);
    } catch (error) {
      const message = modern ? '无法检查该备份。请重新选择小智创建的备份目录。' : error instanceof Error ? error.message : '备份完整性校验失败。';
      setState({ status: 'error', message });
      setStatus?.(message);
    } finally { lock.current = false; }
  };

  if (modern) return <section className="pi-local-backup" data-testid="data-backup-panel">
    <p>为本机的资料、对话和工作成果创建完整备份。</p>
    <p className="pi-settings-location" data-testid="data-root-path">本地资料位置：{dataRoot || '正在读取…'}</p>
    <div className="pi-settings-actions"><Button variant="secondary" isDisabled={busy || disabled || !dataRoot} onPress={() => void exportBackup()} data-testid="data-backup-export"><HardDrive size={17}/>{state.status === 'exporting' ? '正在备份…' : '创建本地备份'}</Button>
      <Button variant="outline" isDisabled={busy || disabled || !dataRoot} onPress={() => void verifyBackup()} data-testid="data-backup-verify"><ShieldCheck size={17}/>{state.status === 'verifying' ? '正在检查…' : '检查已有备份'}</Button></div>
    <div aria-live="polite">
      {state.status === 'idle' ? <p data-testid="data-backup-idle">选择资料目录之外的位置保存备份。</p>
        : <div role={['error','verification_failed'].includes(state.status) ? 'alert' : 'status'} data-testid={`data-backup-${state.status === 'export_success' ? 'export-success' : state.status === 'verify_success' ? 'verify-success' : state.status === 'verification_failed' ? 'verify-failed' : busy ? 'loading' : state.status}`}>
          <p>{state.message}</p>{state.exportResult && <p className="pi-settings-location" data-testid="data-backup-export-path">{state.exportResult.exportPath}</p>}
          {state.verificationResult && <p className="pi-settings-location" data-testid="data-backup-verify-path">{state.verificationResult.backupPath}</p>}
        </div>}
    </div>
    {disabled && <p>任务结束后可创建或检查备份。</p>}
  </section>;
  return (
    <div className="data-backup-panel" data-testid="data-backup-panel">
      <div className="path-box" data-testid="data-root-path">{dataRoot}</div>
      <div className="quick-actions">
        <button className="secondary-action" disabled={busy} onClick={() => void exportBackup()} data-testid="data-backup-export">
          <HardDrive size={17} />{state.status === 'exporting' ? '备份中…' : '备份完整数据目录'}
        </button>
        <button className="secondary-action" disabled={busy} onClick={() => void verifyBackup()} data-testid="data-backup-verify">
          <ShieldCheck size={17} />{state.status === 'verifying' ? '校验中…' : '校验备份完整性'}
        </button>
      </div>
      <div aria-live="polite"><DataBackupState state={state} /></div>
      <p className="backup-boundary" data-testid="data-backup-boundary">备份只复制本地数据并生成清单，不会自动恢复、上传云端或修改源数据。</p>
    </div>
  );
}
