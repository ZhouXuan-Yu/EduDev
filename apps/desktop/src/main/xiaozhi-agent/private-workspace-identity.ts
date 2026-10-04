import path from 'node:path';
/** Data-root relocation is not a new teacher workspace grant. Main supplies ID
 * only for its own private workspace. Never return a path for tool execution.
 */
export function privateWorkspaceFingerprintCwd(root: string, workspace: string, historical: string, id: string) {
  const same=(a:string,b:string)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
  if(!/^aisession_[a-f0-9-]{36}$/i.test(id) || path.basename(root).toLowerCase()!==id.toLowerCase()
    || !same(workspace,path.join(root,'workspace')) || !path.isAbsolute(historical)
    || path.basename(historical).toLowerCase()!=='workspace'
    || path.basename(path.dirname(historical)).toLowerCase()!==id.toLowerCase()
    || path.basename(path.dirname(path.dirname(historical))).toLowerCase()!=='xiaozhi-pi') throw new Error('configuration');
  return historical;
}
