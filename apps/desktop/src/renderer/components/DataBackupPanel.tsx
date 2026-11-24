import type { BackupCompatibility } from '../../shared/backup-compatibility';
import type { BackupPurpose } from '../../shared/backup-purpose';
import {BACKUP_RESTORE_SCHEMA,type BackupRestorePreview,type PreparedBackupRestore,type BackupRestoreStatus} from '../../shared/backup-restore';
import { CheckCircle2, HardDrive, LoaderCircle, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import type { DataBackupVerificationResult, ExportDataRootResult } from '../../shared/contracts';
import {BackupContinuitySummary} from './BackupContinuitySummary';
import {PortableRecoveryChecklist,type RecoveryModelSettings,type RecoverySetting} from './PortableRecoveryChecklist';

export type DataBackupPanelStatus =
  | 'idle'
  | 'exporting'
  | 'verifying'
  | 'restoring'
  | 'restore_preview'
  | 'restore_ready'
  | 'restarting'
  | 'export_success'
  | 'verify_success'
  | 'verification_failed'
  | 'cancelled'
  | 'error';

export type DataBackupPanelState = {
  status: DataBackupPanelStatus;
  message: string;
  exportResult?: ExportDataRootResult;
  restoreResult?:PreparedBackupRestore;
  restorePreview?: BackupRestorePreview;
  verificationResult?: DataBackupVerificationResult;
};

type DataBackupPanelProps = {
  dataRoot: string;
  setStatus?: (message: string) => void;
  modern?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  recoveryModel?: RecoveryModelSettings;
  onOpenRecoverySetting?: (setting: RecoverySetting) => void;
};

function issueList(label: string, items: string[]) {
  if (!items.length) return null;
  return <li><strong>{label}：</strong>{items.slice(0, 5).join('、')}{items.length > 5 ? ` 等 ${items.length} 项` : ''}</li>;
}

function ExternalBackupSummary({value}:{value?:{externalOutputs?:ExportDataRootResult['externalOutputs']}}){
 const result=value?.externalOutputs;if(!result)return null;
 return <div data-testid="data-backup-external-summary"><p>含 {result.fileCount} 个另选目录成果{result.omittedCount?`；${result.omittedCount} 项未纳入`:''}</p>
  {result.omittedCount>0&&<p data-testid="data-backup-omitted" role="status">{result.omitted.slice(0,3).join('；')}{result.omittedCount>3?'；其余遗漏见备份清单':''}。请找回对应文件或目录后重新备份。</p>}
 </div>;
}

function BackupCompatibilitySummary({ value }: { value?: BackupCompatibility }) {
  if (!value) return null;
  const versions = value.sourceAppVersion
    ? '备份版本 ' + value.sourceAppVersion + ' · 当前版本 ' + value.currentAppVersion
    : value.legacyRuntimeVersion
      ? '此旧备份记录的是运行时版本 ' + value.legacyRuntimeVersion + ' · 当前小智版本 ' + value.currentAppVersion
      : '此旧备份未记录应用版本 · 当前版本 ' + value.currentAppVersion;
  return <div data-testid="data-backup-compatibility">
    <p>{versions}</p>
    {value.status === 'newer_app' && <p role="alert">恢复前请安装与备份相同或更新版本的小智。</p>}
    {value.status === 'newer_data' && <p role="alert">当前小智无法读取此数据库格式，请升级后再恢复。</p>}
  </div>;
}

function BackupPurposeSummary({ purpose }: { purpose?: BackupPurpose }) {
  return purpose === 'portable' ? (
    <p data-testid="data-backup-portable">换机包。请在新电脑配置模型密钥和 MCP 连接，重新确认需要的工具授权。</p>
  ) : null;
}

function displaySize(bytes: number) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const unit = Math.max(0, Math.min(units.length - 1, Math.floor(Math.log2(bytes || 1) / 10)));
  return new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 2}).format(bytes / 1024 ** unit) + ' ' + units[unit];
}

function RestorePreview({value, disabled, onPrepare}: {
  value: BackupRestorePreview; disabled: boolean; onPrepare: () => void;
}) {
  const insufficient = value.spaceStatus === 'insufficient';
  return <div data-testid="data-backup-restore-preview">
    <p><strong>恢复前核对</strong></p>
    {value.rollback && <p data-testid="data-backup-rollback-version">
      将升级到 {value.rollback.targetVersion} 前的数据交给小智 {value.rollback.sourceVersion} 使用。
      快照时间 {new Date(value.rollback.preparedAt).toLocaleString('zh-CN')}
    </p>}
    <p className="pi-settings-location">备份目录 {value.backupPath}</p>
    <p className="pi-settings-location">目标文件夹 {value.destination}</p>
    <p>{value.fileCount} 个待恢复文件 · 备份文件合计 {displaySize(value.packageBytes)}</p>
    <p data-testid="data-backup-restore-space">预计至少需要 {displaySize(value.requiredBytes)} · 目标盘可用 {displaySize(value.availableBytes)}</p>
    <BackupPurposeSummary purpose={value.purpose}/>
    <BackupCompatibilitySummary value={value.compatibility}/>
    <BackupContinuitySummary value={value.continuity}/>
    {value.omittedOutputs > 0 && <p>备份时有 {value.omittedOutputs} 项外选目录成果未纳入。</p>}
    {insufficient && <p role="alert">目标盘空间不足。请释放空间，或重新选择保存位置。</p>}
    <Button variant="primary" isDisabled={disabled || insufficient} onPress={onPrepare}
      data-testid="data-backup-restore-prepare">创建恢复副本</Button>
  </div>;
}

export function DataBackupState({ state }: { state: DataBackupPanelState }) {
  if (state.status === 'idle') {
    return <div className="backup-feedback neutral" data-testid="data-backup-idle">选择数据目录之外的位置创建完整备份，或选择已有备份进行只读校验。</div>;
  }
  if (['exporting','verifying','restoring','restarting'].includes(state.status)) {
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
        <div><strong>{state.message}</strong><span data-testid="data-backup-export-path">{state.exportResult.exportPath}</span><span data-testid="data-backup-manifest-path">{state.exportResult.manifestPath}</span><small>{state.exportResult.fileCount} 个源文件 · manifest 已回读校验</small>{state.exportResult.conversationOutputs&&<small data-testid="data-backup-generated-count">含 {state.exportResult.conversationOutputs.fileCount} 个默认生成文件</small>}<ExternalBackupSummary value={state.exportResult}/><BackupPurposeSummary purpose={state.exportResult.purpose}/><BackupCompatibilitySummary value={state.exportResult.compatibility}/><BackupContinuitySummary value={state.exportResult.continuity}/></div>
      </div>
    );
  }
  const result = state.verificationResult;
  if (state.status === 'verify_success' && result) {
    return (
      <div className="backup-feedback success" data-testid="data-backup-verify-success">
        <CheckCircle2 size={17} />
        <div><strong>{state.message}</strong><span data-testid="data-backup-verify-path">{result.backupPath}</span><small>{result.fileCount} 个文件与 manifest 的大小、SHA-256 一致</small><ExternalBackupSummary value={result}/><BackupPurposeSummary purpose={result.purpose}/><BackupCompatibilitySummary value={result.compatibility}/><BackupContinuitySummary value={result.continuity}/></div>
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

export function DataBackupPanel({ dataRoot, setStatus, modern = false, disabled = false, onBusyChange,
  recoveryModel, onOpenRecoverySetting }: DataBackupPanelProps) {
  const [restoreStatus,setRestoreStatus]=useState<BackupRestoreStatus|null>(null);
  useEffect(()=>{let current=true;void window.omniEdu?.backupRestoreStatus?.().then(value=>{if(current)setRestoreStatus(value);}).catch(()=>undefined);return()=>{current=false;};},[]);
  const [state, updateState] = useState<DataBackupPanelState>({ status: 'idle', message: '' });
  const live = useRef(true), lock = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const setState = (next: DataBackupPanelState) => { if (live.current) updateState(next); };
  const busy = ['exporting','verifying','restoring','restarting'].includes(state.status);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);

  const exportBackup = async (purpose: BackupPurpose = 'full') => {
    if (disabled || lock.current) return;
    lock.current = true;
    const label = purpose === 'portable' ? '换机包' : '完整数据备份';
    setState({ status: 'exporting', message: `正在创建${label}…` });
    try {
      if (!window.omniEdu?.exportDataRoot) throw new Error('完整备份接口不可用，请重新启动应用。');
      const result = await window.omniEdu.exportDataRoot(purpose === 'portable' ? purpose : undefined);
      if (!result) {
        const message = `已取消创建${label}，没有发布新的备份。`;
        setState({ status: 'cancelled', message });
        setStatus?.(message);
        return;
      }
      const omissions = result.externalOutputs?.omittedCount || 0;
      const message = result.verified
        ? `${label}已生成并通过校验。${omissions ? `${omissions} 项成果未纳入，请查看遗漏说明。` : ''}`
        : `${label}未通过完整性校验。`;
      setState({ status: result.verified ? 'export_success' : 'error', message, exportResult: result });
      setStatus?.(message);
    } catch (error) {
      const message = modern ? '备份未完成。请确认任务已结束、目标位置可写且空间充足，再重试。' : error instanceof Error ? error.message : '完整数据备份失败。';
      setState({ status: 'error', message });
      setStatus?.(message);
    } finally { lock.current = false; }
  };

  const cancelExport = async () => {
    try {
      const result=await window.omniEdu?.cancelDataBackup();
      if (result?.cancelled && live.current) {
        updateState(previous=>previous.status==='exporting' ? {...previous,message:'正在停止备份…'} : previous);
      }
    } catch {
      if (live.current) updateState(previous=>previous.status==='exporting'
        ? {...previous,message:'未能提交取消请求，备份仍在处理。'} : previous);
    }
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
        ? result.externalOutputs?.omittedCount ? `清单内文件校验通过；备份时有 ${result.externalOutputs.omittedCount} 项成果未纳入。` : '备份完整性校验通过。'
        : `备份校验失败：缺失 ${result.missingFiles.length}、被修改 ${result.changedFiles.length}、清单外 ${result.unexpectedFiles.length}。`;
      setState({ status: result.verified ? 'verify_success' : 'verification_failed', message, verificationResult: result });
      setStatus?.(message);
    } catch (error) {
      const message = modern ? '无法检查该备份。请重新选择小智创建的备份目录。' : error instanceof Error ? error.message : '备份完整性校验失败。';
      setState({ status: 'error', message });
      setStatus?.(message);
    } finally { lock.current = false; }
  };

  const restoreBackup=async(action:'preview'|'preview_update'|'prepare'|'activate'|'revert'|'cancel_rollback')=>{
    if(disabled||lock.current)return;
    const {restoreResult:prepared,restorePreview:preview}=state;lock.current=true;
    const previewing=action==='preview'||action==='preview_update';
    const scheduling=action==='activate'&&Boolean(prepared?.rollback);
    const preparing=previewing||action==='prepare'||scheduling||action==='cancel_rollback';
    const message=previewing?'正在核对备份和目标盘空间…'
      :action==='prepare'?'正在创建并校验独立恢复副本…'
      :scheduling?'正在校验并安排回退…'
      :action==='cancel_rollback'?'正在取消回退安排…':'正在切换数据目录，应用即将重启…';
    setState({status:preparing?'restoring':'restarting',message});
    try{
      const api=window.omniEdu;
      if(!api?.previewBackupRestore||!api.prepareBackupRestore||!api.activateBackupRestore)throw Error('恢复接口不可用，请重新启动应用。');
      if(action==='preview'||action==='preview_update'){
        const result=await api.previewBackupRestore(action==='preview_update'?'update':undefined);
        setState(result?{status:'restore_preview',message:'备份核对完成。',restorePreview:result}
          :{status:'cancelled',message:'已取消恢复，当前数据目录未切换。'});
      }else if(action==='prepare'){
        if(!preview||preview.spaceStatus!=='ready')throw Error('请先核对备份和恢复位置');
        const result=await api.prepareBackupRestore(preview.id);
        setState(result?{status:'restore_ready',message:result.rollback
          ?'回退副本已准备好，可以安排旧版在启动时使用。'
          :'独立恢复副本已准备好。使用前请切换并重启，当前数据仍在原目录。',restoreResult:result}:{status:'cancelled',message:'已取消恢复，当前数据目录未切换。'});
      }else{
        if(action==='activate'&&!prepared)throw Error('请先准备恢复副本');
        const result=await api.activateBackupRestore(action==='activate'
          ?{schemaVersion:BACKUP_RESTORE_SCHEMA,action:'activate',id:prepared!.id}
          :{schemaVersion:BACKUP_RESTORE_SCHEMA,action});
        setRestoreStatus(result);
        if(scheduling||action==='cancel_rollback')setState({status:'idle',message:''});
      }
    }catch(error){setState({status:'error',message:error instanceof Error?error.message:'恢复未完成；当前数据未切换。'});}
    finally{lock.current=false;}
  };
  const pendingRollback=restoreStatus?.pendingRollback;
  const restoreDisabled=busy||disabled||Boolean(pendingRollback);
  const restoreControls=<div className="pi-settings-actions" data-testid="data-backup-restore-controls">
    <Button variant="outline" isDisabled={restoreDisabled||!dataRoot} onPress={()=>void restoreBackup('preview')} data-testid="data-backup-restore">{state.restorePreview&&!state.restorePreview.rollback?'重新选择备份和位置':'恢复备份到新目录'}</Button>
    <Button variant="outline" isDisabled={restoreDisabled||!dataRoot} onPress={()=>void restoreBackup('preview_update')}
      data-testid="data-backup-update-rollback">按更新记录准备回退</Button>
    {pendingRollback&&<div data-testid="data-backup-pending-rollback">
      <p role="status">已安排小智 {pendingRollback.sourceVersion} 下次启动时启用回退副本。当前工作区保留。</p>
      <Button variant="outline" isDisabled={busy||disabled} onPress={()=>void restoreBackup('cancel_rollback')}
        data-testid="data-backup-cancel-rollback">取消回退安排</Button>
    </div>}
    {state.restorePreview&&<RestorePreview value={state.restorePreview} disabled={restoreDisabled}
      onPrepare={()=>void restoreBackup('prepare')}/>}
    {state.restoreResult&&<div role="status" data-testid="data-backup-restore-ready">
      <p>{state.message}</p><p className="pi-settings-location">{state.restoreResult.dataRoot}</p>
      <BackupPurposeSummary purpose={state.restoreResult.purpose}/><BackupCompatibilitySummary value={state.restoreResult.compatibility}/>
      <BackupContinuitySummary value={state.restoreResult.continuity}/>
      <p>原目录保留。恢复后请重新核对旧任务和运行记录。</p>
      {state.restoreResult.warnings.map(w=><p key={w}>{w}</p>)}
      <Button variant="primary" isDisabled={restoreDisabled} onPress={()=>void restoreBackup('activate')}
        data-testid="data-backup-restore-activate">{state.restoreResult.rollback?'安排旧版启动时启用':'使用恢复数据并重启'}</Button>
    </div>}
    {restoreStatus?.returnRequiresVersion
      ?<p data-testid="data-backup-return-version">若要重新使用升级后的工作区，请先启动小智 {restoreStatus.returnRequiresVersion}。</p>
      :restoreStatus?.previousRoot&&<Button variant="outline" isDisabled={restoreDisabled} onPress={()=>void restoreBackup('revert')}
        data-testid="data-backup-restore-revert">返回恢复前的数据并重启</Button>}
  </div>;

  if (modern) return <section className="pi-local-backup" data-testid="data-backup-panel">
    {restoreStatus?.dataRoot === dataRoot && restoreStatus.portableRestore && onOpenRecoverySetting &&
      <PortableRecoveryChecklist restore={restoreStatus.portableRestore} model={recoveryModel}
        disabled={busy || disabled} onOpen={onOpenRecoverySetting}/>}
    <p>换机包带走教学资料、题库、对话、已登记的成果和偏好。模型密钥、MCP 连接和工具授权在新电脑重新配置。</p>
    <p className="pi-settings-location" data-testid="data-root-path">本地资料位置：{dataRoot || '正在读取…'}</p>
    <div className="pi-settings-actions"><Button variant="secondary" isDisabled={busy || disabled || !dataRoot} onPress={() => void exportBackup()} data-testid="data-backup-export"><HardDrive size={17}/>创建本地备份</Button>
      <Button variant="outline" isDisabled={busy || disabled || !dataRoot} onPress={() => void exportBackup('portable')} data-testid="data-backup-portable-export">创建换机包</Button>
      {state.status==='exporting' && <Button variant="ghost" data-testid="data-backup-cancel-export" onPress={()=>void cancelExport()}>取消备份</Button>}
      <Button variant="outline" isDisabled={busy || disabled || !dataRoot} onPress={() => void verifyBackup()} data-testid="data-backup-verify"><ShieldCheck size={17}/>{state.status === 'verifying' ? '正在检查…' : '检查已有备份'}</Button></div>
    {restoreControls}
    <div aria-live="polite">
      {['restore_preview','restore_ready'].includes(state.status) ? null : state.status === 'idle' ? <p data-testid="data-backup-idle">选择资料目录之外的位置保存备份。</p>
        : <div role={['error','verification_failed'].includes(state.status) ? 'alert' : 'status'} data-testid={`data-backup-${state.status === 'export_success' ? 'export-success' : state.status === 'verify_success' ? 'verify-success' : state.status === 'verification_failed' ? 'verify-failed' : busy ? 'loading' : state.status}`}>
          <p>{state.message}</p>{state.exportResult && <p className="pi-settings-location" data-testid="data-backup-export-path">{state.exportResult.exportPath}</p>}{state.exportResult?.conversationOutputs&&<p data-testid="data-backup-generated-count">含 {state.exportResult.conversationOutputs.fileCount} 个默认生成文件</p>}
          {state.verificationResult && <p className="pi-settings-location" data-testid="data-backup-verify-path">{state.verificationResult.backupPath}</p>}
          <ExternalBackupSummary value={state.exportResult||state.verificationResult}/>
          <BackupPurposeSummary purpose={(state.exportResult||state.verificationResult)?.purpose}/>
          <BackupCompatibilitySummary value={(state.exportResult||state.verificationResult)?.compatibility}/>
          <BackupContinuitySummary value={(state.exportResult||state.verificationResult)?.continuity}/>
          {state.status === "verification_failed" && state.verificationResult?.errorMessage && <p>{state.verificationResult.errorMessage}</p>}
        </div>}
    </div>
    {disabled && <p>任务结束后可创建或检查备份。</p>}
  </section>;
  return (
    <div className="data-backup-panel" data-testid="data-backup-panel">
      <div className="path-box" data-testid="data-root-path">{dataRoot}</div>
      <div className="quick-actions">
        <button className="secondary-action" disabled={busy} onClick={() => void exportBackup()} data-testid="data-backup-export">
          <HardDrive size={17} />备份完整数据目录
        </button>
        <button className="secondary-action" disabled={busy || disabled || !dataRoot} onClick={() => void exportBackup('portable')} data-testid="data-backup-portable-export">创建换机包</button>
        {state.status==='exporting' && <button type="button" className="secondary-action" data-testid="data-backup-cancel-export" onClick={()=>void cancelExport()}>取消备份</button>}
        <button className="secondary-action" disabled={busy} onClick={() => void verifyBackup()} data-testid="data-backup-verify">
          <ShieldCheck size={17} />{state.status === 'verifying' ? '校验中…' : '校验备份完整性'}
        </button>
      </div>
      {restoreControls}
      <div aria-live="polite"><DataBackupState state={state} /></div>
      <p className="backup-boundary" data-testid="data-backup-boundary">备份保留本地资料、题库、默认生成文件及已登记的另选目录成果；其他外部文件需单独备份。题意索引缓存可重建；生成清单后不会自动恢复、上传云端或修改源数据。</p>
    </div>
  );
}
