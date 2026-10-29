import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {authorizedWorkspace} from './workspace-authority';
import {noLinks} from './managed-skills';

export const CONVERSATION_OUTPUT_LABEL='小智生成文件';

/** App-owned output only. Never turns the private Pi cwd or the data root into a file grant. */
export function conversationOutput(dataRoot:string,sessionId:string) {
  if(!/^aisession_[a-f0-9-]{36}$/i.test(sessionId))throw Error('invalid_input');
  const data=fs.realpathSync(dataRoot);
  const scope=createHash('sha256').update(data.toLowerCase()).digest('hex').slice(0,16);
  const directory=path.join(path.dirname(data),'XiaozhiOutputs',scope,sessionId);
  try {
    noLinks(directory,true);
    fs.mkdirSync(directory,{recursive:true});
    noLinks(directory);
    return {path:authorizedWorkspace(directory,data),label:CONVERSATION_OUTPUT_LABEL};
  } catch {throw Error('permission_denied');}
}
