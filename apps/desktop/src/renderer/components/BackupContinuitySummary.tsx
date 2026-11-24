import type {BackupContinuity} from '../../shared/backup-continuity';
import {DisclosureCard} from './ui/DisclosureCard';

const recordCount = (value: number | null, unit: string) => value === null ? '旧备份未提供记录' : value + ' ' + unit;

export function BackupContinuitySummary({value}: {value?: BackupContinuity}) {
  if (!value) return null;
  if (value.status === 'unavailable') {
    return <p data-testid="data-backup-continuity">备份文件校验通过，暂时无法读取换机设置清单。</p>;
  }
  return <DisclosureCard data-testid="data-backup-continuity" title="换机前核对">
    <ul>
      <li>模型偏好：{value.defaultModel ? '有默认模型记录' : '未单独设置默认模型'}，会话覆盖 {recordCount(value.sessionModels, '项')}</li>
      <li>思考档次：{value.defaultThinking ? '有全局思考档次记录' : '使用默认档次'}，会话覆盖 {recordCount(value.sessionThinking, '项')}</li>
      <li>个人技能：{recordCount(value.personalSkills, '条记录')}。实际可用性按新机的技能和依赖检查。</li>
      <li>组卷模板：{recordCount(value.paperTemplates, '份')}</li>
      <li>会话工作目录：{recordCount(value.savedWorkspaces, '项')}。外部目录需要在新机重新选择。</li>
    </ul>
    <p>在新电脑上核对模型登录和外部工具配置。搜索索引可从备份资料重建。</p>
    {value.modelCredentialRecorded && <p data-testid="data-backup-credential-notice">这份完整备份含模型凭据记录。新机如无法连接，请在模型设置中重新配置凭据。</p>}
  </DisclosureCard>;
}
