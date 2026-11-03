import type {ComposerDraft} from '../office/composer-drafts';
type LoadPorts={current:()=>boolean;readDraft:()=>ComposerDraft;flush:()=>Promise<boolean>;navigate:()=>boolean};
const occupied=(draft:ComposerDraft)=>!!(draft.text||draft.skill||draft.paperExportIntent||draft.paperExportInvalid||draft.pendingPaperExport);
/** A draft seed is accepted only after the awaited UI save and a fresh origin/draft check. */
export async function loadAdaptationComposer(ports:LoadPorts):Promise<boolean>{
  if(!ports.current())return false;
  if(occupied(ports.readDraft()))throw Error('此会话已有未发送草稿或导出请求，请先处理；改编要求尚未载入。');
  if(!await ports.flush())return false;
  if(!ports.current()||occupied(ports.readDraft()))throw Error('导航、题篮或会话草稿已变化；改编要求尚未载入，可以重新尝试。');
  return ports.navigate();
}
