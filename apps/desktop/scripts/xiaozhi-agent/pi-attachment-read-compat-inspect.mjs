import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
const base=fs.realpathSync('test-results/xiaozhi-agent');
const source=fs.realpathSync(process.argv[2]),target=fs.realpathSync(process.argv[3]);
for(const root of [source,target])assert(root.startsWith(base+path.sep)&&path.basename(root)==='data');
const rows=root=>{const db=new DatabaseSync(path.join(root,'app.db'),{readOnly:true});try{return db.prepare('SELECT conversation_id,session_file,schema_version,model FROM xiaozhi_pi_session_bindings').all();}finally{db.close();}};
const before=rows(source),after=rows(target);assert(before.length>0);
let prefixes=0;
for(const original of before){const current=after.find(v=>v.conversation_id===original.conversation_id);assert(current);
 for(const key of ['session_file','schema_version','model'])assert.equal(current[key],original[key]);
 const oldBytes=fs.readFileSync(path.join(source,'xiaozhi-pi',original.session_file)),newBytes=fs.readFileSync(path.join(target,'xiaozhi-pi',current.session_file));
 assert(newBytes.subarray(0,oldBytes.length).equals(oldBytes),'Original old-version native bytes must remain an exact prefix');prefixes++;
}
console.log(JSON.stringify({ok:true,readOnly:true,originalNativePrefixes:prefixes,originalIdentitiesUnchanged:true}));
