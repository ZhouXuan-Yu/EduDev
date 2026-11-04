/** Metadata-only routing regression. No Electron, parser, model, DB or file writes.
 * Run after the three production routing changes are released from source freeze.
 */
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const {officeVersionCatalog}=await import('../../src/main/xiaozhi-agent/office-version-catalog.ts');
const {PAPER_OFFICE_SCHEMA,PAPER_C2_OFFICE_SCHEMA}=await import('../../src/shared/paper-export.ts');
const {OFFICE_DRAFT_SCHEMA}=await import('../../src/shared/xiaozhi-office-draft.ts');

const sessionId='aisession_00000000-0000-0000-0000-000000000001';
const otherSession='aisession_00000000-0000-0000-0000-000000000002';
const id=n=>'artifact_00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const digest='a'.repeat(64),workspaceHash='b'.repeat(64);
const artifact=(n,extra={})=>({id:id(n),sessionId,messageId:'',title:'Saved file '+n,type:'docx',
  fileName:`saved-${n}.docx`,mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  description:'Existing saved publication',contentMd:'Existing summary',filePath:`D:\\owned\\saved-${n}.docx`,
  fileSize:1234,contentHash:digest,status:'exported',errorMessage:'',
  createdAt:'2026-11-04T00:00:00.000Z',updatedAt:'2026-11-04T00:00:00.000Z',...extra});
const metadata=(row,schema=PAPER_C2_OFFICE_SCHEMA,extra={})=>({
  artifactId:row.id,parentArtifactId:null,workspaceHash,draftSchema:schema,path:row.fileName,
  format:row.type,sha256:row.contentHash,size:row.fileSize,...extra});
const paper=artifact(1),oldPaper=artifact(2,{type:'pdf',fileName:'old-paper.pdf'}),
  lesson=artifact(3),ordinary=artifact(4),html=artifact(5,{type:'html',fileName:'lesson.html',
    htmlVersion:{savedAt:'2026-11-04T00:00:00.000Z',verifiedAt:null}});
const lessonSchema='xiaozhi.teaching-lesson-office.v1';
const report={success:false,checks:[],electronLaunches:0,modelCalls:0,
  scope:'Production metadata projection and actual TSX routing condition; not UI, parser or authorization acceptance.'};
async function check(name,run){await run();report.checks.push({name,status:'PASS'});}
const classify=(rows,records)=>officeVersionCatalog(rows,async owner=>{
  assert.equal(owner,sessionId);return records;
});
const unmarked=rows=>rows.forEach(row=>assert.equal(row.savedArtifactKind,undefined));

try{
  let mixed;
  await check('Mixed historical paper, C2 paper, lesson, ordinary Office and HTML preserve facts',async()=>{
    const rows=[paper,oldPaper,lesson,ordinary,html],before=structuredClone(rows);
    const records=[metadata(paper),metadata(oldPaper,PAPER_OFFICE_SCHEMA),metadata(lesson,lessonSchema),metadata(ordinary,OFFICE_DRAFT_SCHEMA)];
    const recordBefore=structuredClone(records);let reads=0;
    mixed=await officeVersionCatalog(rows,async owner=>{reads++;assert.equal(owner,sessionId);return records;});
    assert.equal(reads,1);assert.equal(mixed.length,rows.length);
    assert.deepEqual(mixed.map(r=>r.id),rows.map(r=>r.id));
    assert.deepEqual(mixed.map(r=>r.savedArtifactKind),['paper','paper',undefined,undefined,undefined]);
    assert.equal(mixed[3].officeVersion.currentArtifactId,ordinary.id);assert.deepEqual(mixed[4],html);
    for(let i=0;i<rows.length;i++)for(const key of Object.keys(rows[i]))assert.deepEqual(mixed[i][key],rows[i][key]);
    assert.deepEqual(rows,before);assert.deepEqual(records,recordBefore);
  });
  await check('Each identity/path/format/hash/size mismatch independently prevents paper marking',async()=>{
    for(const patch of [{artifactId:id(99)},{path:'elsewhere.docx'},{format:'pdf'},{sha256:'c'.repeat(64)},
      {size:paper.fileSize+1},{size:String(paper.fileSize)},{size:0}]){
      unmarked(await classify([paper],[metadata(paper,PAPER_C2_OFFICE_SCHEMA,patch)]));
    }
  });
  await check('Missing optional metadata supports old callers but cannot mark paper',async()=>{
    for(const key of ['format','sha256','size']){const record=metadata(paper);delete record[key];unmarked(await classify([paper],[record]));}
    const oldCaller=metadata(ordinary,OFFICE_DRAFT_SCHEMA);for(const key of ['format','sha256','size'])delete oldCaller[key];
    const result=await classify([ordinary],[oldCaller]);assert.equal(result[0].officeVersion.currentArtifactId,ordinary.id);unmarked(result);
  });
  await check('Non-exported rows, unsupported formats and missing session cannot mark paper',async()=>{
    for(const patch of [{status:'failed'},{status:'draft'},{sessionId:''},{type:'html',fileName:'file.html'},
      {type:'xlsx',fileName:'file.xlsx'},{type:'pptx',fileName:'file.pptx'}]){
      const row=artifact(6,patch);unmarked(await classify([row],[metadata(row)]));
    }
  });
  await check('Malformed or unknown draft schema does not infer paper from title or filename',async()=>{
    for(const schema of [lessonSchema,undefined,'xiaozhi.office-paper-draft.v99','paper']){
      unmarked(await classify([{...paper,title:'正式试卷',description:'paper'}],[metadata(paper,PAPER_C2_OFFICE_SCHEMA,{draftSchema:schema})]));
    }
  });
  await check('Duplicate matching or conflicting metadata is ambiguous, never first-match paper',async()=>{
    for(const records of [[metadata(paper),metadata(paper)],[metadata(paper),metadata(paper,lessonSchema)],
      [metadata(paper),metadata(paper,PAPER_C2_OFFICE_SCHEMA,{sha256:'d'.repeat(64)})]]){
      unmarked(await classify([paper],records));unmarked(await classify([paper],[...records].reverse()));
    }
  });
  await check('Metadata is reused only within the requested session',async()=>{
    const foreign={...paper,sessionId:otherSession};const calls=[];
    const rows=await officeVersionCatalog([paper,foreign],async owner=>{calls.push(owner);return owner===sessionId?[metadata(paper)]:[];});
    assert.deepEqual(calls,[sessionId,otherSession]);assert.equal(rows[0].savedArtifactKind,'paper');unmarked([rows[1]]);
  });
  await check('Hundred-row catalog is not expanded to unrelated saved paper metadata',async()=>{
    const rows=Array.from({length:100},(_,i)=>artifact(100+i));let reads=0,lookups=0;
    const result=await officeVersionCatalog(rows,async()=>{reads++;return [...rows.map(r=>metadata(r)),metadata(artifact(999))];},
      async()=>{lookups++;assert.fail('Paper classification must not fetch outside the catalog');});
    assert.equal(reads,1);assert.equal(lookups,0);assert.equal(result.length,100);assert(result.every(r=>r.savedArtifactKind==='paper'));
    assert.deepEqual(result.map(r=>r.id),rows.map(r=>r.id));
  });
  await check('Existing ordinary-family current publication completion remains intact',async()=>{
    const first=artifact(20),latest=artifact(21),records=[metadata(first,OFFICE_DRAFT_SCHEMA),
      metadata(latest,OFFICE_DRAFT_SCHEMA,{parentArtifactId:first.id})];let reads=0,lookups=0;
    const rows=await officeVersionCatalog([first],async()=>{reads++;return records;},async key=>{
      lookups++;assert.equal(key,latest.id);return latest;
    });
    assert.equal(reads,1);assert.equal(lookups,1);assert.deepEqual(rows.map(r=>r.id),[first.id,latest.id]);
    assert(rows.every(r=>r.officeVersion.currentArtifactId===latest.id));unmarked(rows);
  });
  await check('Real renderer conditional uses paper marker; lesson/ordinary/HTML keep original branch',async()=>{
    const source=fs.readFileSync(new URL('../../src/renderer/components/product/TeachingArtifactsWorkspace.tsx',import.meta.url),'utf8');
    const tree=ts.createSourceFile('TeachingArtifactsWorkspace.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const conditions=[];
    function visit(node){
      if(ts.isConditionalExpression(node)&&ts.isJsxSelfClosingElement(node.whenTrue)&&node.whenTrue.tagName.getText(tree)==='SavedArtifactPreview')conditions.push(node);
      ts.forEachChild(node,visit);
    }visit(tree);
    assert.equal(conditions.length,1);const branch=conditions[0];
    assert(ts.isJsxSelfClosingElement(branch.whenFalse));assert.equal(branch.whenFalse.tagName.getText(tree),'PiWorkspaceFiles');
    const selectsPaper=Function('artifact',`return Boolean(${branch.condition.getText(tree)});`);
    assert.deepEqual(mixed.map(selectsPaper),[true,true,false,false,false]);
    assert.equal(selectsPaper(paper),false); // No classification is not permission to choose the paper reader.
    assert.equal(selectsPaper({...paper,savedArtifactKind:'paper'}),true);
    assert.equal(selectsPaper({...html,savedArtifactKind:'paper'}),false);
    assert.equal(selectsPaper({...mixed[3],savedArtifactKind:'paper'}),false);
    assert(!branch.whenTrue.attributes.properties.some(p=>ts.isJsxAttribute(p)&&/error|fallback/i.test(p.name.getText(tree))),
      'No rejection callback may switch a paper read to an ordinary directory reader');
  });
  report.success=true;
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;}
console.log(JSON.stringify(report,null,2));
