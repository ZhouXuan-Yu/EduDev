import type {Sql} from '../session-state';
import type {TaskOwner} from '../../../shared/xiaozhi-task';
import type {TaskRecoveryInspection} from '../../../shared/xiaozhi-task-recovery';
import {createTaskState} from './task-state';
import {validModelIdentity, type ModelIdentity} from '../model-switch-state';
import {protocolHash} from '../capabilities/validation';

/** Explicit resume moves only the native projection binding. Task, receipts and old history remain recorded. */
export async function commitNativeSessionRebuild(sql: Sql, input: {
  owner: TaskOwner;
  taskId: string;
  inspection: TaskRecoveryInspection;
  admittedAmendment?: {revision:number;requirementsVersion:number};
  expectedFile: string;
  replacement: {file: string; nativeSessionId: string; model: string; baseline: string[]};
}) {
  if (!sql.transaction || input.inspection.sessionId !== input.owner.sessionId || input.inspection.taskId !== input.taskId
      || !input.inspection.canRebuildSession) throw Error('permission_denied');
  return sql.transaction(async work => {
    const tasks = createTaskState({...work, transaction: action => action(work)}, {sanitize: async () => {throw Error('invalid_input');}});
    const task = await tasks.get(input.taskId);
    const amendment=input.admittedAmendment;
    if(amendment&&(!Number.isSafeInteger(amendment.revision)||amendment.revision<1||
      amendment.requirementsVersion!==input.inspection.requirementsVersion+1))throw Error('task_source_changed');
    const expected=amendment?.requirementsVersion??input.inspection.requirementsVersion;
    if(!task||task.sessionId!==input.owner.sessionId||task.requirementsVersion!==expected||amendment&&task.revision!==amendment.revision)
      throw Error('task_source_changed');
    await tasks.validateCurrent(input.owner, task.id, task.revision);
    const binding = (await work.all('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?', [input.owner.sessionId]))[0];
    if (!binding || String(binding.session_file).replaceAll('\\', '/') !== input.expectedFile.replaceAll('\\', '/')
        || binding.model !== input.replacement.model) throw Error('source_changed');
    const ledger = (await work.all('SELECT * FROM xiaozhi_pi_model_state WHERE conversation_id=?', [input.owner.sessionId]))[0];
    const transitions = ledger ? await work.all('SELECT * FROM xiaozhi_pi_model_transitions WHERE conversation_id=? AND native_session_id=? AND session_file=? ORDER BY expected_revision,id',
      [input.owner.sessionId, String(ledger.native_session_id), String(ledger.session_file)]) : [];
    const replacement: ModelIdentity = {sessionId: input.owner.sessionId, sessionFile: input.replacement.file.replaceAll('\\', '/'),
      nativeSessionId: input.replacement.nativeSessionId, originModel: input.replacement.model, model: input.replacement.model,
      revision: ledger ? Number(ledger.revision) + 1 : 0};
    if (!validModelIdentity(replacement) || input.replacement.baseline.length>4096
        || input.replacement.baseline.some(id=>!/^[a-f0-9]{8}$/iu.test(id))
        || new Set(input.replacement.baseline).size!==input.replacement.baseline.length
        || ledger && (ledger.session_file !== binding.session_file || ledger.current_model !== binding.model)) throw Error('configuration');
    const stamp = new Date().toISOString();
    const archive = JSON.parse(JSON.stringify({schemaVersion: 1, owner: input.owner, taskId: task.id, inspection: input.inspection,
      ...(amendment?{admittedAmendment:amendment}:{}),previousBinding: binding, previousLedger: ledger || null, previousTransitions: transitions, replacement, createdAt: stamp}));
    if (!work.change || await work.change('INSERT OR IGNORE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',
      ['xiaozhi.native-rebuild.v1:' + input.owner.runId, JSON.stringify({schemaVersion:1,document:archive,hash:protocolHash(archive)}), stamp]) !== 1) throw Error('command_conflict');
    if (ledger) {
      await work.run("UPDATE xiaozhi_pi_model_transitions SET status='aborted',updated_at=? WHERE conversation_id=? AND native_session_id=? AND session_file=? AND status='prepared'",
        [stamp, input.owner.sessionId, String(ledger.native_session_id), String(ledger.session_file)]);
      if (await work.change(`UPDATE xiaozhi_pi_model_state SET revision=?,origin_model=?,current_model=?,native_session_id=?,session_file=?,baseline_entries_json=?,updated_at=?
        WHERE conversation_id=? AND revision=? AND native_session_id=? AND session_file=?`,
      [replacement.revision, replacement.originModel, replacement.model, replacement.nativeSessionId, replacement.sessionFile, JSON.stringify(input.replacement.baseline), stamp,
        input.owner.sessionId, Number(ledger.revision), String(ledger.native_session_id), String(ledger.session_file)]) !== 1) throw Error('source_changed');
    }
    if (await work.change(`UPDATE xiaozhi_pi_session_bindings SET session_file=?,schema_version=?,updated_at=?
      WHERE conversation_id=? AND session_file=? AND model=?`,
    [replacement.sessionFile, ledger ? 5 : Number(binding.schema_version), stamp, input.owner.sessionId,
      String(binding.session_file), input.replacement.model]) !== 1) throw Error('source_changed');
    return replacement;
  });
}
