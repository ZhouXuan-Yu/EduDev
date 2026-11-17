import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createManagedWorkerQueue} from '../managed-tools/worker-queue';
import {reserveLocalWorker} from '../xiaozhi-agent/local-utility-host';
import {runWordOfficeProcess} from './word-office-component';
import {ensureWordOffice} from './word-drawing-runtime';
import {readWordPackage} from './word-package';
import {WORD_PAGES_SCHEMA} from '../../shared/material-word-pages';
import {WORD_INPUT} from '../../shared/material-word';
import {PDF_FILE_MAX_BYTES} from '../../shared/material-pdf-file';
import {MATERIAL_PDF_MAX_PAGES} from '../../shared/material-page-preview';
import type {WordPdfRender} from './material-word-pages';

const queue=createManagedWorkerQueue(1,32);
export const renderWordPdf:WordPdfRender=(bytes,job,signal)=>queue.run(async owned=>{
 if(!bytes.length||bytes.length>WORD_INPUT)throw Error('too_large');
 await readWordPackage(bytes);owned.throwIfAborted();
 const program=await ensureWordOffice(owned),release=reserveLocalWorker();if(!release)throw Error('busy');
 try{
  const sourceSha256=createHash('sha256').update(bytes).digest('hex');
  const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','LANG'].flatMap(key=>process.env[key]?[[key,process.env[key]]]:[]));
  Object.assign(env,{PYTHONDONTWRITEBYTECODE:'1',XIAOZHI_OFFICE_PROGRAM:program});
  const worker=fileURLToPath(new URL('./word-pdf-worker.py',import.meta.url));
  const stdout=await runWordOfficeProcess(path.join(program,'python.exe'),['-B',worker],{cwd:job,env,signal:owned,timeout:300000,stdoutLimit:4096,
   input:JSON.stringify({schemaVersion:WORD_PAGES_SCHEMA,parentPid:process.pid,sourceSha256,data:bytes.toString('base64'),jobRoot:job,maxPdfBytes:PDF_FILE_MAX_BYTES,maxPages:MATERIAL_PDF_MAX_PAGES})+'\n'});
  const result=JSON.parse(stdout);
  if(!result||Object.keys(result).sort().join(',')!=='bytes,pages,schemaVersion,sha256,sourceSha256'||result.schemaVersion!==WORD_PAGES_SCHEMA||result.sourceSha256!==sourceSha256||
   typeof result.sha256!=='string'||!/^[a-f0-9]{64}$/.test(result.sha256)||!Number.isSafeInteger(result.bytes)||result.bytes<1||result.bytes>PDF_FILE_MAX_BYTES||
   !Number.isSafeInteger(result.pages)||result.pages<1||result.pages>MATERIAL_PDF_MAX_PAGES)throw Error('parse_failed');
  return{sha256:result.sha256,bytes:result.bytes,pages:result.pages};
 }finally{release();}
},signal);
