// Supply closed synthetic fixture databases produced by the actual v5, v6 and v7 builds.
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sqlite3 from 'sqlite3';
import {DatabaseSync} from 'node:sqlite';
const {migrateDatabase} = await import('../../src/main/database-migrations.ts');

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
  const personalFirst = after[7].migration_id === 'r2.personal_memory.v8';
  assert.equal(after[8].migration_id,personalFirst?'r3.ordinary_config_history.after_personal.v9':'r2.personal_memory.after_r3_config.v9');
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
