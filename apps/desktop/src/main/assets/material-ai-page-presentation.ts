import type {AiPagePrompt} from '../../shared/material-ai-page';
import {QUESTION_TEXT_PRESENTATION_SCHEMA,isCompleteQuestionDocument,type QuestionDocument} from '../../shared/question-document';
import type {AiImageQuestion} from '../../shared/material-ai-image';
import type {PageCrop} from './material-ai-page-crops';

/** Derived only from authenticated frozen layout/crops, never renderer-provided image IDs. */
export function editablePageFigures(crop:PageCrop,prompt:AiPagePrompt|undefined,original:AiImageQuestion):string[]|undefined{
 if(!crop.fragments||!prompt||!('blocks' in prompt))return original.projection.figures.state==='not_applicable'?[]:undefined;
 const ids:string[]=[];
 for(const [i,f] of crop.fragments.entries()){
  const blocks=(f.blockIds||[f.blockId]).map(id=>prompt.blocks.blocks.find(b=>b.id===id));
  // Whole continuation rasters and unknown blocks can contain indispensable figures.
  if(blocks.some(b=>!b))return;
  if(f.kind==='diagram')ids.push('source_question_'+i);
  else if(blocks.some(b=>b!.kind==='image'||b!.kind==='chart'))return;
 }
 if(original.projection.figures.state==='provided'?ids.length===0:ids.length!==0)return;
 return ids;
}

export function setPageTextPresentation(document:QuestionDocument,original:AiImageQuestion,crop:PageCrop,prompt:AiPagePrompt|undefined,checked:boolean){
 if(!isCompleteQuestionDocument(document))throw Error('source_changed');
 // Restoring the authenticated original statement restores the original picture presentation.
 if(document.context.projection.statement.text===original.stem){delete document.context.presentation;return;}
 const figures=editablePageFigures(crop,prompt,original);
 document.context.presentation={schemaVersion:QUESTION_TEXT_PRESENTATION_SCHEMA,
  mode:checked&&figures!==undefined?'teacher_text':'needs_review',figureBlockIds:checked&&figures!==undefined?figures:[]};
}
