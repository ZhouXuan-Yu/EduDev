import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {validModelRequest} from '../../../shared/xiaozhi-model-request';

const states={sending:'正在连接',retry_wait:'等待重试',retried:'已等待并再次尝试',accepted:'已收到HTTP响应',rejected:'服务拒绝了本次请求',interrupted:'本次尝试已停止'};
/** No timer/token subscription: only actual request transitions change this notice. */
export function OfficeModelRequestNotice({turn}:{turn:OfficeProjectedTurn}){
 const rows=turn.modelRequests?.filter(validModelRequest)||[],last=rows.at(-1);if(!last||rows.length===1&&last.state==='accepted'&&['completed','running'].includes(turn.status))return null;
 const waiting=turn.status==='running'&&last.state==='retry_wait';
 return <div className="office-verification-notice" data-edu-domain="" data-testid="office-model-requests" data-state={last.state} role="status"><div>
  <strong>{waiting?`连接暂时失败，正在等待重试（${last.attempt}/2）`:`本轮已记录 ${rows.length+(turn.modelRequestsOmitted||0)} 次连接尝试`}</strong>
  {waiting&&<p>约 {Math.ceil((last.waitMs||0)/1000)} 秒后尝试。可用下方停止按钮结束本轮。</p>}
  <details><summary>查看请求与重试记录</summary><ol>{rows.map(row=><li key={`${row.request}:${row.attempt}`} data-request={row.request} data-attempt={row.attempt} data-state={row.state}>请求 {row.request} · 第 {row.attempt} 次尝试：{states[row.state]}{row.status?`（HTTP ${row.status}）`:''}{row.waitMs!==undefined?` · 等待 ${row.waitMs} 毫秒`:''}</li>)}</ol>
   {!!turn.modelRequestsOmitted&&<p>较早 {turn.modelRequestsOmitted} 次尝试未在此展开，原过程记录保留。</p>}
   <p>HTTP响应不代表任务完成。用量以本轮实际回执为准，缺少回执的计量和费用仍为未知。</p>
  </details>
 </div></div>;
}
