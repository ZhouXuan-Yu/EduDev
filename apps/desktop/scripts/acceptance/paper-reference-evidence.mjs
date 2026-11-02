/** Independent C2a assertions. SELECT/read-only observation; no business writes. */
import assert from 'node:assert/strict';
import {sha256} from './evidence.mjs';
import {jsonEqual} from './paper-export-intent-evidence.mjs';

export const referenceSchema='xiaozhi.paper-reference.v1';
export const layoutKeys=['paper','orientation','columns','top','right','bottom','left','columnGap'];
export function sourceReceipt(resource,chunk,offset) {
  const version=[chunk.id,chunk.chunk_index,chunk.content_md,!!chunk.contains_personal_data];
  if(chunk.page_number)version.push({pageNumber:chunk.page_number});
  return {schemaVersion:'xiaozhi.material-source.v1',resourceId:resource.id,version:resource.content_hash,
    offset,chunkId:chunk.id,bodyVersion:sha256(JSON.stringify(version))};
}
export function candidateFields(candidate) {
  const fields=Object.fromEntries(['title','subject','grade','durationMinutes','totalPoints'].map(key=>[key,candidate[key]]));
  for(let i=0;i<candidate.sections.length;i++)for(const key of ['label','questionType','count','points','difficulty','knowledgePoint'])fields[`sections.${i}.${key}`]=candidate.sections[i][key];
  for(const key of layoutKeys)fields['layout.'+key]=candidate.layout[key];return fields;
}
export function assertReferenceCandidate(candidate,{fixture,truth,resource,chunks}) {
  assert.equal(candidate.schemaVersion,referenceSchema);assert.equal(candidate.parser,'reference-rules.v1');
  assert.equal(resource.content_hash,truth.inputSha256);assert.equal(candidate.source.resourceId,resource.id);
  assert.equal(candidate.source.version,truth.inputSha256);assert.equal(candidate.source.parseEngine,resource.parse_engine);
  if(resource.original_file_name)assert.equal(candidate.source.filename,resource.original_file_name);
  assert.equal(candidate.source.complete,true,'Controlled file must be fully admitted and read');
  assert.equal(candidate.source.readChunks,chunks.length);assert.equal(candidate.source.totalChunks,chunks.length);
  const receipts=chunks.map((chunk,index)=>sourceReceipt(resource,chunk,index));jsonEqual(candidate.source.units,receipts);
  assert.equal(candidate.source.bodyDigest,sha256(JSON.stringify(receipts)));
  const evidence=new Map(candidate.evidence.map(item=>[item.id,item]));assert.equal(evidence.size,candidate.evidence.length);
  function known(field,value) {
    assert.equal(field.status,'known');assert.equal(field.value,String(value));assert.equal(field.confirmed,false);assert.equal(field.teacherValue,undefined);
    assert(field.evidenceIds.length>0);for(const id of field.evidenceIds)assert(evidence.has(id),'Unknown evidence ID');
  }
  function unknown(field) {assert.equal(field.status,'unknown');assert.equal(field.value,null);assert.equal(field.confirmed,false);assert.equal(field.teacherValue,undefined);}
  for(const key of ['title','subject','grade','durationMinutes','totalPoints'])known(candidate[key],truth.facts[key]);
  assert.equal(candidate.sections.length,truth.facts.sections.length);
  candidate.sections.forEach((section,index)=>{
    const expected=truth.facts.sections[index];known(section.questionType,expected.label);known(section.count,expected.count);known(section.points,expected.points);
    known(section.label,truth.evidence.sections[index].quote.replace(/^[一二三四五六七八九十]+、/,''));unknown(section.difficulty);unknown(section.knowledgePoint);
  });
  for(const key of layoutKeys) {
    if(fixture.format==='txt')unknown(candidate.layout[key]);
    else known(candidate.layout[key],key==='paper'?'A4':key==='orientation'||key==='columns'?truth.facts.layout[key]:truth.facts.layout.twips[key]);
  }
  if(fixture.format==='docx')assert.equal(candidate.source.structureDigest,truth.structureDigest);
  else assert.equal(candidate.source.structureDigest,undefined);
  for(const item of candidate.evidence) {
    if(item.source) {
      const index=receipts.findIndex(r=>r.chunkId===item.source.chunkId);assert(index>=0);jsonEqual(item.source,receipts[index]);
      assert(Number.isSafeInteger(item.line)&&item.line>0);
      if(item.id.startsWith('context_')) {
        assert.equal(item.line,1);assert(index<3,'Context excerpts admit only the first three persisted chunks');
        assert.equal(item.text,chunks[index].content_md.slice(0,800),'Context must equal the exact bounded persisted chunk excerpt');
      } else assert.equal(item.text,chunks[index].content_md.split(/\r?\n/)[item.line-1]?.trim().slice(0,800),'Evidence text/line must point into that exact persisted source chunk');
    } else {
      assert.equal(item.part,'word/document.xml');assert.equal(typeof item.path,'string');assert(item.path.length>0);
      assert(truth.nativeSections.some(xml=>xml.startsWith(item.text)),'Page-setting evidence must be literal native XML');
    }
  }
  assert.equal(candidate.digest,sha256(JSON.stringify({...candidate,digest:''})));
  return {resourceId:resource.id,version:resource.content_hash,digest:candidate.digest,bodyDigest:candidate.source.bodyDigest,
    structureDigest:candidate.source.structureDigest,readChunks:chunks.length,complete:true,evidenceCount:evidence.size};
}
/** Pure source-parser verification, never persisted facts or Electron acceptance.
 * Uses the actual TXT splitter, DOCX parser and C2 extractor on the controlled bytes.
 */
export async function sourceParserPreflight(fixtures,truth) {
  await import('../office-agent/register-source.mjs');
  const [{splitMaterialText},{parseWord},{wordText},{extractReferenceStructure},{extractReferenceWordLayout}]=await Promise.all([
    import('../../src/main/assets/material-chunks.ts'),import('../../src/main/assets/word-parser.ts'),import('../../src/shared/material-word.ts'),
    import('../../src/main/education/paper-reference-extract.ts'),import('../../src/main/education/paper-reference-word.ts')]);
  const observations=[];
  for(let i=0;i<fixtures.length;i++) {
    const fixture=fixtures[i],content=fixture.format==='txt'?fixture.bytes.toString('utf8'):wordText((await parseWord(fixture.bytes)).document.blocks);
    const resource={id:'resource_00000000-0000-4000-8000-00000000000'+(i+1),content_hash:truth[i].inputSha256,parse_engine:fixture.format==='txt'?'local-text-v1':'word-ooxml.v1'};
    const chunks=splitMaterialText(content).map((chunk,index)=>({id:'chunk_00000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),chunk_index:index,content_md:chunk.content,contains_personal_data:0}));
    const units=chunks.map((chunk,index)=>({resourceId:resource.id,version:resource.content_hash,title:fixture.fileName,offset:index,
      chunk:{id:chunk.id,chunkIndex:index,contentMd:chunk.content_md,containsPersonalData:false}}));
    const receipts=chunks.map((chunk,index)=>sourceReceipt(resource,chunk,index));
    const candidate=extractReferenceStructure({units,complete:true,totalChunks:chunks.length,parseEngine:resource.parse_engine,bodyDigest:sha256(JSON.stringify(receipts))});
    if(fixture.format==='docx')await extractReferenceWordLayout(fixture.bytes,candidate,new AbortController().signal);
    candidate.digest=sha256(JSON.stringify({...candidate,digest:''}));
    observations.push(assertReferenceCandidate(candidate,{fixture,truth:truth[i],resource,chunks}));
    for(const prefix of ['context_','body_']) {
      const corrupted=structuredClone(candidate),evidence=corrupted.evidence.find(item=>item.id.startsWith(prefix));assert(evidence);
      evidence.text+=' not-from-source';corrupted.digest=sha256(JSON.stringify({...corrupted,digest:''}));
      assert.throws(()=>assertReferenceCandidate(corrupted,{fixture,truth:truth[i],resource,chunks}),/exact bounded persisted chunk excerpt|exact persisted source chunk/);
    }
  }
  return {scope:'pure actual source functions on controlled input bytes; no DB/IPC/UI facts',observations};
}
