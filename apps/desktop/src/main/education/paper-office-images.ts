import {isRichPaperOfficeSchema} from '../../shared/paper-export';
import type {OfficeDraft} from '../../shared/xiaozhi-office-draft';
import type {OriginalQuestionRepository} from './original-question-repository';
/** Existing confirmed role ledger is the authority; document identifiers alone do not grant image access. */
export async function resolvePaperOfficeImages(draft:OfficeDraft,originals:Pick<OriginalQuestionRepository,'officeImages'>,signal?:AbortSignal):Promise<Map<string,Buffer>>{
 const result=new Map<string,Buffer>();if(!isRichPaperOfficeSchema(draft.schemaVersion))return result;
 const bound=new Map<string,Awaited<ReturnType<OriginalQuestionRepository['officeImages']>>>();let total=0;
 for(const figure of draft.sections.flatMap(s=>s.figures||[])){
  signal?.throwIfAborted();const key=figure.questionId+':'+figure.version;
  if(!bound.has(key))bound.set(key,await originals.officeImages(figure.questionId,figure.version,signal));
  const image=bound.get(key)!.find(i=>i.blockId===figure.blockId);
  if(!image||image.role!==figure.role||image.assetId!==figure.assetId||image.sha256!==figure.sha256||image.width!==figure.width||image.height!==figure.height)throw new Error('conflict');
  if(!result.has(image.assetId)){total+=image.bytes.length;if(total>16*1048576)throw new Error('too_large');result.set(image.assetId,Buffer.from(image.bytes));}
 }
 signal?.throwIfAborted();return result;
}
