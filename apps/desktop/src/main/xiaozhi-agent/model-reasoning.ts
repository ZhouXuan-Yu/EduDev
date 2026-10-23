import type {OfficeModelReasoning} from '../../shared/office-agent';
import {MAX_REASONING_TEXT,MAX_REASONING_BLOCKS} from '../../shared/model-reasoning';

/** Bridges only SDK thinking deltas. Native SDK retains its own original blocks for tool replay. */
export function createModelReasoningTrace(options:{sanitize:(text:string)=>Promise<string>;emit:(block:OfficeModelReasoning)=>void;secret:string}){
  type Entry={block:OfficeModelReasoning;raw:string;clock:number;revision:number;published:number};
  const entries=new Map<string,Entry>();let total=0,active:Entry|undefined,pending:Promise<void>|undefined;
  const now=()=>performance.now();
  function schedule(){
    if(pending)return;
    pending=(async()=>{
      for(;;){
        const entry=[...entries.values()].find(e=>e.revision!==e.published);if(!entry)break;
        const revision=entry.revision,block={...entry.block},raw=entry.raw;
        try{
          const cleaned=await options.sanitize(raw);
          block.text=cleaned.split(options.secret||'\0').join('[已隐去凭证]').replace(/sk-[A-Za-z0-9_-]{12,}/g,'[已隐去凭证]').slice(0,MAX_REASONING_TEXT);
        }catch{block.text='推理内容脱敏未完成，已隐藏。';block.status='failed';}
        entry.published=revision;
        // Keep publishing sanitized progress even when deltas arrive faster than sanitization.
        // Use the latest lifecycle so a delayed snapshot cannot turn completed thinking back on.
        if(block.status!=='failed'){
          block.status=entry.block.status;block.durationMs=entry.block.durationMs;
          if(entry.block.truncated)block.truncated=true;
        }
        options.emit(block);
      }
    })().finally(()=>{pending=undefined;});
  }
  function close(status:OfficeModelReasoning['status']='completed'){
    if(!active)return;
    active.block.status=status;active.block.durationMs=Math.max(0,now()-active.clock);active.revision++;active=undefined;schedule();
  }
  return {
    delta(segment:number,index:number,delta:string){
      if(!delta)return;
      const id=`reasoning:${segment}:${index}`;
      if(active?.block.id!==id){
        close();let entry=entries.get(id);
        if(!entry){if(entries.size>=MAX_REASONING_BLOCKS){const last=[...entries.values()].at(-1);if(last){last.block.truncated=true;last.revision++;schedule();}return;}
          entry={block:{id,source:'provider',text:'',status:'streaming',startedAt:Date.now(),durationMs:0},raw:'',clock:now(),revision:0,published:0};entries.set(id,entry);}
        active=entry;
      }
      const accepted=delta.slice(0,Math.max(0,MAX_REASONING_TEXT-total));total+=accepted.length;active.raw+=accepted;
      active.block.durationMs=Math.max(0,now()-active.clock);if(accepted.length<delta.length)active.block.truncated=true;
      active.revision++;schedule();
    },
    close,
    async finish(status:OfficeModelReasoning['status']){close(status);while(pending)await pending;},
  };
}
