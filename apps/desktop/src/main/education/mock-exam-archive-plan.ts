import {mockExamAnswerPermission,type MockExamCatalog,type MockExamPermission} from '../../shared/mock-exam-compilation';
import {MOCK_EXAM_ARCHIVE_SCHEMA,mockExamArchiveOmissions,type MockExamArchiveItem,type MockExamArchivePreview} from '../../shared/mock-exam-archive';
import {protocolHash} from '../xiaozhi-agent/capabilities/validation';

const supported=/\.(?:pdf|docx?|odt|png|jpe?g|webp|bmp|tiff?|txt|md)$/iu;
const safeName=(name:string)=>name.normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/gu,'-').replace(/\s+/gu,' ').trim();
const permissionOmission=(permission:MockExamPermission)=>permission==='local_only'?undefined:permission==='excluded'?'permission_denied':'permission_unknown';

function archivePath(folder:string,ordinal:number,title:string){
  const extension=supported.exec(title)?.[0].toLowerCase();
  if(!extension)return;
  const base=safeName(title.slice(0,-extension.length)).slice(0,70).replace(/[. ]+$/u,'')||'资料';
  return folder+'/'+String(ordinal+1).padStart(3,'0')+'-'+base+extension;
}

export function planMockExamArchive(catalog:MockExamCatalog):MockExamArchivePreview{
  const {summary}=catalog;
  if(summary.state!=='confirmed')throw Error('not_confirmed');
  const entries=catalog.entries.map((entry,index)=>{
    const district=entry.metadata.district??'区待核对',round=entry.metadata.round??'轮次待核对';
    const paper:MockExamArchiveItem={title:entry.title,resourceId:entry.resourceId,sha256:entry.version};
    const paperPath=archivePath('试卷/'+district,index,entry.title);
    const paperOmission=entry.permission==='excluded'?'permission_denied':!entry.include?'not_selected':permissionOmission(entry.permission);
    if(paperOmission)paper.omission=paperOmission;
    else if(paperPath)paper.path=paperPath;
    else paper.omission='unsupported';
    const a=entry.answer;
    const answer:MockExamArchiveItem={title:a.title??'答案'};
    if(a.state==='linked'){
      answer.resourceId=a.resourceId;answer.sha256=a.version;
      const choice=mockExamAnswerPermission(entry,entry.answerPermission)?.permission??'unknown';
      const answerPath=archivePath('答案册/'+district,index,answer.title);
      const omission=permissionOmission(choice);
      if(!paper.path)answer.omission='paper_omitted';
      else if(omission)answer.omission=omission;
      else if(answerPath&&a.resourceId&&a.version)answer.path=answerPath;
      else answer.omission='unsupported';
    }else if(a.state==='embedded')answer.omission=paper.path?'answer_embedded':'paper_omitted';
    else answer.omission=a.state==='stale'?'answer_stale':'answer_missing';
    return {district,round,paper,answer};
  });
  const source={schemaVersion:MOCK_EXAM_ARCHIVE_SCHEMA,catalogId:summary.id,revision:summary.revision,digest:summary.digest,title:summary.title,entries,
    paperCount:entries.filter(row=>row.paper.path).length,answerCount:entries.filter(row=>row.answer.path).length,
    embeddedCount:entries.filter(row=>row.answer.omission==='answer_embedded').length} as const;
  return {...source,previewDigest:protocolHash(source)};
}

export function mockExamArchiveSummary(plan:MockExamArchivePreview){
  const status=(item:MockExamArchiveItem)=>item.path?'已入包 · '+item.path:mockExamArchiveOmissions[item.omission!];
  return ['# '+plan.title+' · 原件包','目录第 '+plan.revision+' 版 · '+plan.paperCount+' 份试卷 · '+plan.answerCount+' 份独立答案册',
    '目录摘要 '+plan.digest,'仅限本地使用。原件题目、完整性及答案仍须核对。','',
    ...plan.entries.map(({district,round,paper,answer})=>'- '+district+' · '+round+' · '+paper.title+' · '+status(paper)+' · '+answer.title+' · '+status(answer))].join('\n');
}
