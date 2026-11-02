import type {XiaozhiUsage} from '../../../shared/xiaozhi-agent';

/** Read only the selected run's existing host usage; never estimate a bill. */
export function PiUsageReceipt({usage,runId,limited=false}:{usage?:XiaozhiUsage;runId?:string;limited?:boolean}){
 const current=usage&&runId&&usage.runId===runId?usage:undefined;
 const tokens=current?.completeness!=='unknown'?current?.tokens:undefined;
 const partial=current?.completeness==='partial';
 return <div data-testid="pi-usage-receipt" data-run-id={current?.runId}>
  {current?<>
   <p>模型请求尝试：{current.modelCalls}{limited?` / ${current.budget.maxModelCalls}`:''}；工具调用：{current.toolCalls}{limited?` / ${current.budget.maxToolCalls}`:''}</p>
   <p data-testid="pi-usage-tokens">{tokens?`已记录 Token：${tokens.total.toLocaleString()}${partial?'（部分记录，本轮总量未知）':''}`:'Token 用量：未知，尚无供应商用量记录。'}</p>
   {tokens&&<>
    <p>已记录输入：{(tokens.input+tokens.cacheRead+tokens.cacheWrite).toLocaleString()}；输出：{tokens.output.toLocaleString()}</p>
    <p>{tokens.cacheRead>0?`其中已记录缓存读取：${tokens.cacheRead.toLocaleString()} Token`:'缓存命中量：未确认'}{tokens.cacheWrite>0?`；已记录缓存写入：${tokens.cacheWrite.toLocaleString()} Token`:''}</p>
   </>}
   <p>任务活动 {(current.activeMs/1000).toFixed(1)} 秒 · 教师等待 {(current.waitingMs/1000).toFixed(1)} 秒</p>
   {['interrupted','failed'].includes(current.state)&&<p data-testid="pi-usage-inflight">本机已停止继续执行；在途请求仍可能计费，已记录用量保留。</p>}
  </>:<p>当前轮尚无用量记录；发送后显示已记录用量。</p>}
  <p data-testid="pi-usage-cost">费用：未知</p>
 </div>;
}
