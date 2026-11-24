import {DatabaseUpgradeError} from './database-migrations';

const backupMessages: Record<string,string> = {
  backup_reference_missing:'资料库缺少数据库引用的原件、成果或对话文件。请恢复同一份完整备份后重试。',
  backup_reference_changed:'资料文件与数据库记录不一致。请恢复同一份完整备份后重试。',
  backup_reference_invalid:'资料库的文件引用无法核对。请使用完整备份恢复后重试。',
  backup_native_invalid:'已保存的对话文件无法核对。请使用完整备份恢复后重试。',
  backup_native_binding_changed:'对话文件与对应的会话记录不一致。请使用完整备份恢复后重试。',
  backup_source_changed:'资料在升级前备份期间发生变化。请停止对该目录的修改后重试。',
  ENOSPC:'存储空间不足，无法写入升级前备份。请清出空间后重试。',
  SQLITE_FULL:'存储空间不足，无法写入升级前备份。请清出空间后重试。',
  EACCES:'升级前备份无法访问文件。请核对资料目录和备份目录的访问权限。',
  EPERM:'升级前备份无法访问文件。请核对资料目录和备份目录的访问权限。',
  EROFS:'升级前备份目录为只读。请确保备份目录可写后重试。',
};

export function describeDatabaseStartupFailure(error:unknown) {
  const issue=error instanceof DatabaseUpgradeError?error.issue:'startup_failed';
  const cause=error instanceof Error?error.cause:undefined;
  const code=cause&&typeof cause==='object'&&'code' in cause?String(cause.code):'';
  const sqliteCode=/^SQLITE_[A-Z_]+$/u.test(code)?code:undefined;
  const detail=code||(cause instanceof Error?cause.message:'');
  const backupFailure=issue==='recovery_point_failed'&&Object.hasOwn(backupMessages,detail)?detail:undefined;
  let reason='数据库初始化未完成。请使用升级前备份或核对诊断后重试。';
  if(issue==='newer_version')reason='此数据库由较新版本的小智创建，请使用支持该格式的版本。';
  if(issue==='recovery_point_failed')reason=backupFailure?backupMessages[backupFailure]:'无法建立升级前备份。请核对原资料目录和备份目录后重试。';
  return {issue, sqliteCode, backupFailure, reason};
}
