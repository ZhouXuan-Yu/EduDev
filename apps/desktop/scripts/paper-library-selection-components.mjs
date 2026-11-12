import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const output=fs.mkdtempSync(path.resolve('test-results/paper-library-selection-components-'));
const report={success:false,checks:[],scope:'Static component guards and escaping only. Image load success and host qualification remain actual UI/domain checks.'};
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
try{
  const {PaperLibraryQuestionCard}=await server.ssrLoadModule('/src/renderer/components/paper-ui/PaperLibraryQuestionCard.tsx');
  const question={id:'question_00000000-0000-4000-8000-000000000001',subject:'数学',grade:'初二',knowledgePoint:'运算',
    questionType:'解答题',difficulty:'easy',stem:'计算 2 + 3。',answer:'5',analysis:'2 + 3 = 5。',sourceKind:'local_bank',
    sourceTitle:'受控教师输入',tags:[],categories:[],bookmarked:false,version:0,usageCount:0,lastUsedAt:'',createdAt:'',updatedAt:''};
  const render=(value,disabled=false)=>renderToStaticMarkup(React.createElement(PaperLibraryQuestionCard,
    {question:value,version:'a'.repeat(64),disabled,onSelect:()=>{throw Error('Static render cannot select');}}));
  const action=html=>[...html.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]).find(tag=>tag.includes('data-testid="paper-library-add"'));
  const initial=render(question);assert(action(initial)?.includes('disabled=""'));
  report.checks.push('The first render cannot enable Add before the original image-readiness callback');
  assert(action(render(question,true))?.includes('disabled=""'));
  report.checks.push('The workspace disabled state remains applied to the official button');
  const unverified={...question,archive:{schemaVersion:'xiaozhi.question-archive.v1',extractor:'numbered-text.v1',state:'rule_extracted',
    number:'1',sources:[{schemaVersion:'xiaozhi.material-source.v1',resourceId:'resource_00000000-0000-4000-8000-000000000001',
      version:'a'.repeat(64),offset:0,chunkId:'chunk_00000000-0000-4000-8000-000000000001',bodyVersion:'b'.repeat(64)}],
    issues:[],sourceRisks:[],sourceChecked:false,answerOrigin:'source',analysisOrigin:'source'}};
  const pending=render(unverified);assert(pending.includes('题目仍需在题本核对'));assert(action(pending)?.includes('disabled=""'));
  report.checks.push('A real-shaped rule-extracted source remains visibly pending teacher verification');
  const blank=render({...question,subject:'',grade:'',stem:'<script>alert(1)</script>原文'});
  assert(!blank.includes('<span> · </span>'));assert(!blank.includes('<script>'));
  report.checks.push('Missing metadata avoids an empty separator and source text stays escaped');
  report.success=true;
}catch(failure){report.failure=String(failure.stack??failure);process.exitCode=1;}
finally{await server.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,failure:report.failure}));}
