import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
const root=process.argv[2];assert(root&&path.dirname(root).toLowerCase()===process.env.TEMP.toLowerCase()&&path.basename(root).startsWith('xiaozhi-buoyancy-demo-ui-'));
const original=JSON.parse(fs.readFileSync(path.join(root,'report.json')));assert(original.ok);const files=original.files.filter(f=>f.name.endsWith('.html'));assert.equal(files.length,2);
const helper=path.join(root,'offline-helper-v4.cjs');assert(!fs.existsSync(helper));
fs.writeFileSync(helper,`const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path');app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{const root=${JSON.stringify(root)},files=${JSON.stringify(files)},report={ok:false,files:[],network:[],errors:[]};
 try{const ses=session.fromPartition('offline-buoyancy-'+Date.now());ses.webRequest.onBeforeRequest((d,done)=>{if(/^https?:/.test(d.url)){report.network.push(d.url);done({cancel:true});}else done({});});
 for(const f of files){const win=new BrowserWindow({show:true,width:1366,height:768,useContentSize:true,webPreferences:{session:ses,sandbox:true,contextIsolation:true,nodeIntegration:false}});const start=performance.now();await win.loadFile(f.file);const facts=await win.webContents.executeJavaScript('('+(()=>({url:location.protocol,volume:document.getElementById('volume').textContent,buoyancy:document.getElementById('buoyancy').textContent,immersed:document.getElementById('immersed').textContent,teacherHidden:document.getElementById('teacher-answer').hidden,width:innerWidth,scroll:document.documentElement.scrollWidth})).toString()+')()');report.files.push({...f,facts,loadMs:performance.now()-start,visual:'Standalone native capture unavailable: UnknownVizError; formal preview screenshots and interactive checks are recorded separately.'});win.destroy();}
 if(report.network.length||report.files.some(f=>f.facts.url!=='file:'||f.facts.volume!=='0.001 m³'||f.facts.buoyancy!=='6 N'||!f.facts.teacherHidden||f.facts.scroll>f.facts.width+1)||report.files[0].facts.immersed!=='6 cm'||report.files[1].facts.immersed!=='7.5 cm')throw Error('Offline readback failed');report.ok=true;
 }catch(e){report.error=String(e.stack);}finally{fs.writeFileSync(path.join(root,'offline-readback-v4.json'),JSON.stringify(report,null,2));app.exit(report.ok?0:1);}
});`);
const env={...process.env};for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
execFileSync(path.resolve('node_modules/electron/dist/electron.exe'),[helper,'--user-data-dir='+path.join(root,'offline-profile')],{env,windowsHide:true,timeout:60000,stdio:'pipe'});
const report=JSON.parse(fs.readFileSync(path.join(root,'offline-readback-v4.json')));assert(report.ok);console.log(JSON.stringify({ok:true,files:report.files.length,network:report.network.length,root}));
