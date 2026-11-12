import {createClassroomPlanState} from '../education/classroom-plan-state';
import {createInspectionState} from './checks/state';
type SqlValue = string | number | null | Buffer;
export type Sql = { run: (sql: string, values?: SqlValue[]) => Promise<unknown>;
  change?: (sql: string, values?: SqlValue[]) => Promise<number>;
  transaction?: <T>(action: (work: Sql) => Promise<T>) => Promise<T>;
  all: (sql: string, values?: SqlValue[]) => Promise<Record<string, unknown>[]> };
import { createPiPersistentState } from './persistent-state';
import { createPiControlState } from './control-state';
import { createPiBudgetState } from './budget-state';
import { createPiMemoryScopeState } from './memory-scope-state';
import { createPiSkillCatalogState } from './skill-catalog-state';
import { createModelSettingsState } from './model-settings-state';
import { createModelSwitchState } from './model-switch-state';
import { createTextChangeState } from './text-change-state';
import { createOfficeArtifactState } from './office-artifact-state';
import {createDeliveryState} from './delivery-state';
import { createAttachmentState } from './attachment-state';
import { createAttachmentImportState } from './attachment-import-state';
import {createAttachmentSendState} from './attachment-send-state';
import {createAttachmentOcrState} from './attachment-ocr-state';
import {createGoalState} from './goal-state';
import { createEventJournal } from './events/journal';
import {createClassroomState} from '../education/classroom-state';
import {createTeacherPreferenceState} from '../education/teacher-preference-state';
import {readNativeToolEntries} from './events/native-tail';
import {createRecoveryEffectReader} from './events/recovery-readback';
import {serializeStateWrites} from './serialized-state-sql';
import {createCapabilityRegistry} from './capabilities/registry';
import {NATIVE_STAT_PROVIDER_IDS,registerNativeStatProviders} from './capabilities/native-stat';
/** Incremental private SDK binding; visible messages/runs remain in existing tables. */
export function createXiaozhiSessionState(source: Sql,options?:{nativeRoot:()=>string;dataRoot?:()=>string}) {
  const sql=serializeStateWrites(source);
  const capabilities=createCapabilityRegistry(sql,{officialProviderIds:NATIVE_STAT_PROVIDER_IDS});
  const persistent = createPiPersistentState(sql);
  const controls = createPiControlState(sql);
  const budget = createPiBudgetState(sql);
  const memory = createPiMemoryScopeState(sql);
  const skills = createPiSkillCatalogState(sql);
  const modelSettings=createModelSettingsState(sql);
  const modelSwitch=createModelSwitchState(sql);
  const changes = createTextChangeState(sql);
  const officeArtifacts = createOfficeArtifactState(sql);
  const deliveries=createDeliveryState(sql);
  const inspections=createInspectionState(sql);
  const attachments = createAttachmentState(sql);
  const attachmentImports = createAttachmentImportState(sql);
  const attachmentSends=createAttachmentSendState(sql);
  const attachmentOcr=createAttachmentOcrState(sql);
  const goals=createGoalState(sql);
  const eventJournal=createEventJournal(sql,{...(options?{readNative:binding=>readNativeToolEntries(binding,options.nativeRoot())}:{}),readEffect:createRecoveryEffectReader({persistent,changes,artifacts:officeArtifacts,dataRoot:options?.dataRoot})});
  const classrooms=createClassroomState(sql);
  const classroomPlans=createClassroomPlanState(sql);
  return {
    sql,
    capabilities,
    ...persistent,
    ...controls,
    ...budget,
    ...memory,
    ...skills,
    teacherPreferences:createTeacherPreferenceState(sql),
    modelSettings,
    modelSwitch,
    changes,
    officeArtifacts,
    deliveries,
    inspections,
    attachments,
    attachmentImports,
    attachmentSends,
    attachmentOcr,
    goals,
    eventJournal,
    classrooms,
    classroomPlans,
    async recover() { await classroomPlans.recover(); await eventJournal.recover(); await persistent.recover(); await controls.recoverControls(); await budget.recoverBudget(); await changes.recover(); await officeArtifacts.recover(); await deliveries.recover(); await attachmentImports.recover(); await attachmentOcr.recover(); await goals.recover(); },
    async init() {
      await capabilities.migrate();
      await registerNativeStatProviders(capabilities);
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_session_bindings (
        conversation_id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1,
        session_file TEXT NOT NULL, model TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES ai_conversation_sessions(id))`);
      await persistent.migrate();
      await controls.migrateControls();
      await budget.migrateBudget();
      await memory.migrateMemoryScope();
      await skills.migrateSkillCatalog();
      await modelSwitch.migrate();
      await changes.migrate();
      await officeArtifacts.migrate();
      await deliveries.migrate();
      await inspections.migrate();
      await attachments.migrate();
      await attachmentImports.migrate();
      await attachmentSends.migrate();
      await attachmentOcr.migrate();
      await goals.migrate();
      await eventJournal.migrate();
    },
    async getBinding(id: string) {
      const row = (await sql.all('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id = ?', [id]))[0];
      if (!row) return null;
      if (![1, 2, 3, 4, 5].includes(Number(row.schema_version))) throw new Error('configuration');
      if (Number(row.schema_version)===5 && !await modelSwitch.current(id)) throw new Error('configuration');
      return { sessionFile: String(row.session_file), model: String(row.model) };
    },
    async setBinding(id: string, file: string, model: string, schemaVersion: 1 | 2 | 3 | 4 | 5 = 1) {
      if (![1, 2, 3, 4, 5].includes(schemaVersion)) throw new Error('configuration');
      const current = (await sql.all('SELECT schema_version FROM xiaozhi_pi_session_bindings WHERE conversation_id=?', [id]))[0];
      if (current && ![1, 2, 3, 4, 5].includes(Number(current.schema_version))) throw new Error('configuration');
      const ledger=await modelSwitch.current(id);
      if ((schemaVersion===5 || Number(current?.schema_version)===5) && !ledger) throw new Error('configuration');
      if (ledger && (ledger.model!==model || ledger.sessionFile.replace(/\\/g,'/')!==file.replace(/\\/g,'/'))) throw new Error('configuration');
      file=ledger?.sessionFile || file.replace(/\\/g,'/');
      await sql.run(`INSERT INTO xiaozhi_pi_session_bindings (conversation_id, schema_version, session_file, model, updated_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(conversation_id) DO UPDATE SET session_file=excluded.session_file,
        schema_version=MAX(xiaozhi_pi_session_bindings.schema_version, excluded.schema_version),
        model=excluded.model, updated_at=excluded.updated_at`, [id, schemaVersion, file, model, new Date().toISOString()]);
    },
    async runs(id: string, runIds?: string[]) {
      if (runIds) {
        const ids = [...new Set(runIds.filter(runId => /^[A-Za-z0-9_-]{1,200}$/.test(runId)))].slice(0, 80);
        if (!ids.length) return [];
        return sql.all(
          `SELECT id,status,error_message FROM ai_agent_runs
            WHERE session_id = ? AND sub_intent = 'pi_education'
              AND id IN (${ids.map(() => '?').join(',')})`,
          [id, ...ids],
        );
      }
      return sql.all("SELECT id,status,error_message FROM ai_agent_runs WHERE session_id = ? AND sub_intent = 'pi_education' ORDER BY created_at", [id]);
    },
  };
}
