import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mockExamPageEvidence} from '../../src/main/education/mock-exam-page-evidence.ts';
import {mockExamPageEvidenceLabel} from '../../src/shared/mock-exam-compilation.ts';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE material_pdf_pages(generation TEXT,page INTEGER,status TEXT,result_json TEXT)');
const save=sqlite.prepare('INSERT INTO material_pdf_pages VALUES(?,?,?,?)');
const work={all:async(text,params)=>sqlite.prepare(text).all(...params)};
const add=(generation,texts)=>texts.forEach((text,index)=>save.run(generation,index+1,'complete',JSON.stringify({text})));
const evidence=(generation,total,state='complete')=>mockExamPageEvidence(work,{pdf_generation:generation,pdf_total:total,pdf_state:state});

try{
  add('complete',['数学模拟\n1  /  4','四个选项','几何图\n3 / 4','证明题']);
  assert.deepEqual(await evidence('complete',4),{state:'count_matches',physicalPages:4,printedPages:4});

  add('missing',['数学模拟\n1 ／ 4','几何图\n3 / 4','证明题']);
  const missing=await evidence('missing',3);
  assert.deepEqual(missing,{state:'possible_missing',physicalPages:3,printedPages:4,possibleMissingPages:[2]});
  assert.match(mockExamPageEvidenceLabel(missing),/疑缺第 2 页/u);

  add('inconsistent',['数学模拟\n第 1 页 / 共 4 页','图形\n2 / 5','证明题']);
  assert.deepEqual(await evidence('inconsistent',3),{state:'unverified',physicalPages:3});

  add('repeat',['数学模拟\n1 / 4','数学模拟\n1 / 4','证明题']);
  assert.deepEqual(await evidence('repeat',3),{state:'unverified',physicalPages:3});

  add('equations',['函数 f(x)=1/4','1 / 4\n2 / 4','求 f(1)']);
  assert.deepEqual(await evidence('equations',3),{state:'unverified',physicalPages:3});
  assert.equal(await evidence('complete',4,'processing'),undefined);
  assert.deepEqual(await evidence('large',400),{state:'unverified',physicalPages:400});
  console.log(JSON.stringify({ok:true,checks:7}));
}finally{sqlite.close();}
