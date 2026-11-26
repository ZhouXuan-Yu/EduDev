import type { AttachmentImportResult } from '../../../shared/contracts';

export function AttachmentImportFeedback({ result, testId = 'student-attachment-import' }: {
  result: AttachmentImportResult;
  testId?: string;
}) {
  if (result.status === 'copying') {
    return <p role="status" data-testid={testId + '-loading'}>正在复制附件到学生本地目录…</p>;
  }
  if (result.status === 'canceled') {
    return <p role="status" className="warning-box" data-testid={testId + '-canceled'}>已取消附件选择，没有写入任何附件。</p>;
  }

  const saved = result.items.filter(item => item.ok).length;
  const errors = result.items.filter(item => !item.ok);
  const refresh = result.refreshFailed && saved > 0 ? ' 若列表未更新，切换学生后再切回即可重新读取，无需重复导入。' : '';
  if (result.status === 'succeeded') {
    return <p role="status" className="success-box" data-testid={testId + '-success'}>附件已复制：{saved} 个文件。{refresh}</p>;
  }
  return <p role="status" className="warning-box" data-testid={testId + '-failed'}>
    {saved > 0 && `已复制 ${saved} 个文件。`}
    {errors.map(item => `${item.fileName}：${item.errorMessage ?? '复制失败'}`).join('；') || '附件导入失败，请重试。'}
    {refresh}
  </p>;
}
