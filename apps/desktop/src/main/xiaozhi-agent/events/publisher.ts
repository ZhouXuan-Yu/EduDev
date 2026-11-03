import type { OfficeProjectedTurn } from '../../../shared/office-agent';
import type { XiaozhiAgentEvent, XiaozhiAgentEventPayload } from '../../../shared/xiaozhi-agent';
import type { createEventJournal, JournalOwner } from './journal';
import type {ReceiptCapture} from './receipts';
import type {TerminalCancellation} from './terminal-cancellation';
import type {Sql} from '../session-state';
import type {TaskView} from '../../../shared/xiaozhi-task';

/** Batches streaming deltas; a failed commit permanently closes this publisher. */
export function createEventPublisher(options: { journal: ReturnType<typeof createEventJournal>; owner: JournalOwner;
  committed: (turn: OfficeProjectedTurn, sequence: number) => void; emit: (event: XiaozhiAgentEvent) => void;
  failed: (error:unknown) => void; beforeTerminalEmit: () => void; cancellation?:TerminalCancellation }) {
  let sequence = 0, revision = 0, pending: XiaozhiAgentEvent[] = [],captures:ReceiptCapture[]=[], failure: unknown, sealed = false;
  let chain = Promise.resolve(), timer: ReturnType<typeof setTimeout> | undefined;
  type Batch = { events: XiaozhiAgentEvent[]; captures: ReceiptCapture[]; checkpoint?: OfficeProjectedTurn };
  let queued: Batch | undefined;
  function fail(error:unknown){if(failure)return;failure=error||Error('event_persistence');if(timer){clearTimeout(timer);timer=undefined;}options.failed(failure);}
  function enqueue(payload: XiaozhiAgentEventPayload, finalTurn?: OfficeProjectedTurn,capture?:ReceiptCapture) {
    if (failure || sealed) return;
    if (payload.kind === 'status' && payload.status !== 'running') sealed = true;
    const event: XiaozhiAgentEvent = { ...structuredClone(payload), ...options.owner, schemaVersion: 1, durability: 'committed', sequence: ++sequence };
    pending.push(event);
    if(capture)captures.push(structuredClone(capture));
    // Reasoning progress is cumulative and can arrive hundreds of times per
    // second. Share the text batch; lifecycle/tool/terminal events still flush
    // immediately and every event keeps its original committed sequence.
    const progress=payload.kind==='text_delta'||(payload.kind==='model_reasoning'&&payload.block.status==='streaming');
    if (!progress || pending.length >= 128) drain(finalTurn);
    // Persist/notify text at a bounded cadence; each original event is retained.
    // Tool/lifecycle events and explicit barriers still drain synchronously.
    else timer ??= setTimeout(() => { timer = undefined; drain(); }, 100);
  }
  function drain(finalTurn?: OfficeProjectedTurn) {
    if (timer) { clearTimeout(timer); timer = undefined; }
    const events = pending.splice(0);
    const privateCaptures=captures.splice(0);
    if (!events.length) return;
    // A terminal checkpoint is frozen before a later caller can change its object.
    const checkpoint = finalTurn ? structuredClone(finalTurn) : undefined;
    // A running COMMIT already owns the queue. Combine subsequent small drains
    // until their turn starts, without crossing private-write/task fences.
    if (queued && !queued.checkpoint && queued.events.length + events.length <= 128) {
      queued.events.push(...events); queued.captures.push(...privateCaptures);
      if (checkpoint) queued.checkpoint = checkpoint;
      return;
    }
    const batch: Batch = { events, captures: privateCaptures, checkpoint };
    queued = batch;
    chain = chain.then(async () => {
      if (queued === batch) queued = undefined;
      if (failure) throw failure;
      for (const event of batch.events) event.revision = revision + 1;
      let saved = await options.journal.append(options.owner, revision, batch.events, batch.checkpoint,batch.captures,options.cancellation);
      // Stop can arrive while COMMIT is awaiting its native callback. Repair the
      // same owner before exposing completion; never replay model/tool effects.
      if(batch.checkpoint&&options.cancellation?.requested()&&saved.turn.status!=='interrupted')saved=await options.journal.correctCancellation(options.owner,options.cancellation);
      if(failure)throw failure; // A late DB callback cannot revive a failed publisher.
      revision = saved.cursor.revision; options.committed(saved.turn, saved.cursor.sequence);
      let delivered = true;
      for (const event of saved.events) {
        if (event.kind === 'status' && event.status !== 'running') options.beforeTerminalEmit();
        try { options.emit(event); } catch { delivered = false; }
      }
      // Outbox notification status is advisory. Failure cannot undo an event commit.
      if (delivered) await options.journal.notified(options.owner.runId, saved.cursor.sequence).catch(() => undefined);
    }).catch(error => { fail(error); throw error; });
    void chain.catch(() => undefined);
  }
  return {
    enqueue,
    owner:options.owner,
    /** Main-only permanent closure; it does not claim an in-flight DB write rolled back. */
    fail,
    /** Recovery must wait for late native COMMIT/correction callbacks too.
     * flush intentionally rejects immediately once failed; it is not this fence. */
    settled:()=>chain.then(()=>undefined,()=>undefined),
    async checkpointTask(mutate:(work:Sql)=>Promise<TaskView>):Promise<TaskView>{
      if(failure||sealed)throw failure||Error('event_run_settled');drain();queued=undefined;const reserved=++sequence;let value:TaskView;
      chain=chain.then(async()=>{
        if(failure)throw failure;
        const saved=await options.journal.changeTask(options.owner,revision,reserved,mutate);
        if(saved.cursor.sequence!==reserved)throw Error('event_revision_conflict');
        revision=saved.cursor.revision;value=saved.task;options.committed(saved.turn,saved.cursor.sequence);
        let delivered=true;for(const event of saved.events){try{options.emit(event);}catch{delivered=false;}}
        if(delivered)await options.journal.notified(options.owner.runId,saved.cursor.sequence).catch(()=>undefined);
      }).catch(error=>{fail(error);throw error;});void chain.catch(()=>undefined);await chain;return value!;
    },
    /** All private critical writes share the event queue and permanent failure gate. */
    async persist<T>(action:(owner:JournalOwner)=>Promise<T>):Promise<T>{
      if(failure||sealed)throw failure||Error('event_run_settled');
      drain();queued=undefined;let value:T;
      chain=chain.then(async()=>{if(failure)throw failure;await options.journal.assertOwner(options.owner);if(failure)throw failure;value=await action(options.owner);if(failure)throw failure;}).catch(error=>{fail(error);throw error;});void chain.catch(()=>undefined);await chain;return value!;
    },
    async flush() { if(failure)throw failure;do { drain(); await chain; } while (pending.length); if (failure) throw failure; },
    async barrier() { if(failure)throw failure;do { drain(); await chain; } while (pending.length); if (failure) throw failure; await options.journal.assertOwner(options.owner);if(failure)throw failure; },
    get failed() { return Boolean(failure); },
  };
}
