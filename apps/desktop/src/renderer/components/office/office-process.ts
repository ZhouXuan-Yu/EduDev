import type { OfficeProjectedItem } from '../../../shared/office-agent';

export type OfficeProcessPart = { kind: 'item'; item: OfficeProjectedItem }
  | { kind: 'tools'; items: OfficeProjectedItem[] };

/** Group adjacent real calls only; messages/control/compaction remain barriers. */
export function groupOfficeProcess(items: OfficeProjectedItem[]): OfficeProcessPart[] {
  const parts: OfficeProcessPart[] = [];
  for (const item of items) {
    if (item.kind !== 'tool') { parts.push({ kind: 'item', item }); continue; }
    const last = parts.at(-1);
    if (last?.kind === 'tools') last.items.push(item);
    else parts.push({ kind: 'tools', items: [item] });
  }
  return parts;
}

export function formatProcessDuration(ms: number): string {
  if (ms < 1000) return '不到 1 秒';
  const seconds = Math.floor(ms / 1000), minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60);
  return hours ? `${hours} 小时 ${minutes % 60} 分钟 ${seconds % 60} 秒`
    : minutes ? `${minutes} 分钟 ${seconds % 60} 秒` : `${seconds} 秒`;
}

export function processNeedsAttention(item: OfficeProjectedItem): boolean {
  return ['failed', 'declined', 'waiting_approval', 'waiting_input'].includes(item.status || '');
}
