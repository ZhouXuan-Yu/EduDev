import type {OfficeProjectedTurn} from '../../../shared/office-agent';

/** Prepare an editable continuation; the caller preserves existing unsent drafts. */
export function continuationPrompt(turn:OfficeProjectedTurn){
 const original=turn.items.find(item=>item.kind==='message'&&item.role==='user')?.text?.trim();if(!original)return '';
 const partial=turn.items.filter(item=>item.kind==='message'&&item.role==='assistant'&&item.text?.trim()).at(-1)?.text?.trim();
 const effects=turn.items.some(item=>item.kind==='tool'&&item.status==='completed')||!!turn.recovery?.receipts.length;
 if(!partial&&!effects&&turn.status==='failed')return original;
 return `请继续完成刚才未完成的教学任务：${original}\n\n沿用当前已确认的任务要求和最新资料版本，先核对已完成的操作与已保存成果，只续做缺少的部分；不要从头生成整份内容，不重复写入或重放旧审批。${partial?`\n已经输出的文字保留；从「${Array.from(partial).slice(-180).join('')}」之后接续，不重抄已有段落。`:''}`;
}
