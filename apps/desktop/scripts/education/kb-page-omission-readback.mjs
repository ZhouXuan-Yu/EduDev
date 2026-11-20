import assert from 'node:assert/strict';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import '../office-agent/register-source.mjs';

const {readAiPageReceipt}=await import('../../src/main/assets/material-ai-page-evidence.ts');
const {restoredResponseQuestions}=await import('../../src/main/assets/material-ai-page-content.ts');
const {assessAiPage}=await import('../../src/main/assets/material-ai-page-publish.ts');

if(process.argv.length!==3)throw Error('Usage: kb-page-omission-readback.mjs <saved-data-root>');
const root=path.resolve(process.argv[2]);
const db=new DatabaseSync(path.join(root,'app.db'),{readOnly:true});
const host={root:()=>root,all:async(sql,params=[])=>db.prepare(sql).all(...params)};
try{
 const cases=db.prepare(`SELECT DISTINCT u.batch_id,u.ordinal,r.original_file_name
  FROM material_folder_ai_units f JOIN material_ai_units u ON f.ai_batch_id=u.batch_id
  JOIN teacher_resources r ON r.id=f.resource_id
  WHERE f.error='ai_omitted_questions' AND u.error='ai_omitted_questions'
    AND json_extract(u.input_json,'$.pagePrompt.policy')='page-fragments.v3'
  ORDER BY r.original_file_name,u.batch_id,u.ordinal`).all();
 assert(cases.length,'The saved data root has no recorded page-fragments.v3 omissions');
 const results=[];
 for(const item of cases){
  const proof=await readAiPageReceipt(host,item.batch_id,item.ordinal);
  const {unit,first,final,review,status}=proof;
  const before=restoredResponseQuestions(final,unit.pageSource,unit.pagePrompt)
   .filter(candidate=>!final.questions.some(q=>q.number===candidate.number)).map(candidate=>candidate.number);
  const assessment=assessAiPage(review??first,final,unit.pageSource,false,unit.pagePrompt,[],undefined,first);
  results.push({file:item.original_file_name,page:unit.page,before,omitted:assessment.omitted,
   recomputedReview:assessment.review,persistedStatus:status,declared:final.questions.map(q=>q.number)});
 }
 console.log(JSON.stringify({pages:results.length,calls:0,results},null,2));
}finally{
 db.close();
}
