import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

/** Resolve only this data instance's generated files; do not create a directory. */
export function conversationOutputLocation(dataRoot:string){
 const data=fs.realpathSync(dataRoot),scope=createHash('sha256').update(data.toLowerCase()).digest('hex').slice(0,16);
 return{dataRoot:data,scope,path:path.join(path.dirname(data),'XiaozhiOutputs',scope)};
}
