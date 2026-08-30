import { CheckCircle2, HardDrive, LoaderCircle, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react';
import { useState } from 'react';
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

export function DataBackupPanel({ dataRoot, setStatus }: DataBackupPanelProps) {
  const [state, setState] = useState<DataBackupPanelState>({ status: 'idle', message: '' });
  const busy = state.status === 'exporting' || state.status === 'verifying';

  const exportBackup = async () => {
    setState({ status: 'exporting', message: '正在复制本地数据并生成 SHA-256 manifest…' });
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
      const message = error instanceof Error ? error.message : '完整数据备份失败。';
      setState({ status: 'error', message });
      setStatus?.(message);
    }
  };

  const verifyBackup = async () => {
    setState({ status: 'verifying', message: '正在逐文件核对大小与 SHA-256…' });
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
      const message = error instanceof Error ? error.message : '备份完整性校验失败。';
      setState({ status: 'error', message });
      setStatus?.(message);
    }
  };

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
