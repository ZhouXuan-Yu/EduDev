import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {approvedFile} from '../workspace-authority';
import {fileVersion,type WorkspaceLease} from '../workspace-files';
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
/** Shared stable, bounded original-file read; no inspection, parsing or writes. */
export async function readInspectionFile(lease:WorkspaceLease,relative:string){
  const target=approvedFile(lease.path,relative),before=await fs.lstat(target);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1)throw Error('permission_denied');
  if(before.size>16*1048576)throw Error('too_large');const opened=await fs.open(target,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  try{
   const stat=await opened.stat();if(!stat.isFile()||stat.nlink!==1||fileVersion(stat)!==fileVersion(before))throw Error('changed');
   const bytes=await opened.readFile(),after=await opened.stat(),last=await fs.lstat(approvedFile(lease.path,relative));
   if(bytes.length!==before.size||fileVersion(after)!==fileVersion(before)||fileVersion(last)!==fileVersion(before)||last.isSymbolicLink()||last.nlink!==1)throw Error('changed');
   return{bytes,fileVersion:fileVersion(before),sha256:hash(bytes),size:bytes.length};
  }finally{await opened.close();}
 }

