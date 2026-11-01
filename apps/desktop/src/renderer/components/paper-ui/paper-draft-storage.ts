import {PAPER_SCHEMA,validPaperBlueprint,validPaperReview,validPaperSession,type PaperBlueprint} from '../../../shared/paper-blueprint';
import {plainStudentInput} from '../../../shared/student-context';

export const PAPER_UI_DRAFT_KEY='edudev.paper-ui.supplement-draft.v1';
export type PaperDraftReference={id:string;sessionId:string};
/** UI recovery data only: never persist a PaperView, confirmation, digest or questions. */
export type PaperUiDraft={schemaVersion:'edudev.paper-ui-draft.v1';blueprint:PaperBlueprint;contextOwner:string;targetSessionId:string;currentView?:PaperDraftReference};
export type PaperDraftRead={status:'empty'}|{status:'invalid'}|{status:'ready';draft:PaperUiDraft};
export function validPaperUiDraft(value:unknown):value is PaperUiDraft{
 if(!plainStudentInput(value,['schemaVersion','blueprint','contextOwner','targetSessionId','currentView'])||value.schemaVersion!=='edudev.paper-ui-draft.v1'||!validPaperBlueprint(value.blueprint)||!validPaperSession(value.contextOwner)||value.targetSessionId!==value.contextOwner)return false;
 return value.currentView===undefined||plainStudentInput(value.currentView,['id','sessionId'])&&validPaperReview({schemaVersion:PAPER_SCHEMA,...value.currentView});
}
export function paperUiStorage():Storage|undefined{try{return window.sessionStorage;}catch{return undefined;}}
export function readPaperUiDraft(storage:Storage|undefined):PaperDraftRead{
 try{if(!storage)return {status:'invalid'};const text=storage.getItem(PAPER_UI_DRAFT_KEY);if(text===null)return {status:'empty'};if(text.length>65536)return {status:'invalid'};const value:unknown=JSON.parse(text);return validPaperUiDraft(value)?{status:'ready',draft:value}:{status:'invalid'};}catch{return {status:'invalid'};}
}
export function savePaperUiDraft(storage:Storage|undefined,draft:PaperUiDraft):boolean{
 try{if(!storage||!validPaperUiDraft(draft))return false;const text=JSON.stringify(draft);if(text.length>65536)return false;storage.setItem(PAPER_UI_DRAFT_KEY,text);return storage.getItem(PAPER_UI_DRAFT_KEY)===text;}catch{return false;}
}
export function clearPaperUiDraft(storage:Storage|undefined):void{try{storage?.removeItem(PAPER_UI_DRAFT_KEY);}catch{/* Recovery is optional UI state, never domain authority. */}}
