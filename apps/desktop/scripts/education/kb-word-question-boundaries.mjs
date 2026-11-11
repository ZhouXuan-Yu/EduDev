import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {wordFixture,mutateWord} from './word-fixtures.mjs';
const {parseWord}=await import('../../src/main/assets/word-parser.ts');
const {wordText,WORD_SCHEMA,WORD_PARSER}=await import('../../src/shared/material-word.ts');
const bytes=await wordFixture(),parsed=await parseWord(bytes),checks=[];
let api;
try {api=await import('../../src/main/assets/word-question-source.ts');}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('word-question-source.ts'))throw error;}
assert.equal(typeof api?.indexWordQuestions,'function','Word AI needs native question ranges; chunk text alone loses formula/table/image roles');
const {indexWordQuestions,verifyWordQuestionSource}=api;
const {wordQuestionBlocks,validWordQuestionSource,WORD_QUESTION_BYTES}=await import('../../src/shared/material-word-question.ts');
const pass=s=>{checks.push(s);console.log('PASS '+s);};
const walk=blocks=>blocks.flatMap(b=>b.kind==='table'?[b,...b.rows.flatMap(r=>r.cells.flatMap(c=>walk(c.blocks)))]:[b]);
const pictures=blocks=>walk(blocks).flatMap(b=>b.kind==='paragraph'?b.inlines.filter(i=>i.kind==='image'):[]);
const indexed=indexWordQuestions(parsed.document);
assert.equal(indexed.total,2);const first=indexed.read(1),second=indexed.read(2);
assert.equal(first.number,'1');assert.equal(second.number,'2');assert.equal(first.documentSha,createHash('sha256').update(JSON.stringify(parsed.document)).digest('hex'));
assert.equal(first.canonical.answer,'三分之一');assert.equal(first.canonical.analysis,'分子为1，分母为3。');
assert.equal(first.context,'学科：数学\n年级：初二\n知识点：分数运算\n题型：解答题\n难度：基础');
assert.equal(pictures(wordQuestionBlocks(first,'question')).length,1);assert.equal(pictures(wordQuestionBlocks(first,'answer')).length,0);
assert(wordText(wordQuestionBlocks(first,'question')).includes('\\frac{1}{3}'));
assert.equal(wordQuestionBlocks(second,'question').find(b=>b.kind==='table').rows.length,15);
assert.equal(second.assets[0].sha256,parsed.document.assets[0].sha256);
assert(first.blocks.every(b=>b.anchor.part==='word/document.xml'&&!Object.hasOwn(b.anchor,'page')));
assert(validWordQuestionSource(first));assert(verifyWordQuestionSource(first,parsed.document));pass('Real DOCX yields two native questions with complete formula, picture, table and separate answer/analysis source ranges');

let serial=0;const p=(text,extra={})=>({id:'wb_'+(++serial).toString(16).padStart(32,'0'),anchor:{part:'word/document.xml',path:'/document/body/p['+serial+']'},kind:'paragraph',inlines:[{kind:'text',text}],...extra});
const doc=blocks=>({schemaVersion:WORD_SCHEMA,parser:WORD_PARSER,blocks,assets:[],warnings:[]});
const image=parsed.document.assets[0],inline={kind:'image',assetId:image.id,alt:'来源图',issue:'',relationshipId:'rIdFixture',part:image.part};
const same=p('ignored',{inlines:[{kind:'text',text:'1. 求图中数值。\n【答案】'},inline,{kind:'text',text:'12【解析】按图计算。'}]});
const mixed=doc([same]);mixed.assets=[image];const split=indexWordQuestions(mixed).read(1);
assert.equal(pictures(wordQuestionBlocks(split,'question')).length,0);assert.equal(pictures(wordQuestionBlocks(split,'answer')).length,1);
assert.equal(pictures(wordQuestionBlocks(split,'analysis')).length,0);assert.equal(split.canonical.analysis,'按图计算。');
assert(!split.canonical.question.includes('答案'));assert(!split.canonical.answer.includes('解析'));assert.deepEqual(mixed.blocks,[same]);
assert(validWordQuestionSource(split));pass('One paragraph containing question, answer picture and analysis is split by exact inline ranges without mutating source or leaking answer pixels to student role');

const choices=indexWordQuestions(doc([p('1. 选择正确答案。\nA. 计算\nB. 答案：是选项内容\n【答案】B\n【解析】选择B。')])).read(1);
assert(choices.canonical.question.includes('答案：是选项内容'));assert.equal(choices.canonical.answer,'B');pass('An option containing the word answer stays in the question; only explicit role boundaries split it');

const multiple=indexWordQuestions(doc([p('1. 计算2+3。\n答案：5\n解析：相加。\n2. 计算3+4。\n答案：7\n解析：相加。')]));
assert.equal(multiple.total,2);assert.equal(multiple.read(1).canonical.answer,'5');assert.equal(multiple.read(2).canonical.answer,'7');assert(!multiple.read(1).canonical.analysis.includes('计算3'));pass('Multiple numbered questions in a Word paragraph preserve disjoint exact ranges');

const nested=indexWordQuestions(doc([p('求下列各式。',{numbering:{level:0,label:'第1题 '}}),p('先算小题。',{numbering:{level:1,label:'1.1 '}}),p('【答案】3'),p('【解析】先乘后加。')]));
assert.equal(nested.total,1);assert(nested.read(1).canonical.question.includes('先算小题'));pass('Nested automatic numbering stays inside its parent question');

const duplicate=indexWordQuestions(doc([p('1. 第一题。'),p('【答案】1'),p('1. 重启编号后的题。')]));
assert.equal(duplicate.total,2);assert(duplicate.read(1).issues.includes('ambiguous_number'));assert(duplicate.read(2).issues.includes('ambiguous_number'));pass('Repeated question numbers remain distinct source occurrences and explicitly ambiguous');

const supplement=structuredClone(parsed.document);supplement.blocks.push({...p('1. 页眉中的题号不属于上一题答案。'),anchor:{part:'word/header1.xml',path:'/hdr/p[1]'}});
const clean=indexWordQuestions(supplement);assert.equal(clean.total,2);assert(!clean.read(2).canonical.question.includes('页眉'));pass('Supplemental Word parts are not silently appended to the final question or treated as body questions');

const t={id:'wb_'+(++serial).toString(16).padStart(32,'0'),anchor:{part:'word/document.xml',path:'/document/body/tbl[1]'},kind:'table',rows:[{cells:[{colSpan:1,merge:'',blocks:[p('【答案】答案在表格内')]},{colSpan:1,merge:'',blocks:[p('1. 表内另一题。')]}]}]};
const table=indexWordQuestions(doc([p('1. 阅读表格。'),t])).read(1);assert(table.issues.includes('mixed_table_roles'));assert.equal(wordQuestionBlocks(table,'question')[1].rows.length,1);pass('Ambiguous question/answer layout inside tables is retained and blocks automatic qualification');

const answerBook=indexWordQuestions(doc([p('1. 计算1+1。'),p('参考答案与解析'),p('1. 2，解析：相加。'),p('2. 4，解析：倍增。')]));
assert.equal(answerBook.total,1);assert(answerBook.read(1).issues.includes('separate_answers'));assert(!answerBook.read(1).canonical.question.includes('相加'));pass('A separate answer section is not imported as invented new questions or silently attached to the last stem');

const unsupported=await parseWord(await mutateWord(bytes,async zip=>{const file='word/document.xml';zip.file(file,(await zip.file(file).async('string')).replace('<m:f>','<m:unsupported>').replace('</m:f>','</m:unsupported>'));}));
assert(indexWordQuestions(unsupported.document).read(1).issues.includes('formula_incomplete'));
const external=structuredClone(parsed.document);walk(external.blocks).find(b=>b.kind==='paragraph'&&b.inlines.some(i=>i.kind==='image')).inlines=[{...inline,assetId:'',issue:'external_image',part:''}];
assert(indexWordQuestions(external).read(1).issues.includes('image_missing'));pass('Unsupported formulas and missing external images remain source-backed but unqualified');

const stale=structuredClone(parsed.document);stale.blocks[1].inlines[0].text+='changed';assert(!verifyWordQuestionSource(first,stale));
const forged=structuredClone(first);forged.parts.question[0].blockId='wb_'+'0'.repeat(32);assert(!validWordQuestionSource(forged));assert(!verifyWordQuestionSource(forged,parsed.document));
const forgedRole=structuredClone(split);forgedRole.parts.question.push(forgedRole.parts.answer[0]);assert(!validWordQuestionSource(forgedRole));
const changedProjection=structuredClone(first);changedProjection.canonical.answer='假的答案';assert(!verifyWordQuestionSource(changedProjection,parsed.document));
const forgedSha=structuredClone(first);forgedSha.documentSha='a'.repeat(64);assert(!verifyWordQuestionSource(forgedSha,parsed.document));pass('Stale source, invented anchors, overlapping role ranges, altered canonical text and tampered document digest are rejected');

const special=indexWordQuestions(doc([p('1. 写出😀的含义。\n【答案】笑脸\n【解析】字符含义。')])).read(1),badOffset=structuredClone(special);
const text=special.blocks[0].inlines[0].text;badOffset.parts.question[0].to=text.indexOf('😀')+1;assert(!validWordQuestionSource(badOffset));pass('UTF16 source ranges may not split a surrogate pair');

const huge=indexWordQuestions(doc([p('1. '+ '大'.repeat(50000))]));assert.equal(huge.total,1);assert.equal(huge.summaries(0,5)[0].available,false);assert(huge.summaries(0,5)[0].issues.includes('too_large'));assert.throws(()=>huge.read(1),/too_large/);
assert(Buffer.byteLength(JSON.stringify(first))<=WORD_QUESTION_BYTES);assert.throws(()=>indexed.read(0),/invalid_input/);assert.throws(()=>indexed.read(3),/invalid_input/);assert.throws(()=>indexed.summaries(-1,5),/invalid_input/);pass('Oversized native questions stay visible as unavailable; they are never truncated or mistaken for complete');

assert.equal(indexWordQuestions(doc([p('学科：数学\n这是教案说明，没有编号习题。')])).total,0);
const many=indexWordQuestions(doc(Array.from({length:1000},(_,i)=>p(`${i+1}. 计算${i}+1。\n【答案】${i+1}\n【解析】加一。`))));assert.equal(many.total,1000);assert.equal(many.summaries(995,5).length,5);assert.equal(many.read(1000).canonical.answer,'1000');pass('Non-question prose is not fabricated into a question; a thousand source occurrences retain their tail and bounded paging');

const common=doc([p('',{inlines:[inline]}),p('1. 如图求角度。'),p('【答案】60度'),p('【解析】平行线性质。')]);common.assets=[image];const shared=indexWordQuestions(common).read(1);assert.equal(pictures(wordQuestionBlocks(shared,'question')).length,1);assert(shared.issues.includes('shared_context'));pass('A common diagram before the first question is retained with explicit unresolved scope, never reduced to a text-only placeholder');
const steps=indexWordQuestions(doc([p('第1题 已知图形求角。'),p('【答案】60度'),p('【解析】\n1. 先求内角。\n2. 再由平行线得到结论。')]));assert.equal(steps.total,1);assert(steps.read(1).canonical.analysis.includes('2. 再由平行线'));pass('Numbered reasoning steps inside analysis do not invent new questions');
const parens=indexWordQuestions(doc([p('1）计算1+1。\n【答案】2\n【解析】相加。'),p('2)计算2+2。\n【答案】4\n【解析】相加。')]));assert.equal(parens.total,2);pass('Common manually numbered Chinese and ASCII closing-parenthesis questions are recognized');
const colonBook=indexWordQuestions(doc([p('第1题 求1+1。'),p('参考答案：'),p('1. 2，相加即可。'),p('2. 4，倍增即可。')]));assert.equal(colonBook.total,1);assert(colonBook.read(1).issues.includes('separate_answers'));pass('An answer-book heading ending in a colon remains a separate source section');
const combined=doc([p('第1题 求图中角度。'),p('【答案与解析】'),p('',{inlines:[inline]})]);combined.assets=[image];const combo=indexWordQuestions(combined).read(1);assert.equal(pictures(wordQuestionBlocks(combo,'question')).length,0);assert.equal(pictures(wordQuestionBlocks(combo,'answer')).length,1);assert(combo.issues.includes('combined_roles'));pass('A combined answer/analysis heading cannot leak its picture into the question role');
const assets=Array.from({length:9},(_,i)=>({...image,id:'wa_'+(i+1).toString(16).padStart(64,'0'),sha256:(i+1).toString(16).padStart(64,'0'),part:'word/media/'+i+'.png'}));
const inlineMany=doc([p('',{inlines:[{kind:'text',text:'1. 读图求值。'},...assets.slice(0,1).map(a=>({...inline,assetId:a.id,part:a.part})),{kind:'text',text:'\n【答案】1\n【解析】第一题。\n2. 读另外八张图。'},...assets.slice(1).map(a=>({...inline,assetId:a.id,part:a.part})),{kind:'text',text:'\n【答案】8\n【解析】第二题。'}]})]);inlineMany.assets=assets;const bounded=indexWordQuestions(inlineMany);assert.equal(bounded.total,2);assert.equal(pictures(wordQuestionBlocks(bounded.read(1),'question')).length,1);assert.equal(pictures(wordQuestionBlocks(bounded.read(2),'question')).length,8);pass('The image budget counts selected source ranges, not unrelated neighboring questions in the same paragraph');
const querySteps=indexWordQuestions(doc([p('第8题 求方程的根。'),p('【答案】2和3'),p('【解析】\n1. 计算判别式。\n2. 求方程的两个根。')]));assert.equal(querySteps.total,1);assert(querySteps.read(1).canonical.analysis.includes('求方程的两个根'));pass('Reasoning steps starting with calculation/query words still stay inside the analysis of the parent question');
const numericOptions=indexWordQuestions(doc([p('第8题 请选择正确的两个说法。'),p('1）两个角相等。'),p('2）两条边平行。'),p('【答案】1和2'),p('【解析】依据图形性质。')]));assert.equal(numericOptions.total,1);assert(numericOptions.read(1).canonical.question.includes('两条边平行'));assert.equal(numericOptions.read(1).canonical.answer,'1和2');pass('Numbered parenthesized options remain in their parent statement rather than becoming standalone questions');
const firstOptions=indexWordQuestions(doc([p('第1题 请选择正确的两个说法。'),p('1）三角形有三个角。'),p('2）正方形有四条边。'),p('【答案】1和2'),p('【解析】依据图形定义。'),p('2）计算1+1。'),p('【答案】2'),p('【解析】相加。')]));assert.equal(firstOptions.total,2);assert(firstOptions.read(1).canonical.question.includes('正方形有四条边'));assert.equal(firstOptions.read(1).canonical.answer,'1和2');assert.equal(firstOptions.read(2).canonical.answer,'2');pass('Numeric option-list context persists above the parent ordinal and ends at a role boundary before the next real question');
const headerOnly=doc([{...p('第1题 这是页眉说明，不是正文习题。'),anchor:{part:'word/header1.xml',path:'/hdr[0]/p[0]'}}]);headerOnly.warnings=['supplemental_part'];assert.equal(indexWordQuestions(headerOnly).total,0);pass('An empty document body with only a header never fabricates a body question from the first remaining part');

// Versioned parser evidence must distinguish a warning elsewhere from this question.
const scopedDoc=blocks=>({...doc(blocks),unscopedWarnings:[]});
const scoped=scripted=>scopedDoc([p('2026学年高三物理试卷'),p('学科：物理\n年级：高三'),...scripted]);
const local= scoped([p('第1题 计算1+1。'),p('第2题 判断另一题。',{warnings:['field_or_symbol']}),{...p('页脚页码'),anchor:{part:'word/footer1.xml',path:'/ftr/p[1]'},warnings:['field_or_symbol']}]);local.warnings=['field_or_symbol','supplemental_part'];
const localIndex=indexWordQuestions(local),cleanSource=localIndex.read(1);
assert.deepEqual(cleanSource.issues,[]);assert.equal(cleanSource.indexPolicy,'word-question-scoped.v2');
assert.equal(cleanSource.canonical.question,'第1题 计算1+1。');assert(cleanSource.context.includes('高三物理试卷'));
assert(localIndex.read(2).issues.includes('source_warning'));assert(verifyWordQuestionSource(cleanSource,local));
assert.deepEqual(local.warnings,['field_or_symbol','supplemental_part']);
pass('Scoped Word warnings preserve the document aggregate and hold the actual affected question while clean body text and plain metadata remain separate');
const global=structuredClone(local);global.warnings.push('tracked_changes');global.unscopedWarnings.push('tracked_changes');
assert(indexWordQuestions(global).read(1).issues.includes('source_warning'));
const legacy=structuredClone(local);legacy.parser='word-ooxml.v1';delete legacy.unscopedWarnings;for(const block of walk(legacy.blocks))delete block.warnings;
const legacySource=indexWordQuestions(legacy).read(1);assert(legacySource.issues.includes('source_warning'));assert(legacySource.issues.includes('shared_context'));assert.equal(legacySource.indexPolicy,undefined);
assert(verifyWordQuestionSource(legacySource,legacy));
pass('Unlocated document warnings remain global and old v1 source grouping remains byte-stable instead of inheriting the new policy');
for(const condition of ['本卷g=10m/s²。','已知所有小球质量都是2kg。','阅读材料后回答问题。','速度分别为10、20、30。','200504']){
 const material=scoped([p(condition),p('第1题 求解。')]);const source=indexWordQuestions(material).read(1);assert(source.issues.includes('shared_context'),condition);assert(source.canonical.question.includes(condition),condition);
}
const sharedFigure=scoped([p('',{inlines:[inline]}),p('第1题 如图求角度。')]);sharedFigure.assets=[image];const visualSource=indexWordQuestions(sharedFigure).read(1);assert(visualSource.issues.includes('shared_context'));assert.equal(pictures(wordQuestionBlocks(visualSource,'question')).length,1);
pass('Global physical conditions, prose, uncertain numeric context and diagrams remain in complete question provenance and retain shared-context review');
const {nativeMetadata}=await import('../../src/main/assets/material-ai-native-context.ts');
assert.equal(nativeMetadata(cleanSource)['资料上下文'],cleanSource.context);assert.equal(nativeMetadata(cleanSource)['年级'],'高三');
assert.equal(nativeMetadata(legacySource)['资料上下文'],undefined);
const changed=structuredClone(cleanSource);changed.context='另一份资料';assert(!verifyWordQuestionSource(changed,local));
assert(!validWordQuestionSource({...cleanSource,indexPolicy:'future'}));
pass('Native AI receives source-bound preamble context only under the new frozen policy and changed or unknown context policies are refused');
const {DatabaseSync}=await import('node:sqlite');const {MaterialWordRepository}=await import('../../src/main/assets/material-word-repository.ts');
const database=new DatabaseSync(':memory:');try{
 database.exec('CREATE TABLE material_word_documents(resource_id TEXT PRIMARY KEY,version TEXT,parser TEXT,digest TEXT,document_json TEXT)');
 const rid='resource_00000000-0000-4000-8000-000000000001',version='a'.repeat(64),resource={contentHash:version,parseStatus:'ready'};
 const repository=new MaterialWordRepository({root:()=>process.cwd(),all:async(q,args=[])=>database.prepare(q).all(...args),run:async(q,args=[])=>{database.prepare(q).run(...args);},resource:async()=>resource});
 await repository.commit(rid,version,legacy);assert.equal((await repository.document(rid,version)).parser,'word-ooxml.v1');assert.equal(database.prepare('SELECT parser FROM material_word_documents').get().parser,'word-ooxml.v1');
 assert.deepEqual(await repository.document(rid,version),legacy);assert(verifyWordQuestionSource(legacySource,await repository.document(rid,version)));
 await repository.commit(rid,version,local);assert.equal((await repository.document(rid,version)).parser,WORD_PARSER);
 database.prepare("UPDATE material_word_documents SET parser='word-ooxml.v1'").run();await assert.rejects(repository.document(rid,version),/source_changed/);
}finally{database.close();}
pass('Actual SQLite Word repository cold-reads v1 and v2 using the stored parser, preserves old source identities and rejects parser/JSON disagreement');
console.log(JSON.stringify({passed:checks.length,checks,scope:'Native Word grouping/role/source integrity only; not AI recognition, question-bank delivery or enterprise scale proof'}));
