import type {AiPagePrompt} from '../../shared/material-ai-page';
import {QUESTION_ILLUSTRATIONS_SCHEMA,QUESTION_TEXT_PRESENTATION_SCHEMA,isCompleteQuestionDocument,validQuestionDocument,type QuestionDocument,type QuestionIllustrations} from '../../shared/question-document';
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

/** Versioned derived view over the existing frozen crop receipt. No input/geometry rewrite. */
export function pageQuestionIllustrations(crop:PageCrop,prompt:AiPagePrompt|undefined,original:AiImageQuestion):QuestionIllustrations{
 const all=editablePageFigures(crop,prompt,original);
 return {schemaVersion:QUESTION_ILLUSTRATIONS_SCHEMA,complete:all!==undefined,blockIds:all??(original.projection.figures.state==='provided'?(crop.fragments||[]).flatMap((f,i)=>f.kind==='diagram'?['source_question_'+i]:[]):[])};
}
export function attachPageIllustrations(document:QuestionDocument,crop:PageCrop,prompt:AiPagePrompt|undefined,original:AiImageQuestion){
 if(!isCompleteQuestionDocument(document))throw Error('source_changed');
 document.context.illustrations=pageQuestionIllustrations(crop,prompt,original);
 if(!validQuestionDocument(document))throw Error('invalid_response');
}
export function withoutDerivedIllustrations(document:QuestionDocument|undefined){
 if(!document||!isCompleteQuestionDocument(document)||!document.context.illustrations)return document;
 const source=structuredClone(document);delete source.context.illustrations;return source;
}
