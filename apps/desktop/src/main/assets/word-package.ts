import yauzl from 'yauzl';
import path from 'node:path';
import {crc32} from 'node:zlib';
/** Read declared and actual ZIP bytes under the same cap. No extraction to supplied paths. */
export async function readWordPackage(bytes:Uint8Array){
 const zip=await new Promise<yauzl.ZipFile>((resolve,reject)=>yauzl.fromBuffer(Buffer.from(bytes),{lazyEntries:true,autoClose:false,validateEntrySizes:true,strictFileNames:true},(error,value)=>error?reject(error):resolve(value!)));
 const parts=new Map<string,Buffer>();let total=0,xml=0,count=0,declared=0;
 try{
  await new Promise<void>((resolve,reject)=>{
   let settled=false;const fail=(error:unknown)=>{if(settled)return;settled=true;zip.close();reject(error);};
   zip.on('error',fail);zip.on('end',()=>{if(!settled){settled=true;resolve();}});
   zip.on('entry',(entry:yauzl.Entry)=>{void (async()=>{
    const name=entry.fileName;
    if(++count>5000||!Number.isSafeInteger(entry.uncompressedSize)||entry.uncompressedSize<0||(declared+=entry.uncompressedSize)>128*1024*1024)throw Error('too_large');
    if(name.includes('\\')||name.startsWith('/')||name.split('/').some(p=>p==='..'||p==='.')||parts.has(name)||entry.isEncrypted())throw Error('parse_failed');
    if(name.endsWith('/')){zip.readEntry();return;}
    // Unknown payloads/macros are never executed or inflated. Size budgets include them.
    const relevant=name.endsWith('.xml')||name.endsWith('.rels')||/\/media\//.test(name);
    if(!relevant){zip.readEntry();return;}
    const isXml=name.endsWith('.xml')||name.endsWith('.rels'),cap=8*1024*1024;
    if(entry.uncompressedSize>cap)throw Error('too_large');
    const stream=await new Promise<NodeJS.ReadableStream>((yes,no)=>zip.openReadStream(entry,(error,value)=>error?no(error):yes(value!)));
    const chunks:Buffer[]=[];let size=0,crc=0;
    for await(const raw of stream as AsyncIterable<Buffer>){const b=Buffer.from(raw);size+=b.length;total+=b.length;if(size>cap||total>128*1024*1024||(isXml&&(xml+=b.length)>24*1024*1024)){(stream as {destroy?:()=>void}).destroy?.();throw Error('too_large');}crc=crc32(b,crc);chunks.push(b);}
    if(size!==entry.uncompressedSize||crc!==entry.crc32)throw Error('parse_failed');parts.set(name,Buffer.concat(chunks));zip.readEntry();
   })().catch(fail);});zip.readEntry();
  });
 }finally{zip.close();}
 return parts;
}
export function wordTarget(part:string,target:string){
 if(!target||/[\\\x00-\x20?#]/.test(target)||/^[a-z][a-z0-9+.-]*:/i.test(target))throw Error('parse_failed');
 let decoded:string;try{decoded=decodeURIComponent(target);}catch{throw Error('parse_failed');}if(/[\\\x00-\x1f]/.test(decoded)||/%(?:2f|5c)/i.test(target))throw Error('parse_failed');
 const clean=decoded.startsWith('/')?decoded.slice(1):path.posix.join(path.posix.dirname(part),decoded);
 const result=path.posix.normalize(clean);if(result.startsWith('../')||result==='..'||result.startsWith('/'))throw Error('parse_failed');return result;
}
