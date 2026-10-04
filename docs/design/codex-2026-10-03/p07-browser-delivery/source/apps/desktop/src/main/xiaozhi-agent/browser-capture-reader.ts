import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {approvedFile} from './workspace-authority';import {fileVersion} from './workspace-files';
import {validBrowserCapture,type BrowserCapture} from '../../shared/xiaozhi-browser-capture';
/** Reuse the existing approved-file/fd-version boundary; paths never come from renderer. */
export async function readBrowserCapture(root:string,sessionId:string,capture:BrowserCapture):Promise<string>{
 if(!/^aisession_[a-f0-9-]{36}$/i.test(sessionId)||!validBrowserCapture(capture))throw new Error('invalid_input');
 const directory=path.join(root,createHash('sha256').update(sessionId).digest('hex'));
 if(fs.lstatSync(root).isSymbolicLink())throw new Error('permission_denied');
 const file=approvedFile(root,path.relative(root,path.join(directory,capture.id)));
 const initial=fs.lstatSync(file);if(!initial.isFile()||initial.isSymbolicLink()||initial.nlink!==1)throw new Error('permission_denied');
 if(initial.size>4*1048576)throw new Error('too_large');if(initial.size!==capture.size)throw new Error('changed');
 const version=fileVersion(initial),fd=await fs.promises.open(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  if(fileVersion(await fd.stat())!==version)throw new Error('changed');
  const bytes=Buffer.alloc(capture.size);let offset=0;while(offset<bytes.length){const result=await fd.read(bytes,offset,bytes.length-offset,offset);if(!result.bytesRead)throw new Error('changed');offset+=result.bytesRead;}
  if(fileVersion(await fd.stat())!==version||fileVersion(fs.lstatSync(approvedFile(root,path.relative(root,file))))!==version||createHash('sha256').update(bytes).digest('hex')!==capture.sha256)throw new Error('changed');
  if(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==capture.width||bytes.readUInt32BE(20)!==capture.height)throw new Error('changed');
  return 'data:image/png;base64,'+bytes.toString('base64');
 }finally{await fd.close();}
}
