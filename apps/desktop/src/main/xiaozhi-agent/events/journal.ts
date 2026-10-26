import { createHash } from 'node:crypto';
import {validVersionedPlan} from '../../../shared/xiaozhi-plan';
import type { Sql } from '../session-state';
import type { OfficeProjectedTurn } from '../../../shared/office-agent';
import type { XiaozhiAgentEvent } from '../../../shared/xiaozhi-agent';
import type { XiaozhiEventCursor, XiaozhiEventsInput, XiaozhiEventsPage } from '../../../shared/xiaozhi-events';
import { validEventsInput } from '../../../shared/xiaozhi-events';
import { applyXiaozhiEvent } from '../../../shared/xiaozhi-projection';
import { legacyVerification } from '../../../shared/xiaozhi-verification';
import {validRecovery} from '../../../shared/xiaozhi-recovery';
import {validToolAttempt} from '../../../shared/xiaozhi-tool-attempt';
import {createToolReceipts,type ReceiptCapture,type ReceiptReadback} from './receipts';
import type {NativeRunBinding} from './native-tail';
import {interruptedVerification,type TerminalCancellation} from './terminal-cancellation';
import {validTaskView,type TaskView} from '../../../shared/xiaozhi-task';
import {taskGoalProjection} from '../tasks/goal-binding';

export type JournalOwner = { sessionId: string; runId: string; generation: number };
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const kinds = new Set(['activity','text_delta','model_reasoning','assistant_start','assistant_phase','assistant_end','tool_start','tool_attempt','tool_end','approval','change','office_artifact','learning_review','question_collection','question_review','paper_review','practice_review','control','goal','task','image_delivery','usage','verification','recovery','compaction','memory_isolation','skill_isolation','status']);
const identity = (value: string) => /^[A-Za-z0-9_-]{1,160}$/.test(value);
function json(value: unknown) {
  const text = JSON.stringify(value);
  if (!text || Buffer.byteLength(text) > 4 * 1024 * 1024) throw Error('event_journal_bounds');
  return text;
}
const cursor = (row: Record<string, unknown>): XiaozhiEventCursor => ({ runId: String(row.run_id), generation: Number(row.generation), sequence: Number(row.sequence), revision: Number(row.revision) });
/** SQLite is the public-process truth. Native transcripts remain private SDK truth. */
export function createEventJournal(sql: Sql,readback:ReceiptReadback={}) {
  const receipts=createToolReceipts(readback);
  function transaction<T>(action: (work: Sql) => Promise<T>) {
    if (!sql.transaction) throw Error('event_journal_transaction_required');
    return sql.transaction(action);
  }
  async function assertOwned(work:Sql,owner:JournalOwner){
    const row=(await work.all("SELECT o.generation,o.run_id,r.status FROM xiaozhi_event_owners o JOIN xiaozhi_event_runs r ON r.run_id=o.run_id WHERE o.session_id=?",[owner.sessionId]))[0];
    if(!row||row.run_id!==owner.runId||Number(row.generation)!==owner.generation||row.status!=='running')throw Error('event_owner_stale');
  }
  async function append(work: Sql, owner: JournalOwner, revision: number, events: XiaozhiAgentEvent[], finalTurn?: OfficeProjectedTurn,captures:ReceiptCapture[]=[], cancellationCorrection=false,taskMutation=false) {
    const row = (await work.all('SELECT * FROM xiaozhi_event_runs WHERE run_id=? AND session_id=?', [owner.runId, owner.sessionId]))[0];
    const fence = (await work.all('SELECT * FROM xiaozhi_event_owners WHERE session_id=?', [owner.sessionId]))[0];
    if (!row || !fence || Number(row.generation) !== owner.generation || Number(fence.generation) !== owner.generation || fence.run_id !== owner.runId) throw Error('event_owner_stale');
    if (!events.length || events.length > 128) throw Error('event_journal_bounds');
    const encoded = events.map(event => {
      if (event.sessionId !== owner.sessionId || event.runId !== owner.runId || event.generation !== owner.generation || event.durability !== 'committed' || !Number.isSafeInteger(event.sequence) || !kinds.has(event.kind)) throw Error('invalid_input');
      if(event.kind==='recovery'&&(!validRecovery(event.recovery)||event.recovery.runId!==owner.runId))throw Error('invalid_input');
      if(event.kind==='tool_attempt'&&!validToolAttempt(event.attempt))throw Error('invalid_input');
      if(event.kind==='control'&&event.control.plan&&(!validVersionedPlan(event.control)||event.control.runId!==owner.runId))throw Error('invalid_input');
      if(event.kind==='task'&&(!taskMutation||!validTaskView(event.task)||event.task.sessionId!==owner.sessionId))throw Error('invalid_input');
      return json(event);
    });
    // An exact retry is allowed; a different payload at an existing sequence is not.
    if (Number(row.revision) !== revision) {
      for (let i = 0; i < events.length; i++) {
        const old = (await work.all('SELECT event_hash FROM xiaozhi_event_journal WHERE run_id=? AND sequence=?', [owner.runId, events[i].sequence]))[0];
        if (!old || old.event_hash !== hash(encoded[i])) throw Error('event_revision_conflict');
      }
      for(const capture of captures){const prior=(await work.all('SELECT tool,result_digest,success FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',[owner.runId,capture.callId]))[0];if(!prior||prior.tool!==capture.tool||prior.result_digest!==capture.digest||Boolean(prior.success)===capture.failed)throw Error('event_revision_conflict');}
      if (finalTurn && hash(json(finalTurn)) !== hash(String(row.turn_json))) throw Error('event_revision_conflict');
      return { cursor: cursor(row), turn: JSON.parse(String(row.turn_json)) as OfficeProjectedTurn };
    }
    if (row.status !== 'running' && !(taskMutation&&events.length===1&&events[0].kind==='task') && !(cancellationCorrection&&events.length===2&&events[0].kind==='verification'&&events[1].kind==='status'&&events[1].status==='interrupted'&&finalTurn?.status==='interrupted')) throw Error('event_run_settled');
    let turn = JSON.parse(String(row.turn_json)) as OfficeProjectedTurn;
    let sequence = Number(row.sequence);
    const timestamp = new Date().toISOString();
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.sequence !== ++sequence) throw Error('event_sequence_gap');
      turn = applyXiaozhiEvent(turn, event);
      await receipts.apply(work,owner,event,event.kind==='tool_end'?captures.find(c=>c.callId===event.callId):undefined);
      await work.run('INSERT INTO xiaozhi_event_journal(run_id,sequence,generation,event_json,event_hash,created_at) VALUES(?,?,?,?,?,?)', [owner.runId, sequence, owner.generation, encoded[i], hash(encoded[i]), timestamp]);
      await work.run('INSERT INTO xiaozhi_event_outbox(run_id,sequence,notified) VALUES(?,?,0)', [owner.runId, sequence]);
    }
    if (finalTurn) {
      const last = events.at(-1)!;
      if (last.kind !== 'status' || last.status === 'running' || finalTurn.id !== owner.runId || finalTurn.status !== last.status) throw Error('invalid_input');
      turn = structuredClone(finalTurn);
    }
    // Projection waiting_input is still an active journal owner, not a settled run.
    const terminal = [...events].reverse().find(event => event.kind === 'status' && event.status !== 'running');
    const status = terminal?.kind === 'status' ? terminal.status : taskMutation?String(row.status):'running';
    await work.run('UPDATE xiaozhi_event_runs SET sequence=?,revision=revision+1,status=?,turn_json=?,updated_at=? WHERE run_id=? AND revision=?', [sequence, status, json(turn), timestamp, owner.runId, revision]);
    return { cursor: { runId: owner.runId, generation: owner.generation, sequence, revision: revision + 1 }, turn };
  }
  async function correctCancellation(work:Sql,owner:JournalOwner,cancellation:TerminalCancellation) {
    const row=(await work.all('SELECT * FROM xiaozhi_event_runs WHERE run_id=? AND session_id=?',[owner.runId,owner.sessionId]))[0];
    const fence=(await work.all('SELECT * FROM xiaozhi_event_owners WHERE session_id=?',[owner.sessionId]))[0];
    if(!row||!fence||Number(row.generation)!==owner.generation||Number(fence.generation)!==owner.generation||fence.run_id!==owner.runId)throw Error('event_owner_stale');
    let turn=JSON.parse(String(row.turn_json)) as OfficeProjectedTurn;
    const verification=interruptedVerification(turn),base={...owner,schemaVersion:1 as const,durability:'committed' as const,revision:Number(row.revision)+1};
    const events:XiaozhiAgentEvent[]=[{...base,sequence:Number(row.sequence)+1,kind:'verification',verification},{...base,sequence:Number(row.sequence)+2,kind:'status',status:'interrupted',error:'cancelled'}];
    for(const event of events)turn=applyXiaozhiEvent(turn,event);
    await cancellation.repair(work,turn);
    return {...await append(work,owner,Number(row.revision),events,turn,[],true),events};
  }
  return {
    async migrate() {
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_event_owners(session_id TEXT PRIMARY KEY,generation INTEGER NOT NULL,run_id TEXT NOT NULL,FOREIGN KEY(session_id) REFERENCES ai_conversation_sessions(id))`);
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_event_runs(run_id TEXT PRIMARY KEY,session_id TEXT NOT NULL,generation INTEGER NOT NULL,revision INTEGER NOT NULL,sequence INTEGER NOT NULL,status TEXT NOT NULL,turn_json TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(run_id) REFERENCES ai_agent_runs(id),FOREIGN KEY(session_id) REFERENCES ai_conversation_sessions(id))`);
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_event_journal(run_id TEXT NOT NULL,sequence INTEGER NOT NULL,generation INTEGER NOT NULL,event_json TEXT NOT NULL,event_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(run_id,sequence),FOREIGN KEY(run_id) REFERENCES xiaozhi_event_runs(run_id))`);
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_event_outbox(run_id TEXT NOT NULL,sequence INTEGER NOT NULL,notified INTEGER NOT NULL,PRIMARY KEY(run_id,sequence),FOREIGN KEY(run_id,sequence) REFERENCES xiaozhi_event_journal(run_id,sequence))`);
      await sql.run('CREATE INDEX IF NOT EXISTS idx_xiaozhi_event_session ON xiaozhi_event_runs(session_id,updated_at)');
      await receipts.migrate(sql);
    },
    async begin(sessionId: string, runId: string, turn: OfficeProjectedTurn): Promise<JournalOwner> {
      if (!/^aisession_[a-f0-9-]{36}$/i.test(sessionId) || !identity(runId) || turn.id !== runId) throw Error('invalid_input');
      return transaction(async work => {
        const existing = (await work.all('SELECT * FROM xiaozhi_event_owners WHERE session_id=?', [sessionId]))[0];
        if (existing && (await work.all("SELECT run_id FROM xiaozhi_event_runs WHERE run_id=? AND status='running'", [String(existing.run_id)])).length) throw Error('busy');
        const generation = Number(existing?.generation || 0) + 1;
        await work.run('INSERT INTO xiaozhi_event_owners(session_id,generation,run_id) VALUES(?,?,?) ON CONFLICT(session_id) DO UPDATE SET generation=excluded.generation,run_id=excluded.run_id', [sessionId, generation, runId]);
        await work.run("INSERT INTO xiaozhi_event_runs(run_id,session_id,generation,revision,sequence,status,turn_json,updated_at) VALUES(?,?,?,0,0,'running',?,?)", [runId, sessionId, generation, json(turn), new Date().toISOString()]);
        return { sessionId, runId, generation };
      });
    },
    append: (owner: JournalOwner, revision: number, events: XiaozhiAgentEvent[], finalTurn?: OfficeProjectedTurn,captures?:ReceiptCapture[],cancellation?:TerminalCancellation) => transaction(async work => {
      const saved=await append(work,owner,revision,events,finalTurn,captures);
      return finalTurn&&cancellation?.requested()?correctCancellation(work,owner,cancellation):{...saved,events};
    }),
    correctCancellation:(owner:JournalOwner,cancellation:TerminalCancellation)=>transaction(work=>correctCancellation(work,owner,cancellation)),
    /** State/action receipt and public task checkpoint share one SQLite commit.
     * A terminal run keeps its status; this cannot dispatch any model/tool. */
    changeTask:(owner:JournalOwner,revision:number,sequence:number,mutate:(work:Sql)=>Promise<TaskView>)=>transaction(async work=>{
      const row=(await work.all('SELECT * FROM xiaozhi_event_runs WHERE session_id=? AND run_id=? AND generation=?',[owner.sessionId,owner.runId,owner.generation]))[0],fence=(await work.all('SELECT run_id,generation FROM xiaozhi_event_owners WHERE session_id=?',[owner.sessionId]))[0];
      if(!row||!fence||fence.run_id!==owner.runId||Number(fence.generation)!==owner.generation)throw Error('event_owner_stale');
      if(Number(row.revision)!==revision||Number(row.sequence)+1!==sequence)throw Error('event_revision_conflict');
      const task=await mutate(work);if(!validTaskView(task)||task.sessionId!==owner.sessionId)throw Error('invalid_input');
      const record=(await work.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.task.v1:'+task.id]))[0];let stored;
      try{stored=JSON.parse(String(record?.value_json));}catch{throw Error('task_record_uncommitted');}
      const lineage=stored?.eventOwner||stored?.lineage?.at(-1);
      if(JSON.stringify(stored?.view)!==JSON.stringify(task)||lineage?.runId!==owner.runId||lineage?.generation!==owner.generation)throw Error('task_record_uncommitted');
      const previous=JSON.parse(String(row.turn_json)) as OfficeProjectedTurn;
      if(JSON.stringify(previous.task)===JSON.stringify(task))return{cursor:cursor(row),turn:previous,events:[] as XiaozhiAgentEvent[],task};
      const goal=await taskGoalProjection(work,task);
      const event:XiaozhiAgentEvent={...owner,schemaVersion:1,durability:'committed',sequence,revision:revision+1,kind:'task',task:structuredClone(task),...(goal?{goal}:{})};
      return{...await append(work,owner,revision,[event],undefined,[],false,true),events:[event],task};
    }),
    bindNative:(owner:JournalOwner,binding:NativeRunBinding)=>transaction(async work=>{await assertOwned(work,owner);await receipts.bind(work,owner,binding);}),
    admitTool:(owner:JournalOwner,callId:string,tool:string)=>transaction(async work=>{await assertOwned(work,owner);await receipts.admit(work,owner,callId,tool);}),
    reconcile:(owner:JournalOwner)=>transaction(async work=>{await assertOwned(work,owner);return receipts.reconcile(work,owner);}),
    async assertOwner(owner: JournalOwner) {
      await assertOwned(sql,owner);
    },
    async notified(runId: string, sequence: number) {
      await sql.run('UPDATE xiaozhi_event_outbox SET notified=1 WHERE run_id=? AND sequence<=?', [runId, sequence]);
    },
    async snapshots(sessionId: string) {
      const rows = await sql.all('SELECT * FROM xiaozhi_event_runs WHERE session_id=? ORDER BY updated_at,run_id', [sessionId]);
      return rows.map(row => ({ cursor: cursor(row), turn: JSON.parse(String(row.turn_json)) as OfficeProjectedTurn }));
    },
    async snapshotsForRuns(sessionId: string, runIds: string[]) {
      const ids = [...new Set(runIds.filter(runId => identity(runId)))].slice(0, 80);
      if (!ids.length) return [];
      const rows = await sql.all(
        `SELECT * FROM xiaozhi_event_runs
          WHERE session_id=? AND run_id IN (${ids.map(() => '?').join(',')})
          ORDER BY updated_at,run_id`,
        [sessionId, ...ids],
      );
      return rows.map(row => ({ cursor: cursor(row), turn: JSON.parse(String(row.turn_json)) as OfficeProjectedTurn }));
    },
    async snapshot(sessionId:string,runId:string){
      const row=(await sql.all('SELECT * FROM xiaozhi_event_runs WHERE session_id=? AND run_id=?',[sessionId,runId]))[0];
      return row?{cursor:cursor(row),status:String(row.status),turn:JSON.parse(String(row.turn_json)) as OfficeProjectedTurn}:null;
    },
    async list(input: XiaozhiEventsInput): Promise<XiaozhiEventsPage> {
      if (!validEventsInput(input)) throw Error('invalid_input');
      const row = (await sql.all('SELECT * FROM xiaozhi_event_runs WHERE session_id=? AND run_id=? AND generation=?', [input.sessionId, input.runId, input.generation]))[0];
      if (!row) throw Error('permission_denied');
      if (input.after > Number(row.sequence)) throw Error('event_cursor_ahead');
      const limit = input.limit || 128;
      const rows = await sql.all('SELECT event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? AND sequence>? ORDER BY sequence LIMIT ?', [input.runId, input.after, limit + 1]);
      const events = rows.slice(0, limit).map(item => { const text = String(item.event_json); if (hash(text) !== item.event_hash) throw Error('event_journal_corrupt'); return JSON.parse(text) as XiaozhiAgentEvent; });
      return { schemaVersion: 1, cursor: cursor(row), events, hasMore: rows.length > limit };
    },
    async recover() {
      const rows = await sql.all("SELECT * FROM xiaozhi_event_runs WHERE status='running'");
      if (!rows.length) return;
      await transaction(async work => {
        for (const candidate of rows) {
          const row = (await work.all("SELECT * FROM xiaozhi_event_runs WHERE run_id=? AND status='running'", [String(candidate.run_id)]))[0];
          if (!row) continue;
          const owner = { sessionId: String(row.session_id), runId: String(row.run_id), generation: Number(row.generation) };
          const recovery=await receipts.reconcile(work,owner),sequence=Number(row.sequence);
          const recovered:XiaozhiAgentEvent={...owner,schemaVersion:1,durability:'committed',sequence:sequence+1,kind:'recovery',recovery};
          const event: XiaozhiAgentEvent = { ...owner, schemaVersion: 1, durability: 'committed', sequence: sequence + (recovery.receipts.length?2:1), kind: 'status', status: 'interrupted', error: 'cancelled' };
          const previous=JSON.parse(String(row.turn_json));
          const turn = applyXiaozhiEvent(recovery.receipts.length?applyXiaozhiEvent(previous,recovered):previous,event); turn.verification = legacyVerification(owner.runId);
          await append(work, owner, Number(row.revision), recovery.receipts.length?[recovered,event]:[event], turn);
          await work.run("UPDATE xiaozhi_event_owners SET generation=generation+1,run_id='' WHERE session_id=? AND generation=?", [owner.sessionId, owner.generation]);
        }
      });
    },
  };
}
