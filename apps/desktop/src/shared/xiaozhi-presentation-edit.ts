import {isPresentationDraft,validOfficeDraft,type OfficeDraft} from './xiaozhi-office-draft';
import {officeHash,officeRelativePath,type OfficeArtifactProposal} from './xiaozhi-office-artifacts';

export const PRESENTATION_EDIT_SCHEMA='xiaozhi.presentation-edit.v1' as const;
type Page=OfficeDraft['sections'][number];
export type PresentationEdit={schemaVersion:typeof PRESENTATION_EDIT_SCHEMA;version:string;pages:({page:number}&Partial<Pick<Page,'heading'|'paragraphs'|'speakerNotes'>>&{table?:Page['table']|null})[]};
export type PresentationEditProposal={path:string;format:'pptx';parentArtifactId:string;sources:{path:string;version:string}[];presentationEdit:PresentationEdit};
export const PRESENTATION_EDIT_INSTRUCTIONS=' 只改本产品已保存PPT的指定页时，使用presentationEdit（替代draft，不能同时提供）：schemaVersion=xiaozhi.presentation-edit.v1，version为本轮office_file_stat/office_read_document返回的原PPT文件version，pages列出page（从1开始）及需要改变的heading/paragraphs/speakerNotes/table，省略字段原样保留，table=null删除表格。必须提供本会话确切parentArtifactId、新的.pptx相对path、format=pptx及sources=[]；宿主实读旧版并保留未改页、页序和备注，生成新版本仍等待原审阅卡确认。若多份PPT目标有歧义，先从本会话办公产物索引集中选定一次，不猜artifactId或版本。外部任意PPT暂不支持此局部接口，不重做整份冒充局部修改。';
const text=(maxLength:number)=>({type:'string',minLength:1,maxLength});
export const PRESENTATION_EDIT_PARAMETERS={type:'object',additionalProperties:false,required:['schemaVersion','version','pages'],properties:{schemaVersion:{type:'string',enum:[PRESENTATION_EDIT_SCHEMA]},version:{type:'string',pattern:'^[a-f0-9]{64}$'},pages:{type:'array',minItems:1,maxItems:20,items:{type:'object',additionalProperties:false,required:['page'],properties:{page:{type:'integer',minimum:1,maximum:20},heading:text(120),paragraphs:{type:'array',maxItems:20,items:text(1000)},speakerNotes:{type:'array',minItems:1,maxItems:16,items:{type:'object',additionalProperties:false,required:['kind','text'],properties:{kind:{type:'string',enum:['script','answer']},text:text(4000)}}},table:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,required:['columns','rows'],properties:{columns:{type:'array',minItems:1,maxItems:8,items:text(120)},rows:{type:'array',minItems:1,maxItems:200,items:{type:'array',minItems:1,maxItems:8,items:{type:['string','number'],maxLength:120}}}}}]}}}}}};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validPresentationEditProposal(v:unknown):v is PresentationEditProposal {
  if(!object(v)||Object.keys(v).some(k=>!['path','format','parentArtifactId','sources','presentationEdit'].includes(k))
    ||!officeRelativePath(v.path)||!v.path.toLowerCase().endsWith('.pptx')||v.format!=='pptx'
    ||typeof v.parentArtifactId!=='string'||!/^artifact_[a-f0-9-]{36}$/i.test(v.parentArtifactId)
    ||!Array.isArray(v.sources)||v.sources.length!==0||!object(v.presentationEdit))return false;
  const edit=v.presentationEdit;
  return Object.keys(edit).sort().join(',')==='pages,schemaVersion,version'&&edit.schemaVersion===PRESENTATION_EDIT_SCHEMA&&officeHash(edit.version)
    &&Array.isArray(edit.pages)&&edit.pages.length>0&&edit.pages.length<=20&&new Set(edit.pages.map(p=>object(p)?p.page:undefined)).size===edit.pages.length
    &&edit.pages.every(p=>object(p)&&Number.isInteger(p.page)&&Number(p.page)>=1&&Number(p.page)<=20
      &&Object.keys(p).length>1&&Object.keys(p).every(k=>['page','heading','paragraphs','speakerNotes','table'].includes(k)));
}
/** Omitted fields and unselected pages are copied exactly from the saved draft. */
export function applyPresentationEdit(original:OfficeDraft,edit:PresentationEdit):OfficeArtifactProposal['draft'] {
  if(!isPresentationDraft(original))throw Error('invalid_input');
  const draft=JSON.parse(JSON.stringify(original)) as OfficeDraft;
  for(const change of edit.pages){
    const section=draft.sections[change.page-1];if(!section)throw Error('invalid_input');
    for(const key of ['heading','paragraphs','speakerNotes','table'] as const)if(Object.prototype.hasOwnProperty.call(change,key)){
      if(key==='table'&&change.table===null)delete section.table;
      else Object.assign(section,{[key]:change[key]});
    }
  }
  if(!validOfficeDraft(draft))throw Error('invalid_input');return draft;
}
