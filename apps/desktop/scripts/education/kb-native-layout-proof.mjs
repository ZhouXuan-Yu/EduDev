import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const {nativeLayoutProof}=await import('../../src/main/assets/material-ai-native-layout-proof.ts');
const {wordQuestionBlocks,wordQuestionText,wordParagraphMap,validWordQuestionSource}=await import('../../src/shared/material-word-question.ts');
const hash=text=>createHash('sha256').update(text).digest('hex');
const block=(index,text)=>({kind:'paragraph',id:'wb_'+hash(String(index)).slice(0,32),anchor:{part:'word/document.xml',path:`/document[0]/body[0]/p[${index}]`},inlines:[{kind:'text',text}],warnings:[]});
const span=b=>({blockId:b.id,from:0,to:wordParagraphMap(b).length});
function canonical(source){for(const role of ['question','answer','analysis'])source.canonical[role]=wordQuestionText(wordQuestionBlocks(source,role));return source;}
function fixture(){
 const header=block(0,'2025年物理试卷\n'),notice=block(1,'试卷满分100分，考试时间60分钟。\n'),question=block(2,'下列物理量属于矢量的是（    ）\n'),choices=block(3,'（A）温度\t（B）电场强度\n'),answer=block(4,'B');
 question.numbering={level:0,label:'1． '};
 const base={schemaVersion:'xiaozhi.word-question-source.v1',indexPolicy:'word-question-scoped.v2',ordinal:1,number:'1',documentSha:hash('current'),context:'',blocks:[question,choices,answer],assets:[],parts:{question:[span(question),span(choices)],answer:[span(answer)],analysis:[]},canonical:{question:'',answer:'',analysis:''},issues:[]};
 const current=canonical(base),frozen=canonical({...structuredClone(base),documentSha:hash('frozen'),blocks:[header,notice,structuredClone(question),structuredClone(choices)],parts:{question:[span(header),span(notice),span(question),span(choices)],answer:[],analysis:[]},issues:['shared_context','separate_answers']});
 const stem='下列物理量属于矢量的是（    ）\n（A）温度　　（B）电场强度';
 const na={state:'not_applicable',text:''};
 const first={number:'1',stem,answer:'B',analysis:'电场强度有大小与方向。',subject:'物理',grade:'高三',knowledgePoint:'矢量',questionType:'选择题',difficulty:'easy',answerOrigin:'ai_generated',analysisOrigin:'ai_generated',requiresImage:false,issues:[],projection:{statement:{state:'provided',text:stem},choices:{state:'provided',text:'（A）温度\n（B）电场强度'},formulas:{...na},tables:{...na},figures:{...na},subquestions:{...na}}};
 assert(validWordQuestionSource(frozen));assert(validWordQuestionSource(current));
 return {frozen,current,first,final:structuredClone(first)};
}
let checks=0;
function check(name,mutate,expected=false){const f=fixture();mutate?.(f);assert.equal(nativeLayoutProof(f.frozen,f.current,f.first,f.final),expected,name);checks++;console.log('PASS '+name);}
check('allows matching printed answer and safe title/whitespace layout',null,true);
check('allows absent versus empty warnings',f=>{delete f.frozen.blocks[2].warnings;},true);
check('rejects no new document identity',f=>{f.current.documentSha=f.frozen.documentSha;});
check('rejects mismatched ordinal',f=>{f.current.ordinal++;});
check('rejects mismatched question number',f=>{f.current.number='2';});
check('rejects remaining source risk',f=>{f.current.issues=['source_warning'];});
check('rejects unsupported historic issue',f=>{f.frozen.issues.push('ambiguous_number');});
check('rejects shared physical condition',f=>{f.frozen.blocks[1].inlines[0].text='已知重力加速度为10m/s2。\n';f.frozen.parts.question[1]=span(f.frozen.blocks[1]);canonical(f.frozen);});
check('rejects numbered preamble',f=>{f.frozen.blocks[0].numbering={level:0,label:'1． '};canonical(f.frozen);});
check('rejects partial removed source block',f=>{f.frozen.parts.question[0].from=1;canonical(f.frozen);});
check('rejects changed original anchor',f=>{f.current.blocks[0].anchor.path='/document[0]/body[0]/p[99]';});
check('rejects changed original numbering',f=>{f.current.blocks[0].numbering.label='1、';canonical(f.current);});
check('rejects changed source inline segmentation',f=>{const b=f.current.blocks[0];b.inlines=[{kind:'text',text:b.inlines[0].text.slice(0,2)},{kind:'text',text:b.inlines[0].text.slice(2)}];});
check('rejects missing printed answer',f=>{f.current.parts.answer=[];canonical(f.current);});
check('rejects model answer conflict',f=>{f.final.answer='A';});
check('rejects a changed original answer',f=>{
 const b=block(9,'A');f.frozen.blocks.push(b);f.frozen.parts.answer=[span(b)];canonical(f.frozen);
});
check('rejects absent answer option',f=>{f.current.blocks[2].inlines[0].text='C';canonical(f.current);f.first.answer=f.final.answer='C';});
check('rejects changed analysis',f=>{f.final.analysis+='新结论';});
check('rejects new source analysis',f=>{const b=block(8,'源解析');f.current.blocks.push(b);f.current.parts.analysis=[span(b)];canonical(f.current);});
check('rejects changed statement text',f=>{f.final.stem=f.final.stem.replace('温度','速度');f.final.projection.statement.text=f.final.stem;});
check('rejects wrong leading number',f=>{f.final.stem='2．'+f.final.stem;f.final.projection.statement.text=f.final.stem;});
check('does not strip the start of a decimal as a question number',f=>{
 for(const source of [f.frozen,f.current]){const b=source.blocks.find(b=>b.id===block(2,'').id);b.inlines[0].text='2个物体属于哪个选项？';source.parts.question=source.parts.question.map(s=>s.blockId===b.id?span(b):s);canonical(source);}
 f.final.stem=f.final.stem.replace('下列物理量属于矢量的是（    ）','1.2个物体属于哪个选项？');f.final.projection.statement.text=f.final.stem;
});
check('does not merge distinct numeric tokens into one quantity',f=>{
 for(const source of [f.frozen,f.current]){const b=source.blocks.find(b=>b.id===block(3,'').id);b.inlines[0].text='（A）10 N\t（B）50 N\n';source.parts.question=source.parts.question.map(s=>s.blockId===b.id?span(b):s);canonical(source);}
 for(const result of [f.first,f.final]){result.projection.choices.text='（A）1 0 N\n（B）50 N';result.stem=result.stem.split('\n')[0]+'\n'+result.projection.choices.text;result.projection.statement.text=result.stem;}
});
check('preserves spaces inside decimal and operator sequences',f=>{
 for(const source of [f.frozen,f.current]){const b=source.blocks.find(b=>b.id===block(3,'').id);b.inlines[0].text='（A）1 . 0\t（B）x + + y\n';source.parts.question=source.parts.question.map(s=>s.blockId===b.id?span(b):s);canonical(source);}
 for(const result of [f.first,f.final]){result.projection.choices.text='（A）1.0\n（B）x++y';result.stem=result.stem.split('\n')[0]+'\n'+result.projection.choices.text;result.projection.statement.text=result.stem;}
});
check('rejects projection choice omission',f=>{f.final.projection.choices.text='（B）电场强度';});
check('rejects reordered projection choices',f=>{f.final.projection.choices.text='（B）电场强度（A）温度';});
check('rejects additional projection content',f=>{f.final.projection.figures={state:'provided',text:'示意图'};});
check('allows punctuation-marked choices without rewriting punctuation',f=>{
 for(const source of [f.frozen,f.current]){const b=source.blocks.find(b=>b.id===block(3,'').id);b.inlines[0].text='A.温度\tB.电场强度\n';source.parts.question=source.parts.question.map(s=>s.blockId===b.id?span(b):s);canonical(source);}
 for(const result of [f.first,f.final]){result.stem='下列物理量属于矢量的是（    ）\nA.温度\nB.电场强度';result.projection.statement.text=result.stem;result.projection.choices.text='A.温度\nB.电场强度';}
},true);
check('rejects non-contiguous source options even if model echoes them',f=>{
 for(const source of [f.frozen,f.current]){source.blocks.find(b=>b.id===block(3,'').id).inlines[0].text='（A）温度\t（C）电场强度\n';canonical(source);}
 f.current.blocks[2].inlines[0].text='C';canonical(f.current);
 for(const result of [f.first,f.final]){result.answer='C';result.stem=result.stem.replace('（B）','（C）');result.projection.statement.text=result.stem;result.projection.choices.text=result.projection.choices.text.replace('（B）','（C）');}
});
check('allows unchanged literal source analysis',f=>{
 for(const source of [f.frozen,f.current]){const b=block(8,f.first.analysis);source.blocks.push(b);source.parts.analysis=[span(b)];canonical(source);}
},true);
check('rejects model paraphrase of source analysis',f=>{
 for(const source of [f.frozen,f.current]){const b=block(8,'这是打印解析。');source.blocks.push(b);source.parts.analysis=[span(b)];canonical(source);}
});
check('rejects media even when its text looks identical',f=>{f.current.blocks[0].inlines.push({kind:'formula',latex:'x',omml:'<m:oMath/>',complete:true});canonical(f.current);});
check('does not mutate any input',f=>{const before=JSON.stringify(f);assert(nativeLayoutProof(f.frozen,f.current,f.first,f.final));assert.equal(JSON.stringify(f),before);},true);
console.log(`${checks} synthetic checks passed`);

// Optional read-only live audit; never included in the default synthetic fixture.
if(process.argv[2]==='--db'){
 const {DatabaseSync}=await import('node:sqlite');
 const {indexWordQuestions}=await import('../../src/main/assets/word-question-source.ts');
 const db=new DatabaseSync(process.argv[3],{readOnly:true});let candidates=0,proved=0;
 try{for(const row of db.prepare("select id,archive_json from question_bank_items where archive_json like '%incomplete_question%'").all()){
  const archive=JSON.parse(row.archive_json),source=archive.native?.source;
  if(archive.issues.length!==1||!source||source.kind!=='word-native.v1')continue;
  const documentRow=db.prepare('select document_json from material_word_documents where resource_id=? and version=?').get(source.resourceId,source.resourceVersion);
  if(!documentRow)continue;const document=JSON.parse(documentRow.document_json);
  if(document.questionPolicy!=='word-question-preamble.v5')continue;
  let current;try{current=indexWordQuestions(document).read(source.ordinal);}catch{continue;}if(current.issues.length)continue;
  const revisions=db.prepare('select source_json from material_ai_native_revisions where question_id=?').all(row.id);
  const frozen=revisions.map(r=>JSON.parse(r.source_json)).find(s=>s.documentSha===source.documentSha&&s.issues.includes('shared_context'));
  if(!frozen)continue;const unit=db.prepare('select first_json,final_json from material_ai_units where batch_id=? and ordinal=?').get(archive.ai.batchId,archive.ai.ordinal);
  if(!unit)continue;candidates++;const passed=nativeLayoutProof(frozen,current,JSON.parse(unit.first_json).questions[0],JSON.parse(unit.final_json).questions[0]);
  proved+=Number(passed);console.log(`LIVE ${row.id}: ${passed?'PASS':'HELD'}`);
 }assert.equal(candidates,7);assert.equal(proved,2);console.log('Live audit: 2 proved / 7 candidates');}finally{db.close();}
}
