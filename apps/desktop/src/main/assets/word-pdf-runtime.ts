import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {app} from 'electron';
import {createManagedWorkerQueue} from '../managed-tools/worker-queue';
import {reserveLocalWorker} from '../xiaozhi-agent/local-utility-host';
import {runWordOfficeProcess} from './word-office-component';
import {ensureWordOffice} from './word-drawing-runtime';
import {readWordPackage} from './word-package';
import {WORD_PDF_EXPORT_SCHEMA} from '../../shared/material-word-pages';
import {renderPdfFilePage} from '../xiaozhi-agent/pdf-file-host';
import {WORD_INPUT} from '../../shared/material-word';
import {PDF_FILE_MAX_BYTES} from '../../shared/material-pdf-file';
import {MATERIAL_PDF_MAX_PAGES} from '../../shared/material-page-preview';
import type {WordPdfRender} from './material-word-pages';

const queue=createManagedWorkerQueue(1,32);
export const renderWordPdf:WordPdfRender=(bytes,job,signal)=>queue.run(async owned=>{
 if(!bytes.length||bytes.length>WORD_INPUT)throw Error('too_large');
 await readWordPackage(bytes);owned.throwIfAborted();
 const temporaryRoot=path.resolve(app.getPath('temp'));
 const program=await ensureWordOffice(owned),release=reserveLocalWorker();if(!release)throw Error('busy');
 let profile:string|undefined;
 try{
  // LibreOffice cannot reliably initialize its profile under a long archive path.
  // Only its disposable profile moves; source/output remain in the durable job.
  profile=await fs.mkdtemp(path.join(temporaryRoot,'xiaozhi-word-pdf-'));
  if((await fs.lstat(profile)).isSymbolicLink()||(await fs.realpath(profile)).toLowerCase()!==profile.toLowerCase())throw Error('configuration');
  const sourceSha256=createHash('sha256').update(bytes).digest('hex');
  const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','LANG'].flatMap(key=>process.env[key]?[[key,process.env[key]]]:[]));
  Object.assign(env,{PYTHONDONTWRITEBYTECODE:'1',XIAOZHI_OFFICE_PROGRAM:program,XIAOZHI_OFFICE_PROFILE:profile});
  const worker=fileURLToPath(new URL('./word-pdf-worker.py',import.meta.url));
  const stdout=await runWordOfficeProcess(path.join(program,'python.exe'),['-B',worker],{cwd:job,env,signal:owned,timeout:300000,stdoutLimit:4096,
   input:JSON.stringify({schemaVersion:WORD_PDF_EXPORT_SCHEMA,parentPid:process.pid,sourceSha256,data:bytes.toString('base64'),jobRoot:job,maxPdfBytes:PDF_FILE_MAX_BYTES,maxPages:MATERIAL_PDF_MAX_PAGES})+'\n'});
  const result=JSON.parse(stdout);
  if(!result||Object.keys(result).sort().join(',')!=='bytes,schemaVersion,sha256,sourceSha256'||result.schemaVersion!==WORD_PDF_EXPORT_SCHEMA||result.sourceSha256!==sourceSha256||
   typeof result.sha256!=='string'||!/^[a-f0-9]{64}$/.test(result.sha256)||!Number.isSafeInteger(result.bytes)||result.bytes<1||result.bytes>PDF_FILE_MAX_BYTES)throw Error('parse_failed');
  const preview=await renderPdfFilePage({localPath:path.join(job,'rendered.pdf'),contentHash:result.sha256},{page:1,box:[0,0,1,1]},owned);
  if(!preview.ok||preview.total>MATERIAL_PDF_MAX_PAGES)throw Error('parse_failed');
  return{sha256:result.sha256,bytes:result.bytes,pages:preview.total};
 }finally{
  release();
  if(profile){
   const resolved=path.resolve(profile);
   if(path.dirname(resolved)!==temporaryRoot||!path.basename(resolved).startsWith('xiaozhi-word-pdf-'))throw Error('configuration');
   await fs.rm(resolved,{recursive:true,force:true});
  }
 }
},signal);
