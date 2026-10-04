import type { Usage } from '@earendil-works/pi-ai';
import type { XiaozhiBudget, XiaozhiUsage } from '../../shared/xiaozhi-agent';
import { validPiBudget } from './budget-state';

/** Admission around the SDK stream/tool hooks, not a model execution loop. */
export function createPiRunBudget(options:{budget:XiaozhiBudget;runId:string;limitsEnforced?:boolean;emit:(value:XiaozhiUsage)=>void;abort:()=>void}) {
  if(!validPiBudget(options.budget))throw new Error('configuration');
  const budget={...options.budget};
  const limited=options.limitsEnforced!==false;
  let active=0,waited=0,since=performance.now(),waiting=0,modelCalls=0,missing=false,finished=false;
  let tokens:XiaozhiUsage['tokens']=null,exhausted:XiaozhiUsage['exhausted'];
  let state:XiaozhiUsage['state']='running';
  const tools=new Set<string>(),waitTimers=new Set<ReturnType<typeof setTimeout>>();
  let activeTimer:ReturnType<typeof setTimeout>|undefined;
  const account=()=>{const now=performance.now();if(!finished){if(waiting)waited+=now-since;else active+=now-since;}since=now;};
  const snapshot=():XiaozhiUsage=>{account();return {runId:options.runId,budget,...(!limited?{limitsEnforced:false}:{}),modelCalls,toolCalls:tools.size,tokens:tokens?{...tokens}:null,
    completeness:tokens?missing?'partial':'reported':'unknown',cost:null,activeMs:Math.floor(active),waitingMs:Math.floor(waited),state,...(exhausted?{exhausted}:{})};};
  const emit=()=>options.emit(snapshot());
  const clear=()=>{if(activeTimer)clearTimeout(activeTimer);activeTimer=undefined;};
  const exhaust=(reason:NonNullable<XiaozhiUsage['exhausted']>)=>{if(exhausted||finished)return;exhausted=reason;clear();emit();options.abort();};
  const arm=()=>{clear();if(!limited||waiting||finished||exhausted)return;account();activeTimer=setTimeout(()=>exhaust('active_time'),Math.max(1,budget.activeMs-active));};
  const assert=()=>{if(exhausted||finished)throw new Error('budget_exhausted');};
  return {
    start(){emit();arm();},snapshot,
    model(){assert();account();if(limited&&active>=budget.activeMs){exhaust('active_time');assert();}
      if(limited&&modelCalls>=budget.maxModelCalls){exhaust('model_calls');assert();}
      if(limited&&tokens && tokens.total>=budget.maxTokens){exhaust('tokens');assert();}
      modelCalls++;emit();},
    tool(id:string){assert();if(tools.has(id))return;if(limited&&tools.size>=budget.maxToolCalls){exhaust('tool_calls');assert();}tools.add(id);emit();},
    observe(usage:Usage) {
      const keys=['input','output','cacheRead','cacheWrite'] as const;
      if(!usage || keys.some(key=>!Number.isFinite(usage[key]) || usage[key]<0) || !keys.some(key=>usage[key]>0)){missing=true;emit();return;}
      tokens ||= {input:0,output:0,cacheRead:0,cacheWrite:0,total:0};
      for(const key of keys)tokens[key]+=usage[key];tokens.total=tokens.input+tokens.output+tokens.cacheRead+tokens.cacheWrite;emit();
    },
    async wait<T>(fn:()=>Promise<T>):Promise<T> {
      assert();account();waiting++;state='waiting';clear();emit();
      const timer=limited?setTimeout(()=>exhaust('wait_time'),budget.waitMs):undefined;if(timer)waitTimers.add(timer);
      try{return await fn();}finally{if(timer){clearTimeout(timer);waitTimers.delete(timer);}account();waiting--;if(!finished)state=waiting?'waiting':'running';emit();arm();}
    },
    finish(next:XiaozhiUsage['state']){account();finished=true;state=next;clear();for(const timer of waitTimers)clearTimeout(timer);waitTimers.clear();emit();return snapshot();},
  };
}
