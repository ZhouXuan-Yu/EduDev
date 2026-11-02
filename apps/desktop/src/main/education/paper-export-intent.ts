import type {PaperRepository} from './paper-repository';
import type {PaperExportIntent} from '../../shared/paper-export';

export const PAPER_EXPORT_SOURCE_CHANGED='paper_export_source_changed' as const;
/** Re-read the named snapshot through the existing owner/source checks; never select latest. */
export async function readPaperExportIntent(papers:Pick<PaperRepository,'review'>,sessionId:string,intent:PaperExportIntent){
 const paper=await papers.review(sessionId,intent.paperId).catch((error:unknown)=>{
  const code=error instanceof Error?error.message:'';
  // Only this bound exact-source read is classified here. Permission and storage errors retain their meaning.
  if(['conflict','source_changed','not_confirmed','not_found'].includes(code))throw Error(PAPER_EXPORT_SOURCE_CHANGED);
  throw error;
 });
 if(paper.sessionId!==sessionId||paper.id!==intent.paperId||paper.digest!==intent.digest
  ||paper.state!=='confirmed'||!paper.complete||!paper.sourceCurrent||paper.exportCurrent!==true)throw Error(PAPER_EXPORT_SOURCE_CHANGED);
 return paper;
}
