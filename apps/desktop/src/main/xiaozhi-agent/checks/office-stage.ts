import fs from 'node:fs/promises';
import path from 'node:path';

/** Job closure starts Office shutdown; retry only our known files while its handles are released. */
export async function clearOfficeStage(folder:string,names:string[]):Promise<void>{
 if(!folder)return;
 const pending=new Set([...names,...Array.from({length:64},(_,i)=>`page-${i+1}.png`)]),deadline=Date.now()+2000;
 while(pending.size){
  for(const name of pending)try{await fs.unlink(path.join(folder,name));pending.delete(name);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')pending.delete(name);}
  if(!pending.size||Date.now()>=deadline)break;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 await fs.rmdir(folder).catch(()=>{});
}
