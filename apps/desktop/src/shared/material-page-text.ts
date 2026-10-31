import {plainStudentInput} from './student-context';
import {materialId} from './materials';
import {MATERIAL_PDF_MAX_PAGES,validPageBox,type PageBox} from './material-page-preview';

export const MATERIAL_PAGE_TEXT_SCHEMA='xiaozhi.material-page-text.v1' as const;
export const MATERIAL_PAGE_TEXT_TOOL='education_read_material_page' as const;
export type MaterialPageTextInput={resourceId:string;page:number;offset?:number;characterOffset?:number;refresh?:boolean;box?:PageBox};
export type MaterialPageTextLine={id:string;text:string;characterOffset:number;textComplete:boolean;box:[number,number,number,number];needsReview:true};
export type MaterialPageText={schemaVersion:typeof MATERIAL_PAGE_TEXT_SCHEMA;success:true;resourceId:string;version:string;title:string;page:number;totalPages:number;totalLines:number;lines:MaterialPageTextLine[];next:{offset:number;characterOffset:number}|null;teacherConfirmed:false;recognition:'local_ocr_unreviewed';regionBox?:PageBox;positionBasis?:'selected_region';warning:string};
export function validMaterialPageTextInput(value:unknown):value is MaterialPageTextInput{
 if(!plainStudentInput(value,['resourceId','page','offset','characterOffset','refresh','box']))return false;
 const integer=(v:unknown,max:number,min=0)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
 return materialId(value.resourceId)&&integer(value.page,MATERIAL_PDF_MAX_PAGES,1)&&(value.offset===undefined||integer(value.offset,2000))&&(value.characterOffset===undefined||integer(value.characterOffset,128000))&&(value.refresh===undefined||typeof value.refresh==='boolean')&&(value.box===undefined||validPageBox(value.box));
}
