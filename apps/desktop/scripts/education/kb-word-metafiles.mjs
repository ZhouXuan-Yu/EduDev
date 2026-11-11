import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {wordFixture,wordFixtureImage,mutateWord} from './word-fixtures.mjs';
import {nativePicture} from './word-question-fixtures.mjs';
const {parseWord}=await import('../../src/main/assets/word-parser.ts');
const {completeWordMetafiles}=await import('../../src/main/assets/word-metafiles.ts');
const {wordUpgradeCompatible}=await import('../../src/main/assets/word-upgrade-compatible.ts');
const {WORD_UPGRADE_INDEX,WORD_UPGRADE_PREDICATE}=await import('../../src/main/assets/word-upgrade-compatible.ts');
const {MaterialWordRepository}=await import('../../src/main/assets/material-word-repository.ts');
const {validWordResult,validWordDocument,wordText}=await import('../../src/shared/material-word.ts');
const {indexWordQuestions}=await import('../../src/main/assets/word-question-source.ts');
const {validWordQuestionSource}=await import('../../src/shared/material-word-question.ts');
const {NATIVE_PROJECTION_INSTRUCTION,parseNativeAiResponse}=await import('../../src/shared/material-ai-native-response.ts');
const {validQuestionProjection}=await import('../../src/shared/question-projection.ts');
const {METAFILE_SCHEMA,METAFILE_ENGINE,WORD_IMAGE_POLICY,validMetafileReceipt}=await import('../../src/shared/material-metafile.ts');
const hash=data=>createHash('sha256').update(data).digest('hex');
// A placeable WMF header is sufficient for parser boundary tests. Native rendering
// is separately exercised by the Windows worker test and current natural corpus.
const vector=Buffer.alloc(40);vector.writeUInt32LE(0x9ac6cdd7);vector.writeUInt16LE(1440,14);
const original=await mutateWord(await wordFixture(),async zip=>{
  for(const name of Object.keys(zip.files).filter(name=>name.startsWith('word/media/')&&!zip.files[name].dir))zip.file(name,vector);
});
const payload=await parseWord(original),signal=new AbortController().signal;
const receipt=items=>({schemaVersion:METAFILE_SCHEMA,ok:true,engine:METAFILE_ENGINE,items:items.map(item=>({inputSha256:item.sha256,ok:true,sha256:hash(wordFixtureImage),width:1,height:1,png:wordFixtureImage.toString('base64')}))});
const walk=blocks=>blocks.flatMap(block=>block.kind==='table'?[block,...block.rows.flatMap(row=>row.cells.flatMap(cell=>walk(cell.blocks)))]:[block]);
const pictures=doc=>walk(doc.blocks).flatMap(block=>block.kind==='paragraph'?block.inlines.filter(inline=>inline.kind==='image'):[]);
const checks=[];
async function check(name,action){await action();checks.push(name);console.log('PASS '+name);}
await check('Magic identifies vector media and binds transient source bytes without publishing them as an image',()=>{
  assert.equal(payload.document.assets.length,0);assert.equal(payload.metafiles.length,1);
  assert.equal(payload.metafiles[0].sha256,hash(vector));assert(pictures(payload.document).every(image=>image.issue==='unsupported_image'&&!image.assetId));
  assert(validWordResult({schemaVersion:'xiaozhi.word-source.v1',requestId:'id',ok:true,payload},'id'));
});
let completed;
await check('One authenticated conversion completes every repeated body/table occurrence and preserves original text and roles',async()=>{
  let calls=0;completed=await completeWordMetafiles(payload,signal,async items=>{calls++;assert.equal(items.length,1);return receipt(items);});
  assert.equal(calls,1);assert.equal(completed.metafiles,undefined);assert.equal(completed.document.assets.length,1);
  assert.equal(completed.document.imagePolicy,WORD_IMAGE_POLICY);assert(validWordDocument(completed.document));
  assert(pictures(completed.document).every(image=>image.assetId&&image.metafile.sha256===hash(vector)&&!image.issue));
  assert.equal(wordText(completed.document.blocks),wordText(payload.document.blocks));assert(wordUpgradeCompatible(payload.document,completed.document));
  for(let ordinal=1;ordinal<=2;ordinal++)assert(validWordQuestionSource(indexWordQuestions(completed.document).read(ordinal)));
});
await check('Source hashes, receipt identity, order, dimensions and PNG bytes are checked before completion',async()=>{
  const changed=structuredClone(payload);changed.metafiles[0].data[4]^=1;
  await assert.rejects(completeWordMetafiles(changed,signal,async items=>receipt(items)),/source_changed/);
  for(const mutate of [item=>item.inputSha256='f'.repeat(64),item=>item.sha256='f'.repeat(64),item=>item.width=2,item=>item.png=Buffer.from('bad').toString('base64')]){
    await assert.rejects(completeWordMetafiles(payload,signal,async items=>{const value=receipt(items);mutate(value.items[0]);return value;}));
  }
});
await check('Empty, missing-font, malformed and oversized images stay source-backed and cannot become qualified images',async()=>{
  for(const error of ['empty','font_missing','invalid_input','too_large','parse_failed']){
    const failed=await completeWordMetafiles(payload,signal,async items=>({...receipt(items),items:items.map(item=>({inputSha256:item.sha256,ok:false,error}))}));
    assert.equal(failed.document.assets.length,0);assert(pictures(failed.document).every(image=>!image.assetId&&image.issue==='metafile_'+error));
    assert(indexWordQuestions(failed.document).read(1).issues.includes('image_missing'));assert(wordUpgradeCompatible(payload.document,failed.document));
  }
});
await check('Cancellation and component failure do not mutate parser evidence or publish partial assets',async()=>{
  const before=JSON.stringify(payload),controller=new AbortController();controller.abort();
  await assert.rejects(completeWordMetafiles(payload,controller.signal,async()=>{throw Error('Must not dispatch');}));
  await assert.rejects(completeWordMetafiles(payload,signal,async()=>{throw Error('unavailable');}),/unavailable/);
  assert.equal(JSON.stringify(payload),before);
});
await check('Compatibility rejects changed source text, anchors, original images, orphan assets and unsupported substitutions',()=>{
  for(const mutate of [doc=>doc.blocks[0].inlines[0].text+='changed',doc=>doc.blocks[0].anchor.path+='/changed',doc=>doc.assets.push({...doc.assets[0],id:'wa_'+'a'.repeat(64),sha256:'a'.repeat(64)}),doc=>pictures(doc)[0].part='word/media/other.wmf',doc=>delete pictures(doc)[0].metafile]){
    const changed=structuredClone(completed.document);mutate(changed);assert(!wordUpgradeCompatible(payload.document,changed));
  }
  const unknown=structuredClone(completed.document);pictures(unknown)[0].metafile.engine='unknown';assert(!validWordDocument(unknown));
  const legacy=structuredClone(completed.document);delete legacy.imagePolicy;assert(!validWordDocument(legacy));
});
await check('Conversion batches remain bounded for many distinct media and receipts cannot omit an item',async()=>{
  const many=structuredClone(payload);many.metafiles=Array.from({length:33},(_,i)=>{const data=Buffer.from(vector);data[5]=i;return{part:'word/media/test'+i+'.wmf',data,sha256:hash(data)};});
  const sizes=[];await completeWordMetafiles(many,signal,async items=>{sizes.push(items.length);return receipt(items);});assert.deepEqual(sizes,[16,16,1]);
  await assert.rejects(completeWordMetafiles(payload,signal,async items=>({...receipt(items),items:[]})),/parse_failed/);
  assert(!validMetafileReceipt({...receipt([{sha256:hash(vector)}]),engine:'unknown'}));
  assert(!validMetafileReceipt({...receipt([{sha256:hash(vector)}]),extra:true}));
  const extra=receipt([{sha256:hash(vector)}]);extra.items[0].extra=true;assert(!validMetafileReceipt(extra));
});
await check('Existing booklet documents upgrade images once through SQLite while old sources and new PNG survive reopening',async()=>{
  const root=await fs.mkdtemp(path.join(tmpdir(),'omni-word-metafile-')),db=new DatabaseSync(':memory:');
  const id='resource_00000000-0000-4000-8000-000000000001',version=hash(original),previous=structuredClone(payload.document);delete previous.imagePolicy;
  let repository,parses=0;
  const host={root:()=>root,all:async(sql,values=[])=>db.prepare(sql).all(...values),run:async(sql,values=[])=>{db.prepare(sql).run(...values);},
    resource:async()=>({id,contentHash:version,parseStatus:'ready'}),verify:async()=>{},stamp:async()=>version,
    parse:async()=>{parses++;return completed;},writer:async(action,beforeCommit)=>{db.exec('BEGIN IMMEDIATE');try{const value=await action(repository);beforeCommit?.();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}}};
  try{
    repository=new MaterialWordRepository(host);await repository.migrate();await repository.commit(id,version,previous);
    const digest=hash(JSON.stringify(previous)),query={schemaVersion:'xiaozhi.word-question-source.v1',resourceId:id,version,offset:0,ordinal:1};
    const old=(await repository.questions(query)).source;
    const pending=()=>db.prepare(`SELECT count(*) n FROM material_word_documents INDEXED BY ${WORD_UPGRADE_INDEX} WHERE ${WORD_UPGRADE_PREDICATE}`).get().n;
    assert.equal(pending(),1);assert.equal(await repository.upgrade(id,version,signal),true);assert.equal(pending(),0);
    assert.equal(await repository.upgrade(id,version,signal),false);assert.equal(parses,1);
    repository=new MaterialWordRepository(host);await repository.migrate();
    assert.deepEqual((await repository.questions(query,digest)).source,old);
    const latest=(await repository.questions(query)).source;assert(validWordQuestionSource(latest));assert.notEqual(latest.documentSha,digest);
    const image=await repository.image({schemaVersion:'xiaozhi.word-source.v1',resourceId:id,version,assetId:completed.document.assets[0].id});
    assert.equal(image.dataUrl,'data:image/png;base64,'+wordFixtureImage.toString('base64'));
    await assert.rejects(repository.prepare(payload,signal),/parse_failed/);
  }finally{db.close();}
});
await check('A corrected renderer replaces source-bound legacy rasters while their old identities remain valid history',async()=>{
  const legacy=structuredClone(completed.document);legacy.imagePolicy='word-metafile.v1';
  for(const image of pictures(legacy))image.metafile.engine='pillow-12.3.0-gdi-144dpi.v1';
  assert(validWordDocument(legacy));
  const next=await completeWordMetafiles(payload,signal,async items=>({...receipt(items),items:items.map(item=>({inputSha256:item.sha256,ok:true,sha256:hash(nativePicture),width:8,height:8,png:nativePicture.toString('base64')}))}));
  assert(wordUpgradeCompatible(legacy,next.document));
  const failed=await completeWordMetafiles(payload,signal,async items=>({...receipt(items),items:items.map(item=>({inputSha256:item.sha256,ok:false,error:'font_missing'}))}));
  assert(wordUpgradeCompatible(legacy,failed.document));
  const forged=structuredClone(next.document);pictures(forged)[0].metafile.sha256='f'.repeat(64);assert(!wordUpgradeCompatible(legacy,forged));
});
await check('Native prompt demonstrates typed projection fields while the response parser continues to reject scalar substitutions',()=>{
  const example=JSON.parse(NATIVE_PROJECTION_INSTRUCTION.slice(NATIVE_PROJECTION_INSTRUCTION.indexOf('{'),NATIVE_PROJECTION_INSTRUCTION.lastIndexOf('}')+1));
  assert(validQuestionProjection(example));assert.match(NATIVE_PROJECTION_INSTRUCTION,/不能写成字符串/);
  assert.throws(()=>parseNativeAiResponse(JSON.stringify({schemaVersion:'xiaozhi.material-ai-native-response.v1',outcome:'questions',questions:[{projection:{statement:'plain text'}}]})),/invalid_response/);
});
console.log(JSON.stringify({passed:checks.length,checks,scope:'Word parsing, media completion, source validation and upgrade boundaries. Native Windows rendering is verified separately.'}));
