import {useEffect, useState} from 'react';
import {Button} from '@heroui/react';
import type {PortableRestoreSummary} from '../../shared/backup-restore';
import type {RetrievalStatus} from '../../shared/retrieval';
import type {XiaozhiSettingsView} from '../../shared/xiaozhi-settings';
import {SettingsRow} from './office/hana-settings/SettingsRow';
import {SettingsSection} from './office/hana-settings/SettingsSection';

export type RecoverySetting = 'models' | 'tools' | 'permissions' | 'capabilities';
export type RecoveryModelSettings = Pick<XiaozhiSettingsView, 'configured' | 'credentialError' | 'defaultModel'>;

function indexStatus(value: RetrievalStatus | null | undefined) {
  if (value === undefined) return '正在读取本机索引状态。';
  if (!value) return '暂时无法读取语义索引状态，已有资料仍可打开。';
  if (value.paused) return `索引已暂停，待处理 ${value.pending} 项。`;
  if (!value.available) return '语义索引暂不可用，可在资料库核对。';
  if (value.error || value.failed) return `待处理 ${value.pending} 项，${value.failed} 项失败，可在资料库核对。`;
  if (value.building || value.pending) return `索引正在准备，已索引 ${value.indexed} 项，待处理 ${value.pending} 项。`;
  return value.generation ? `已索引 ${value.indexed} 项。` : '等待索引准备。';
}

export function PortableRecoveryChecklist({restore, model, disabled, onOpen}: {
  restore: PortableRestoreSummary;
  model?: RecoveryModelSettings;
  disabled: boolean;
  onOpen: (setting: RecoverySetting) => void;
}) {
  const [request, setRequest] = useState(0);
  const [index, setIndex] = useState<RetrievalStatus | null>();
  const [tools, setTools] = useState<{configured:number; listed:number} | null>();
  useEffect(() => {
    let current = true;
    const api = window.omniEdu;
    setIndex(undefined);
    setTools(undefined);
    if (!api) { setIndex(null); setTools(null); return; }
    void api.getRetrievalStatus().then(result => {
      if (current) setIndex(result);
    }).catch(() => { if (current) setIndex(null); });
    void api.getXiaozhiMcpCatalog().then(result => {
      if (!current) return;
      if (!result.ok) { setTools(null); return; }
      const servers = result.value.servers;
      setTools({configured: servers.length, listed: servers.filter(server => server.status === 'ready').length});
    }).catch(() => { if (current) setTools(null); });
    return () => { current = false; };
  }, [request]);

  const modelStatus = !model ? '暂未读到模型配置。'
    : model.credentialError ? '本机无法读取已保存的密钥，请到模型设置重新配置。'
    : model.configured ? '已配置本机密钥。' : '需要配置本机密钥才能使用云模型。';
  const toolStatus = tools === undefined ? '正在读取本机连接记录。' : !tools ? '暂时无法读取连接记录，可在外部工具页检查。'
    : tools.configured === 0 ? '尚未配置本机连接，使用外部工具时可按需添加。'
    : `本机已保存 ${tools.configured} 项连接，${tools.listed} 项已读取工具目录。`;
  const navigate = (setting: RecoverySetting, label: string) => (
    <Button size="sm" variant="outline" isDisabled={disabled} onPress={() => onOpen(setting)}
      data-testid={`portable-recovery-${setting}`}>{label}</Button>
  );

  return <div data-testid="portable-recovery-checklist">
    <SettingsSection title="换机后继续使用" description={`已启用换机副本，恢复时核对了 ${restore.fileCount} 个文件，含 ${restore.generatedFiles} 个已登记成果。`}>
      <SettingsRow label="模型与连接" hint={`${model ? `默认模型 ${model.defaultModel}。` : ''}${modelStatus}`}
        data-testid="portable-recovery-model-status" control={navigate('models', '打开模型设置')}/>
      <SettingsRow label="外部工具" hint={toolStatus} data-testid="portable-recovery-tool-status"
        control={<>{navigate('tools', '管理外部工具')}{navigate('capabilities', '查看能力中心')}</>}/>
      <SettingsRow label="工作目录与授权"
        hint="使用新电脑上的目录时，请在新对话选择目录，再按当前任务确认所需授权。"
        control={navigate('permissions', '查看资料与权限')}/>
      {restore.warnings.map((warning, i) => <SettingsSection.Note key={i}>{warning}</SettingsSection.Note>)}
      <SettingsRow label="语义索引" hint={indexStatus(index)} data-testid="portable-recovery-index-status"
        control={<Button size="sm" variant="outline" isDisabled={disabled} onPress={() => setRequest(n => n + 1)}
          data-testid="portable-recovery-refresh">刷新状态</Button>}/>
    </SettingsSection>
  </div>;
}
