import type { OfficeArtifactSummary } from '../../shared/xiaozhi-office-artifacts';
import type { XiaozhiAgentEventPayload } from '../../shared/xiaozhi-agent';

const outcomes = new Set<OfficeArtifactSummary['state']>(['saved', 'rejected', 'conflict', 'failed', 'interrupted', 'uncertain']);
const status: Record<OfficeArtifactSummary['state'], string> = {
  pending: '尚未确认，未保存', approved: '已确认，尚未保存', generating: '正在生成，尚未保存',
  prepared: '尚未保存', committing: '正在保存，结果待核验', saved: '已保存', rejected: '已拒绝，未保存',
  conflict: '内容或来源已变化，未保存', failed: '未保存', interrupted: '已停止，未保存', uncertain: '保存结果待核验',
};
const literal = (text: string) => text.replace(/[\\`*_{}[\]()<>#+.!|~-]/g, '\\$&');

/** Application presentation of actual file effects, never a substitute model transcript.
 * Teacher revisions stay local. The native assistant text is retained by Pi;
 * a post-review draft recap cannot become the public delivery statement.
 */
export function officeDeliveryText(runId: string, rows: OfficeArtifactSummary[], failure?: 'stopped' | 'failed') {
  const current = rows.filter(row => row.runId === runId);
  if (!current.length) return undefined;
  const saved = current.some(row => row.state === 'saved');
  return [failure === 'stopped' ? '本轮已停止。' : failure ? '本轮未全部完成。' : '本轮文档结果：', '',
    ...current.map(row => `- ${row.format.toUpperCase()} · ${status[row.state]}：${literal(row.path)}`), '',
    ...(saved ? ['已保存的文件采用你确认的版本。请打开文件查看正文或继续修改。'] : []),
    ...(current.some(row => row.state === 'uncertain') ? ['请先核验保存结果，不要重复生成或覆盖文件。'] : []),
  ].join('\n').trim();
}

export function createOfficeDeliveryPresentation(runId: string) {
  let terminalEffect = false;
  let observed = false;
  let buffered = '';
  return {
    get hasArtifacts() { return observed; },
    events(payload: XiaozhiAgentEventPayload): XiaozhiAgentEventPayload[] {
      if (payload.kind === 'office_artifact' && payload.artifact.runId === runId) {
        observed = true;
        if (outcomes.has(payload.artifact.state)) terminalEffect = true;
      }
      if (terminalEffect && payload.kind === 'text_delta') {
        buffered = (buffered + payload.delta).slice(0, 65536);
        return [];
      }
      if (payload.kind === 'assistant_start') buffered = '';
      if (payload.kind === 'assistant_end') {
        // The final/non-final distinction is authoritative only at message_end.
        // Continue showing actual process summaries before subsequent tools.
        const text = buffered; buffered = '';
        return text && !payload.final ? [{kind:'text_delta',delta:text},payload] : [payload];
      }
      return [payload];
    },
  };
}
