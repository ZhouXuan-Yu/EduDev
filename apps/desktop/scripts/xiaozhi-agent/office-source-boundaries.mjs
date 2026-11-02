import assert from 'node:assert/strict';
import '../office-agent/register-source.mjs';
const {validLocalAnswerSource}=await import('../../src/shared/local-answer-source.ts');
const {createAnswerEvidence}=await import('../../src/main/xiaozhi-agent/answer-evidence.ts');
const base={kind:'workspace',path:'资料.docx',version:'a'.repeat(64),locator:'extracted_lines',startLine:2,endLine:3};
let passed=0;
for(const ext of ['docx','PDF','xlsx','pptx']){
 const local={...base,path:'课程/原始资料.'+ext};assert(validLocalAnswerSource(local));
 const registry=createAnswerEvidence('office-source-'+ext),result=registry.attach('office_read_document',{content:[{type:'text',text:'真实工具正文'}],details:{success:true,data:{sources:[{title:'原文提取行',local}]}}});
 assert.deepEqual(result.details.data.sources[0].local,local);assert(result.details.data.sources[0].citationId);passed++;
}
for(const override of [{path:'资料.txt'},{path:'../../资料.docx'},{path:'C:/资料.docx'},{locator:'physical_page'},{startLine:0},{endLine:1},{endLine:1000001},{page:2},{version:'old'}]){assert(!validLocalAnswerSource({...base,...override}));passed++;}
for(const local of [{...base,path:'原始.txt',locator:'text_lines'},{kind:'attachment',id:'xiat_00000000-0000-0000-0000-000000000001',revision:0,version:'a'.repeat(64),locator:'extracted_lines',startLine:1,endLine:2}]){assert(validLocalAnswerSource(local));passed++;}
console.log(JSON.stringify({ok:true,passed,boundary:'Actual source validator + answer registry, four formats, malformed ranges/paths and legacy text/attachment compatibility. No parser/model or full AT claim.'}));
