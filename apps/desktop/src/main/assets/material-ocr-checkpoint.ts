import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {MATERIAL_PDF_OCR_ENGINE,validMaterialOcrPages,type MaterialOcrPage} from '../../shared/material-pdf-ocr';

const schemaVersion='xiaozhi.material-ocr-checkpoint.v1';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Disposable local derivative. Never publishes partial chunks or teacher facts. */
export function materialOcrCheckpoint(root:string,source:string,worker:string){
 const directory=path.resolve(root),file=path.join(directory,`${source}-${worker}.ocr-checkpoint.json`);
 let enabled=/^[a-f0-9]{64}$/.test(source)&&/^[a-f0-9]{64}$/.test(worker);
 function safeRoot(){if(!enabled)throw new Error('configuration');const stat=fs.lstatSync(directory);if(!stat.isDirectory()||stat.isSymbolicLink()||fs.realpathSync(directory).toLowerCase()!==directory.toLowerCase())throw new Error('configuration');}
 function load():MaterialOcrPage[]{
  try{safeRoot();const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>2*1048576)return [];
   const handle=fs.openSync(file,'r');let bytes:Buffer;
   try{const opened=fs.fstatSync(handle);if(opened.ino!==stat.ino||opened.dev!==stat.dev||opened.size!==stat.size)return [];
    bytes=Buffer.alloc(stat.size+1);const length=fs.readSync(handle,bytes,0,bytes.length,0);if(length!==stat.size)return [];bytes=bytes.subarray(0,length);
   }finally{fs.closeSync(handle);}
   const value=JSON.parse(bytes.toString('utf8'));
   if(Object.keys(value).length!==6||value.schemaVersion!==schemaVersion||value.source!==source||value.worker!==worker||value.engine!==MATERIAL_PDF_OCR_ENGINE||!validMaterialOcrPages(value.pages)||value.sha256!==digest(value.pages))return [];
   return value.pages;
  }catch{return [];}
 }
 function save(pages:MaterialOcrPage[]){
  if(!enabled||!validMaterialOcrPages(pages))return;
  let temporary='';
  try{safeRoot();temporary=file+'.'+randomUUID()+'.tmp';const bytes=JSON.stringify({schemaVersion,source,worker,engine:MATERIAL_PDF_OCR_ENGINE,pages,sha256:digest(pages)});
   const handle=fs.openSync(temporary,'wx',0o600);try{fs.writeFileSync(handle,bytes);fs.fsyncSync(handle);}finally{fs.closeSync(handle);}
   fs.renameSync(temporary,file);
  }catch{enabled=false;}finally{if(temporary)try{fs.unlinkSync(temporary);}catch{/* Atomic rename already consumed it. */}}
 }
 return {load,save};
}
