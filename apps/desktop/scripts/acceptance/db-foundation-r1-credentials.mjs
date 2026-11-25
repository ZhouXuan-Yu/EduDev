import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {productEntry} from '../product-navigation.mjs';

const desktop=resolve(import.meta.dirname,'../..');
const main=testMain(desktop);
const baseline=resolve(process.env.OMNI_EDU_DB_V0_BUILD||join(desktop,'test-results/xiaozhi-db-r1-baseline/out/main/index.js'));
const acceptance=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(desktop,'test-results'));
mkdirSync(join(acceptance,'fixtures'),{recursive:true});
const root=mkdtempSync(join(acceptance,'fixtures','FX-04-credential-'));
const report={ok:false,platform:process.platform,mainSha256:createHash('sha256').update(readFileSync(main)).digest('hex'),checks:[]};
assert.equal(process.platform,'win32');
const sentinel={
  deepseek:'r1-test-only-legacy-D84',
  glm:'r1-test-only-legacy-G84',
  current:'r1-test-only-current-C84',
  concurrent:'r1-test-only-concurrent-P84',
};
const key='xiaozhi.provider.v1';
const config=blob=>({schema:1,revision:4,defaultModel:'deepseek-pro',sealedKey:blob});
const dbPath=fixture=>join(fixture.data,'app.db');
const evidence=(name,detail={})=>{report.checks.push({name,...detail});console.log('PASS '+name);};

function envFor(fixture) {
  const env={...process.env,OMNI_EDU_DATA_ROOT:fixture.data,
    OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'',GLM_API_KEY:''};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL']) delete env[key];
  return env;
}
function withDb(fixture,write,action) {
  const db=new DatabaseSync(dbPath(fixture),{readOnly:!write});
  try{return action(db);}finally{db.close();}
}
function setting(fixture,name) {
  return withDb(fixture,false,db=>{
    const row=db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(name);
    return row?JSON.parse(row.value_json):undefined;
  });
}
function seed(fixture, entries) {
  withDb(fixture,true,db=>{
    const put=db.prepare('INSERT OR REPLACE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)');
    for(const [name,data]of entries) put.run(name,JSON.stringify(data),'2026-11-24T00:00:00.000Z');
  });
}
function bootstrap(fixture,behavior) {
  const script=join(fixture.root,'bootstrap-'+behavior+'.cjs');
  writeFileSync(script,`
    const {app, safeStorage,net}=require('electron');
    const requireDesktop=require('node:module').createRequire(${JSON.stringify(join(desktop,'package.json'))});
    globalThis.r1CredentialProbe={wire:0};
    net.fetch=globalThis.fetch=async()=>{globalThis.r1CredentialProbe.wire++;throw Error('r1_wire_blocked');};
    const mode=${JSON.stringify(behavior)};
    if(mode==='unavailable')safeStorage.isEncryptionAvailable=()=>false;
    if(mode==='conflict'){
      const decrypt=safeStorage.decryptString.bind(safeStorage);
      let injected=false;
      safeStorage.decryptString=sealed=>{
        const plain=decrypt(sealed);
        if(!injected&&plain===${JSON.stringify(sentinel.deepseek)}){
          injected=true;
          const {DatabaseSync}=require('node:sqlite');
          const db=new DatabaseSync(${JSON.stringify(dbPath(fixture))});
          try {db.prepare("UPDATE app_settings SET value_json=? WHERE key='deepseek'").run(${JSON.stringify(JSON.stringify({apiKey:sentinel.concurrent,model:'deepseek-pro'}))});}
          finally {db.close();}
        }
        return plain;
      };
    }
    if(mode==='cut'){
      const proto=requireDesktop('sqlite3').Database.prototype;
      const original=proto.run;
      proto.run=function(statement,params,callback){
        if(statement.startsWith('UPDATE app_settings SET value_json=? WHERE key=? AND value_json=?') && Array.isArray(params) && params[1]==='deepseek'){
          return original.call(this,statement,params,function(error){
            if(error)callback.call(this,error);
            else app.exit(32);
          });
        }
        return original.apply(this,arguments);
      };
    }
    import(${JSON.stringify(pathToFileURL(main).href)});
  `);
  return script;
}
async function launch(fixture,entry,action) {
  const app=await electron.launch({args:[entry,'--user-data-dir='+fixture.profile],cwd:desktop,env:envFor(fixture),timeout:60000});
  try {
    const page=await app.firstWindow({timeout:45000});
    await page.waitForFunction(()=>Boolean(window.omniEdu));
    if(entry!==baseline)await assertIsolatedPiMain(app,main,fixture.profile);
    return await action(app,page);
  }finally{await app.close();}
}
async function createCase(name,old=true) {
  const folder=join(root,name),fixture={root:folder,data:join(folder,'data'),profile:join(folder,'profile')};
  mkdirSync(fixture.profile,{recursive:true});
  const sealed=await launch(fixture,old?baseline:bootstrap(fixture,'ready'),app=>
    app.evaluate(({safeStorage},plain)=>{
      if(!safeStorage.isEncryptionAvailable()) throw Error('Windows safeStorage unavailable');
      const sealed=safeStorage.encryptString(plain);
      if(safeStorage.decryptString(sealed)!==plain) throw Error('SafeStorage round-trip failed');
      return sealed.toString('base64');
    },sentinel.current));
  return {fixture,sealed};
}
const fingerprint= value=>JSON.stringify(value);
async function view(app,page) {
  assert.equal(await app.evaluate(()=>globalThis.r1CredentialProbe.wire),0,'Migration must not validate keys with a provider');
  const result=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings());
  assert(result.ok,'Credential states must be viewable');
  const projection=fingerprint(result.value);
  for(const value of Object.values(sentinel))assert(!projection.includes(value),'IPC leaked a plaintext credential');
  return result.value;
}
async function verifiesSeal(app,raw,expected) {
  assert.equal(await app.evaluate(({safeStorage},[sealed,expected])=>
    safeStorage.decryptString(Buffer.from(sealed,'base64'))===expected,[raw,expected]),true);
}
async function interrupted(fixture) {
  const runtime=resolve(desktop,'node_modules/electron/dist/electron.exe');
  return new Promise((resolve,reject)=>{
    const proc=spawn(runtime,[bootstrap(fixture,'cut'),'--user-data-dir='+fixture.profile],
      {cwd:desktop,env:envFor(fixture),windowsHide:true,stdio:'ignore'});
    const deadline=setTimeout(()=>{proc.kill();reject(Error('Credential transaction cut did not settle'));},40000);
    proc.once('error',e=>{clearTimeout(deadline);reject(e);});
    proc.once('close',code=>{clearTimeout(deadline);resolve(code);});
  });
}
let stage='old values and existing sealed priority';
try{
  const {fixture:only}=await createCase('old-only');
  seed(only,[['deepseek',{model:'deepseek-pro',apiKey:sentinel.deepseek,note:'kept'}],
    ['glm',{model:'glm-4',apiKey:sentinel.glm}]]);
  await launch(only,bootstrap(only,'ready'),async(app,page)=>{
    const settings=await view(app,page);
    assert.deepEqual(settings.legacyCredentialMigration,{deepseek:'migrated',glm:'migrated'});
    assert.equal(settings.defaultModel,'deepseek-pro');
    const deep=setting(only,'deepseek'),glm=setting(only,'glm');
    assert.deepEqual([Object.hasOwn(deep,'apiKey'),Object.hasOwn(glm,'apiKey'),deep.note],[false,false,'kept']);
    await verifiesSeal(app,deep.sealedKey,sentinel.deepseek);
    await verifiesSeal(app,glm.sealedKey,sentinel.glm);
    const exposed=JSON.stringify(settings);
    assert(!exposed.includes(deep.sealedKey)&&!exposed.includes(glm.sealedKey));
  });
  const persisted=setting(only,'deepseek');
  await launch(only,bootstrap(only,'ready'),async(app,page)=>{
    assert.equal((await view(app,page)).legacyCredentialMigration.deepseek,'not_needed');
    assert.deepEqual(setting(only,'deepseek'),persisted);
    await verifiesSeal(app,persisted.sealedKey,sentinel.deepseek);
  });
  evidence('Legacy DeepSeek and GLM Logical fields migrate with real Windows safeStorage, survive cold boot and do not change model preferences.');

  const {fixture:both,sealed}=await createCase('sealed-and-old');
  seed(both,[[key,config(sealed)],['deepseek',{model:'old-catalogue-model',apiKey:sentinel.deepseek}]]);
  await launch(both,bootstrap(both,'ready'),async(app,page)=>{
    const settings=await view(app,page);
    assert.equal(settings.defaultModel,'deepseek-pro');
    assert.equal(settings.maskedApiKey.endsWith(sentinel.current.slice(-4)),true);
    assert.deepEqual(setting(both,key),config(sealed));
    assert(!Object.hasOwn(setting(both,'deepseek'),'apiKey'));
    await verifiesSeal(app,setting(both,'deepseek').sealedKey,sentinel.deepseek);
    assert(!JSON.stringify(settings).includes(sealed));
  });
  evidence('Existing valid provider ciphertext and model win unchanged while older compatible local consumers keep their separately sealed value.');

  stage='safeStorage unavailable and recovery';
  const {fixture:unsupported}=await createCase('storage-unavailable',false);
  const old={model:'deepseek-flash',apiKey:sentinel.deepseek};
  seed(unsupported,[['deepseek',old]]);
  await launch(unsupported,bootstrap(unsupported,'unavailable'),async(app,page)=>{
    assert.equal((await view(app,page)).legacyCredentialMigration.deepseek,'storage_unavailable');
    assert.deepEqual(setting(unsupported,'deepseek'),old);
    await productEntry(page,'settings').click();
    await page.getByTestId('pi-settings-credential-migration-pending').waitFor();
  });
  await launch(unsupported,bootstrap(unsupported,'ready'),async(app,page)=>{
    assert.equal((await view(app,page)).legacyCredentialMigration.deepseek,'migrated');
    await verifiesSeal(app,setting(unsupported,'deepseek').sealedKey,sentinel.deepseek);
  });
  evidence('Inaccessible platform storage preserves plaintext and shows pending status until native storage returns.');

  stage='unreadable ciphertext and no downgrade';
  const {fixture:broken,sealed:replacement}=await createCase('bad-seal',false);
  seed(broken,[[key,config('r1-invalid-sealed-blob')],['deepseek',old]]);
  await launch(broken,bootstrap(broken,'ready'),async(app,page)=>{
    const settings=await view(app,page);
    assert.equal(settings.credentialError,'configuration');
    assert.equal(settings.configured,false);
    assert.deepEqual(setting(broken,'deepseek'),old);
    assert(!JSON.stringify(settings).includes('r1-invalid-sealed-blob'));
  });
  seed(broken,[[key,config(replacement)]]);
  await launch(broken,bootstrap(broken,'ready'),async(app,page)=>{
    assert.equal((await view(app,page)).legacyCredentialMigration.deepseek,'migrated');
    assert(!Object.hasOwn(setting(broken,'deepseek'),'apiKey'));
  });
  evidence('Unreadable newer ciphertext forbids legacy fallback and preserves the only recoverable value.');

  stage='concurrent write between Windows encryption and SQL CAS';
  const {fixture:competing}=await createCase('conflict',false);
  seed(competing,[['deepseek',old]]);
  await launch(competing,bootstrap(competing,'conflict'),async(app,page)=>{
    assert.equal((await view(app,page)).legacyCredentialMigration.deepseek,'conflict');
    assert.equal(setting(competing,'deepseek').apiKey===sentinel.concurrent,true);
  });
  await launch(competing,bootstrap(competing,'ready'),async app=>{
    await verifiesSeal(app,setting(competing,'deepseek').sealedKey,sentinel.concurrent);
  });
  evidence('CAS detects and preserves a genuine competing database write, then a cold retry seals the winning value.');

  stage='process cut at secret row update before commit';
  const {fixture:atomic}=await createCase('ipc-cut',false);
  seed(atomic,[['deepseek',old]]);
  assert.equal(await interrupted(atomic),32);
  assert.deepEqual(setting(atomic,'deepseek'),old);
  await launch(atomic,bootstrap(atomic,'ready'),async(app,page)=>{
    assert.equal((await view(app,page)).legacyCredentialMigration.deepseek,'migrated');
    const migrated=setting(atomic,'deepseek');
    assert(!Object.hasOwn(migrated,'apiKey'));
    await verifiesSeal(app,migrated.sealedKey,sentinel.deepseek);
  });
  evidence('Process termination after SQLite UPDATE and before COMMIT retains the pre-migration record. Cold re-entry seals and cleans atomically.');
  report.ok=true;
}catch(error){
  report.failedStage=stage;
  // Reports reference fixture assertions, not credential values.
  report.errorType=error?.name;
  console.error('Credential fixture failed at: '+stage+' ('+error?.name+')');
  if(error.stack)console.error(error.stack.split('\n').filter(line=>line.trim().startsWith('at ')).join('\n'));
  process.exitCode=1;
}finally{
  writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,stage,checks:report.checks.length,fixture:root.split(/[\\/]/u).at(-1)}));
}
