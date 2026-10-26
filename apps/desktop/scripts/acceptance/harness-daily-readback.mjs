// Read only the public configuration fields. Never decrypt/export a credential
// or enumerate conversation text; this is baseline evidence, not acceptance.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {redact} from './harness-evidence.mjs';
const desktop=process.cwd();
if(!fs.existsSync(path.join(desktop,'src/main/xiaozhi-agent/model-settings-state.ts')))throw Error('Run from apps/desktop');
const output=fs.mkdtempSync(path.resolve('test-results/acceptance/harness-daily-'));
const file=path.join(process.env.APPDATA,'OmniEduAgent/OmniEduData/app.db');
const report={schema:'xiaozhi.daily-readback.v1',time:new Date().toISOString(),readOnly:true,dailyAccepted:false,
 boundary:'Default-path SQLite public fields only. An inherited custom data root, in-memory session/model, credential equality and loaded build digest are UNKNOWN; no UI action or API request.',database:file};
try{
 const db=new DatabaseSync(file,{readOnly:true});
 try{
  report.provider=db.prepare("SELECT json_extract(value_json,'$.schema') AS schema, json_extract(value_json,'$.revision') AS revision, json_extract(value_json,'$.defaultModel') AS defaultModel, (json_type(value_json,'$.sealedKey')='text') AS encryptedCredentialPresent FROM app_settings WHERE key='xiaozhi.provider.v1'").get()||{configured:false};
  report.web=db.prepare("SELECT json_extract(value_json,'$.schema') AS schema, json_extract(value_json,'$.revision') AS revision, json_extract(value_json,'$.enabled') AS enabled, json_extract(value_json,'$.dnsMode') AS dnsMode FROM app_settings WHERE key='xiaozhi.web.v1'").get()||{stored:false,codeDefaults:{enabled:true,dnsMode:'auto'}};
  report.savedSessionModels=db.prepare("SELECT json_extract(value_json,'$.model') AS model, count(*) AS sessions FROM app_settings WHERE key LIKE 'xiaozhi.model.%' GROUP BY json_extract(value_json,'$.model')").all();
 }finally{db.close();}
 const processes=spawnSync('powershell.exe',['-NoProfile','-Command',"Get-CimInstance Win32_Process -Filter \"Name = 'electron.exe'\" | Where-Object { $_.CommandLine -like '*apps*desktop*out*main*index.js*' -and $_.CommandLine -notlike '*--type=*' } | Select-Object ProcessId,ParentProcessId,ExecutablePath,CreationDate | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true});
 report.dailyProcess=processes.status===0&&processes.stdout.trim()?JSON.parse(processes.stdout):null;
 report.success=true;
}catch(error){report.success=false;report.error=redact(error.message);process.exitCode=1;}
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({success:report.success,output,provider:report.provider,web:report.web,savedSessionModels:report.savedSessionModels}));
