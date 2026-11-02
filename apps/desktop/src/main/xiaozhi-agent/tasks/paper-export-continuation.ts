import type {TaskView} from '../../../shared/xiaozhi-task';

export const PAPER_EXPORT_RESTART_REQUIRED='paper_export_restart_required' as const;
/** The original persisted teacher message owns the binding, never a prompt or latest paper. */
export function assertPaperTaskContinuation(task:TaskView,messages:readonly {id:string;role:string;metadata:Record<string,unknown>}[]){
 const source=messages.find(message=>message.id===task.origin.messageId&&message.role==='user');
 if(!source||!source.metadata||typeof source.metadata!=='object')throw Error('task_source_changed');
 // Even an unreadable old binding must not silently become an unbound continuation.
 if(Object.prototype.hasOwnProperty.call(source.metadata,'paperExportIntent'))throw Error(PAPER_EXPORT_RESTART_REQUIRED);
}
