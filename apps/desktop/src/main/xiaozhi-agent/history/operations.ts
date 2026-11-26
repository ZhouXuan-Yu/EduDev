import type { HistoryAccessAction, HistoryMemoryError, HistoryResult, HistorySourceRef } from '../../../shared/xiaozhi-history-memory';
import type { createHistoryMemory } from './memory';

const errors: HistoryMemoryError[] = ['invalid_input','permission_denied','command_conflict','source_changed','source_unavailable','busy','configuration'];
async function result<T>(fn:()=>Promise<T>): Promise<HistoryResult<T>> {
  try {return {ok:true,value:await fn()};}
  catch(error) {const code=error instanceof Error?error.message:'';return {ok:false,error:errors.includes(code as HistoryMemoryError)?code as HistoryMemoryError:'configuration'};}
}

export function historyOperations(history: ReturnType<typeof createHistoryMemory>,
  revokeRunning:(id:string)=>Promise<void>, mutate:<T>(work:()=>Promise<T>)=>Promise<T> = async work=>work()) {
  return {
    status:()=>result(()=>history.status()),
    rebuild:()=>result(async()=>{await history.rebuild();return history.status();}),
    sessions:()=>result(()=>history.sessions()),
    list:(sessionId:string,offset:number)=>result(()=>history.list(sessionId,offset)),
    preview:(ref:HistorySourceRef,offset:number,authorized:boolean)=>result(async()=>{
      if (typeof authorized!=='boolean') throw Error('invalid_input');
      return history.preview(ref,offset,authorized);
    }),
    discover:(sessionId:string,query:string)=>result(()=>history.discover(sessionId,query)),
    change:(ref:HistorySourceRef,revision:number,action:HistoryAccessAction)=>result(()=>mutate(async()=>{
      const updated = await history.change(ref,revision,action);
      await revokeRunning(updated.sourceId);
      return updated;
    })),
  };
}
