import '../office-agent/register-source.mjs';
import {DatabaseSync,backup} from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {MaterialFolderAiRepository} from '../../src/main/assets/material-folder-ai.ts';
assert(process.argv[2],'Supply a closed, owned older test app.db');
const original=path.resolve(process.argv[2]),output=fs.mkdtempSync(path.join(os.tmpdir(),'kb-local-recovery-migration-'));
const hash=value=>createHash('sha256').update(value).digest('hex'),beforeFile=hash(fs.readFileSync(original));
const source=new DatabaseSync(original,{readOnly:true});let copy;
const report={output,source:original,checks:[],scope:'Index-only migration on a backup of a closed synthetic test database; no original files restored, no relocation/runtime acceptance'};
const tables=db=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name);
const facts=db=>Object.fromEntries(tables(db).map(table=>{const rows=db.prepare('SELECT * FROM "'+table.replaceAll('"','""')+'"').all().map(row=>JSON.stringify(row)).sort();return[table,{rows:rows.length,sha256:hash(JSON.stringify(rows))}];}));
try{
 assert.equal(source.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='idx_folder_ai_local_parse_retry'").get().n,0);assert(source.prepare('SELECT COUNT(*) n FROM material_folder_ai').get().n>0);report.checks.push('The older source has real persisted folder authorizations and no new retry index');
 const before=facts(source),file=path.join(output,'app.db');await backup(source,file);copy=new DatabaseSync(file);
 const host={all:async(q,p=[])=>copy.prepare(q).all(...p),run:async(q,p=[])=>{copy.prepare(q).run(...p);}};
 const repo=new MaterialFolderAiRepository(host);await repo.migrate();await repo.migrate();assert.deepEqual(facts(copy),before);report.checks.push('Two production migrations preserve all existing table rows and hashes');
 assert.equal(copy.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='idx_folder_ai_local_parse_retry'").get().n,1);report.checks.push('Only one idempotent partial retry index is present');
 assert.equal(source.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='idx_folder_ai_local_parse_retry'").get().n,0);report.checks.push('The original source schema remains untouched');
 assert.equal(hash(fs.readFileSync(original)),beforeFile);report.checks.push('Original test database file SHA256 remains exact');report.facts=before;report.success=true;
}catch(error){report.success=false;report.error=error.stack;process.exitCode=1;}
finally{copy?.close();source.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,error:report.error}));}
