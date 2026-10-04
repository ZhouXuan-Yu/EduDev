import assert from 'node:assert/strict';
import {validOfficeDraft,officeOutputFormat,OFFICE_DRAFT_SCHEMA} from '../../src/shared/xiaozhi-office-draft.ts';
const draft={schemaVersion:OFFICE_DRAFT_SCHEMA,title:'分数教研 🌱',sections:[{heading:'课堂',paragraphs:['中文教学\n分数与练习'],table:{columns:['知识点','题数'],rows:[['分数',8],['=1+1',37]]}}]};
let passed=0;const check=(name,fn)=>{fn();passed++;console.log(`PASS ${name}`);};const copy=()=>JSON.parse(JSON.stringify(draft));
check('Versioned Chinese/astral text and literal formula plus numeric cells accepted',()=>assert(validOfficeDraft(draft)));
for(const [name,mutate]of [
 ['Unknown version',v=>v.schemaVersion='xiaozhi.office-draft.v2'],['Unknown root path',v=>v.path='C:/private'],
 ['Unknown section HTML',v=>v.sections[0].html='<script>'],['Formula object cell',v=>v.sections[0].table.rows[0][1]={formula:'WEBSERVICE("https://example.invalid")'}],
 ['Wrong matrix width',v=>v.sections[0].table.rows[0].push('extra')],['Nonfinite number',v=>v.sections[0].table.rows[0][1]=Infinity],
 ['Unsafe XML control',v=>v.title+='\u0000'],['Unpaired surrogate',v=>v.title+='\ud800'],
 ['Too long paragraph',v=>v.sections[0].paragraphs=['文'.repeat(1001)]],['Too many table rows',v=>v.sections[0].table.rows=Array.from({length:201},()=>['分数',8])],
 ['Empty section',v=>v.sections=[{heading:'空',paragraphs:[]}]],['Sparse paragraph',v=>v.sections[0].paragraphs=new Array(1)],
 ['Sparse table cell',v=>v.sections[0].table.rows=[new Array(2)]],['Too many sections',v=>v.sections=Array.from({length:21},()=>draft.sections[0])],
 ['Whole input byte bound',v=>v.sections=Array.from({length:20},()=>({heading:'大',paragraphs:Array.from({length:20},()=>'文'.repeat(1000))}))]
])check(name+' rejected',()=>{const value=copy();mutate(value);assert(!validOfficeDraft(value));});
check('Only actual four output formats accepted without coercing objects',()=>{for(const v of ['docx','pdf','xlsx','pptx'])assert(officeOutputFormat(v));for(const v of ['docm','xlsm','html',{},null])assert(!officeOutputFormat(v));});
console.log(JSON.stringify({passed,total:passed,scope:'Strict structured Office input guards only; real generator/UI evidence separate'}));
