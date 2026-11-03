import '../office-agent/register-source.mjs';
import {DatabaseSync,backup} from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {MaterialFolderAiRepository} from '../../src/main/assets/material-folder-ai.ts';

// Explicit old test database only. Never migrate the source or upload its contents.
const original=path.resolve(process.argv[2]||'');
assert(process.argv[2]&&fs.statSync(original).isFile(),'Supply an existing old test app.db');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'kb-folder-policy-migration-'));
const fileHash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const originalSha=fileHash(original),source=new DatabaseSync(original,{readOnly:true});
let db;
try{
 assert(!source.prepare('PRAGMA table_info(material_folder_ai)').all().some(c=>c.name==='processing_mode'),'The source must predate this migration');
 const tables=['teacher_resources','resource_chunks','question_bank_items','material_import_batches','material_import_entries','material_folder_ai','material_ai_batches','material_ai_units','material_ai_members','material_ai_task_keys'];
 const columns=Object.fromEntries(tables.map(t=>[t,source.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name)]));
 const facts=handle=>Object.fromEntries(tables.map(t=>{
  const rows=handle.prepare(`SELECT ${columns[t].map(c=>'"'+c+'"').join(',')} FROM ${t} ORDER BY rowid`).all();
  return[t,{rows:rows.length,sha:createHash('sha256').update(JSON.stringify(rows)).digest('hex')}];
 }));
 const before=facts(source);assert(before.material_folder_ai.rows>0,'The old database must contain folder authorizations');
 const copy=path.join(output,'app.db');await backup(source,copy);db=new DatabaseSync(copy);
 const host={all:async(sql,p=[])=>db.prepare(sql).all(...p),run:async(sql,p=[])=>{db.prepare(sql).run(...p);}};
 const repo=new MaterialFolderAiRepository(host);await repo.migrate();await repo.migrate();
 assert.deepEqual(facts(db),before);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM material_folder_ai WHERE processing_mode='legacy'").get().n,before.material_folder_ai.rows);
 db.close();db=undefined;
 const reopened=new DatabaseSync(copy,{readOnly:true});try{assert.deepEqual(facts(reopened),before);}finally{reopened.close();}
 assert.deepEqual(facts(source),before);assert.equal(fileHash(original),originalSha);
 const report={success:true,output,checks:4,sourceSha:originalSha,legacyGrants:before.material_folder_ai.rows,preservedFacts:before,scope:'Actual prior full Electron test database copied by SQLite backup; additive/idempotent migration and cold readback only. No user data or model calls.'};
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{db?.close();source.close();}
