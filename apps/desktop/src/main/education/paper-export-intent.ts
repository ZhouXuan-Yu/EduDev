import type {PaperRepository} from './paper-repository';
import type {PaperView} from '../../shared/paper-blueprint';
import {paperExportVersionCurrent,SELECTED_PAPER_EXPORT_INTENT_SCHEMA,SELECTED_PAPER_VERSION,type PaperAgentExportInput,type PaperExportIntent} from '../../shared/paper-export';

export const PAPER_EXPORT_SOURCE_CHANGED='paper_export_source_changed' as const;
/** Re-read the named snapshot through the existing owner/source checks; never select latest. */
export async function readPaperExportIntent(papers:Pick<PaperRepository,'review'>,sessionId:string,intent:PaperExportIntent){
 const paper=await papers.review(sessionId,intent.paperId).catch((error:unknown)=>{
  const code=error instanceof Error?error.message:'';
  // Only this bound exact-source read is classified here. Permission and storage errors retain their meaning.
  if(['conflict','source_changed','not_confirmed','not_found'].includes(code))throw Error(PAPER_EXPORT_SOURCE_CHANGED);
  throw error;
 });
 assertPaperExportIntent(paper,sessionId,intent);
 return paper;
}

function assertPaperExportIntent(paper:PaperView,sessionId:string,intent:PaperExportIntent) {
 if(paper.sessionId!==sessionId||paper.id!==intent.paperId||paper.digest!==intent.digest
  ||paper.state!=='confirmed'||!paper.complete||!paper.sourceCurrent
  ||!paperExportVersionCurrent(paper,intent.schemaVersion===SELECTED_PAPER_EXPORT_INTENT_SCHEMA?SELECTED_PAPER_VERSION:undefined))throw Error(PAPER_EXPORT_SOURCE_CHANGED);
}

export async function resolvePaperExport(papers:Pick<PaperRepository,'review'|'readForAgent'>,sessionId:string,runId:string,
 raw:PaperAgentExportInput,hostIntent?:PaperExportIntent,taskRuns?:()=>Promise<readonly string[]>){
 const {format,audience,template='paper'}=raw;
 if(hostIntent){
  if(format!==hostIntent.format||audience!==hostIntent.audience||template!==hostIntent.template||
     raw.paperId!==undefined&&(raw.paperId!==hostIntent.paperId||raw.digest!==hostIntent.digest))throw Error('conflict');
  return {paper:await readPaperExportIntent(papers,sessionId,hostIntent),intent:hostIntent};
 }
 const spec={schemaVersion:SELECTED_PAPER_EXPORT_INTENT_SCHEMA,format,audience,template} as const;
 if(raw.paperId!==undefined){
  const intent:PaperExportIntent={...spec,paperId:raw.paperId,digest:raw.digest};
  return {paper:await readPaperExportIntent(papers,sessionId,intent),intent};
 }
 const result=await papers.readForAgent(sessionId,runId,await taskRuns?.()??[],undefined);
 if(result.kind==='ambiguous')throw Error('ambiguous_paper');
 if(result.kind!=='found')throw Error(result.kind==='missing'?'not_found':'not_confirmed');
 const paper=result.paper;
 if(!paper.digest)throw Error('configuration');
 const intent:PaperExportIntent={...spec,paperId:paper.id,digest:paper.digest};
 assertPaperExportIntent(paper,sessionId,intent);
 return {paper,intent};
}
