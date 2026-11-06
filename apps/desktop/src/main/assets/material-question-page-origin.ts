import type {QuestionBankItem} from '../../shared/contracts';
import type {MaterialRepository} from './material-repository';
import type {readAiPageReceipt} from './material-ai-page-evidence';
import {pageContinuation} from '../../shared/material-ai-continuation';
import {materialSource} from './material-source';
import {extractMaterialQuestions,normalizeMaterialStem} from './material-question-extract';
/** Called after full canonical AI/page validation. This only groups unchanged local candidates. */
export async function continuationQuestionOrigin(materials:MaterialRepository,q:QuestionBankItem,proof:Awaited<ReturnType<typeof readAiPageReceipt>>){
 const extra=pageContinuation(proof.unit.pagePrompt),a=q.archive;if(!extra||!a?.pageSource||!a.sources.length)return;
 if(extra.source.resourceId!==a.pageSource.resourceId||extra.source.version!==a.pageSource.version||extra.source.generation!==a.pageSource.generation||extra.source.page!==a.pageSource.page+1)return;
 const units=[];
 for(const source of a.sources){const window=await materials.readingWindow(source.resourceId,source.offset,1);if(window.units.length!==1||JSON.stringify(materialSource(window.units[0]))!==JSON.stringify(source)||window.units[0].chunk.pageNumber!==a.pageSource.page)return;units.push(window.units[0]);}
 const next=await materials.readingWindow(a.pageSource.resourceId,Math.max(...a.sources.map(s=>s.offset))+1,64-a.sources.length);
 for(const unit of next.units){if(unit.chunk.pageNumber!==extra.source.page)break;units.push(unit);}
 if(units.length===a.sources.length||units.length===64&&next.hasMore)return;
 const candidates=extractMaterialQuestions(units,'local-text-v1').filter(c=>c.archive.number===a.number&&normalizeMaterialStem(c.fields.stem)===normalizeMaterialStem(q.stem));if(candidates.length!==1)return;
 const c=candidates[0];return{origin:{sources:c.archive.sources,number:c.archive.number,stem:c.fields.stem,risks:c.archive.sourceRisks},sources:units.map(materialSource)};
}
