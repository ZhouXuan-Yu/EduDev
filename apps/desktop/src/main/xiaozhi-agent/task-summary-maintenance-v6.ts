import {taskDocumentPrefix,taskPrefix,taskSummaryPrefix as prefix} from './task-summary-schema';

export const taskSummaryRowCountTable=prefix+'row_count_v6';
const rows=prefix+'rows',dirty=prefix+'dirty',sessions=prefix+'dirty_sessions',control=prefix+'control';
const count=taskSummaryRowCountTable;
const rowTriggers=[prefix+'row_count_insert_v6',prefix+'row_count_delete_v6'];
const taskTriggers=['insert','update','delete'].map(operation=>prefix+'task_'+operation);
const taskKeyLength=taskDocumentPrefix.length+64;
const taskKey=(row:string)=>`${row}.key GLOB '${taskDocumentPrefix}*' AND
  (length(${row}.key)=${taskKeyLength} OR substr(${row}.key,${taskKeyLength+1},10)=':revision:')`;
const isLatest=(row:string)=>`${row}.key GLOB '${taskPrefix}session:*'`;

function invalidate(row:string) {
  return `INSERT INTO ${dirty}(task_id)
    SELECT substr(${row}.key,${taskPrefix.length+1},71) WHERE ${taskKey(row)} ON CONFLICT(task_id) DO NOTHING;
    INSERT INTO ${sessions}(session_id) SELECT substr(${row}.key,${taskPrefix.length+'session:'.length+1})
    WHERE ${isLatest(row)} ON CONFLICT(session_id) DO UPDATE SET after_task='';`;
}

// The v2 SQL stays byte-identical. A Task revision updates its own row. A
// changed session pointer can change any row's latest status and keeps its sweep.
const updatedTaskTriggers=(['INSERT','UPDATE','DELETE'] as const).map((operation,index)=>{
  const refs=operation==='UPDATE'?['old','new']:operation==='INSERT'?['new']:['old'];
  const matches=refs.map(row=>`((${taskKey(row)}) OR ${isLatest(row)})`).join(' OR ');
  const changed=operation==='UPDATE'?' AND (old.key IS NOT new.key OR old.value_json IS NOT new.value_json)':'';
  return `CREATE TRIGGER ${taskTriggers[index]} AFTER ${operation} ON app_settings WHEN (${matches})${changed}
    BEGIN UPDATE ${control} SET generation=generation+1 WHERE id=1; ${refs.map(invalidate).join(' ')} END;`;
});

export const taskSummaryMaintenanceObjects={tables:[count],triggers:rowTriggers};
export const taskSummaryMaintenanceV6=[
  `CREATE TABLE ${count}(id INTEGER PRIMARY KEY CHECK(id=1),actual_rows INTEGER NOT NULL CHECK(actual_rows>=0));`,
  `INSERT INTO ${count} SELECT 1,COUNT(*) FROM ${rows};`,
  `CREATE TRIGGER ${rowTriggers[0]} AFTER INSERT ON ${rows} BEGIN UPDATE ${count} SET actual_rows=actual_rows+1 WHERE id=1; END;`,
  `CREATE TRIGGER ${rowTriggers[1]} AFTER DELETE ON ${rows} BEGIN UPDATE ${count} SET actual_rows=actual_rows-1 WHERE id=1; END;`,
  ...taskTriggers.map(name=>`DROP TRIGGER ${name};`),
  ...updatedTaskTriggers,
].join('\n');
