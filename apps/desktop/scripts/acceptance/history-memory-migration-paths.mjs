// Supply closed synthetic fixture databases produced by the actual v5, v6 and v7 builds.
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sqlite3 from 'sqlite3';
import {DatabaseSync} from 'node:sqlite';
const {databaseUserVersion,migrateDatabase} = await import('../../src/main/database-migrations.ts');
const {closeSqlite,openSqlite,setSqliteJournalMode} = await import('../../src/main/sqlite-connections.ts');

const inputs = process.argv.slice(2);
assert.ok(inputs.length >= 3,'Expected v5, v6 and v7; optional arguments are published v8 fixtures');
const versions = [5,6,7];
const root = await mkdtemp(join(tmpdir(),'edudev-history-paths-'));
const ledger = db => db.prepare('SELECT * FROM xiaozhi_schema_migrations ORDER BY to_version').all();
const students = db => db.prepare('SELECT id, display_name FROM students ORDER BY id').all();
const tableNames = db => db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(row=>row.name);
async function upgrade(file) {
  const db = new sqlite3.Database(file);
  let backups = 0;
  try {
    const result = await migrateDatabase(db,{
      bootstrap:assert.fail, appBuild:()=>'history-r1-integration-test',
      recoveryPoint:async()=>{await copyFile(file, file+'.before'); backups++;},
      enableJournal:()=>new Promise((resolve,reject)=>db.exec('PRAGMA journal_mode=WAL;',error=>error?reject(error):resolve())),
    });
    return {result,backups};
  } finally { await new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve())); }
}
for (const [index,source] of inputs.entries()) {
  const version = versions[index] ?? 8;
  const file = join(root,'fixture-'+index+'.db');
  const original = new DatabaseSync(source,{readOnly:true});
  // VACUUM INTO creates a consistent local copy, including committed WAL rows.
  original.prepare('VACUUM INTO ?').run(file);
  original.close();
  let db = new DatabaseSync(file,{readOnly:true});
  const prefix = ledger(db), beforeStudents = students(db), names = tableNames(db);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,version);
  db.close();
  assert.deepEqual(await upgrade(file),{result:9,backups:1});
  assert.deepEqual(await upgrade(file),{result:9,backups:0});
  db = new DatabaseSync(file,{readOnly:true});
  const after = ledger(db), tables = tableNames(db);
  assert.deepEqual(after.slice(0,prefix.length),prefix);
  assert.equal(after.length,9);
  const personalFirst = prefix[7]?.migration_id === 'r2.personal_memory.v8';
  const historyFirstConfig = index===0 || prefix[7]?.migration_id === 'r3.ordinary_config_history.after_history.v8';
  assert.equal(after[7].migration_id,personalFirst?'r2.personal_memory.v8':historyFirstConfig?'r3.ordinary_config_history.after_history.v8':'r1.history_memory_access_and_index.after_r3_config.v8');
  assert.equal(after[8].migration_id,personalFirst?'r3.ordinary_config_history.after_personal.v9':historyFirstConfig?'r2.personal_memory.after_config.v9':'r2.personal_memory.after_r3_config.v9');
  assert.ok(after.some(entry=>entry.migration_id.startsWith('r1.history_memory_access_and_index')));
  assert.ok(after.some(entry=>entry.migration_id.startsWith('r3.ordinary_config_history')));
  assert.ok(tables.includes('personal_memory_processing'));
  assert.ok(tables.includes('memory_source_access'));
  assert.ok(names.every(name=>tables.includes(name)));
  assert.deepEqual(students(db),beforeStudents);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
  db.close();
  db = new DatabaseSync(file);
  db.exec("UPDATE xiaozhi_schema_migrations SET checksum=lower(hex(randomblob(32))) WHERE to_version=5");
  db.close();
  await assert.rejects(upgrade(file),error=>error.issue==='invalid_ledger');
  console.log(JSON.stringify({from:version,to:9,preservedRows:prefix.length,studentRows:beforeStudents.length,
    restart:true,rejectedTamperedLedger:true}));
}

async function checkLegacyJournalWrite(when) {
  const file = join(root,when+'.db');
  const recovered = file+'.before';
  const copy = (from,to) => {
    const reader = new DatabaseSync(from,{readOnly:true});
    try { reader.prepare('VACUUM INTO ?').run(to); }
    finally { reader.close(); }
  };
  copy(inputs[1],file);
  const db = await openSqlite(file,'primary');
  const key = 'db-audit-late-save';
  let writeVersion;
  const writeFromAnotherConnection = () => {
    const writer = new DatabaseSync(file);
    try {
      writeVersion = writer.prepare('PRAGMA user_version').get().user_version;
      writer.prepare('INSERT INTO app_settings (key,value_json,updated_at) VALUES (?,?,?)')
        .run(key,'{}',new Date().toISOString());
    } finally { writer.close(); }
  };
  try {
    await setSqliteJournalMode(db,'delete');
    const upgraded = migrateDatabase(db,{
      bootstrap:assert.fail,
      recoveryPoint:async()=>copy(file,recovered),
      enableJournal:async()=>{
        if (when==='journal-transition') writeFromAnotherConnection();
        await setSqliteJournalMode(db,'wal');
      },
      appBuild:()=>{
        if (when==='before-first-migration') writeFromAnotherConnection();
        return 'foundation-journal-concurrency';
      },
    });
    if (when==='before-first-migration') {
      await assert.rejects(upgraded,error=>error.issue==='changed_during_upgrade');
      assert.equal(writeVersion,6);
      assert.equal(await databaseUserVersion(db),6);
    } else {
      assert.equal(await upgraded,9);
      assert.equal(writeVersion,9,'Changing journal mode must not conceal an intervening write at an old schema version');
    }
  } finally { await closeSqlite(db); }
  const legacy = new DatabaseSync(recovered,{readOnly:true});
  const updated = new DatabaseSync(file,{readOnly:true});
  try {
    assert.equal(legacy.prepare('PRAGMA user_version').get().user_version,6);
    assert.deepEqual(ledger(updated).slice(0,6),ledger(legacy));
    assert.equal(legacy.prepare('SELECT value_json FROM app_settings WHERE key=?').get(key),undefined);
    assert.equal(updated.prepare('SELECT value_json FROM app_settings WHERE key=?').get(key).value_json,'{}');
  } finally { legacy.close(); updated.close(); }
  console.log(JSON.stringify({scenario:when,writeVersion,legacyRecoveryUnchanged:true}));
}
await checkLegacyJournalWrite('journal-transition');
await checkLegacyJournalWrite('before-first-migration');
