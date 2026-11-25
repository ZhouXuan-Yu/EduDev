import '../office-agent/register-source.mjs';import assert from 'node:assert/strict';import path from 'node:path';import os from 'node:os';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const {bookAnswerPage,bookSectionKey}=await import('../../src/main/assets/material-book-answer-content.ts');const {parseAiPageResponse,pageTranscriptionStatus,pageResponseMatchesPolicy,MATERIAL_AI_BOOK_PAGE_RESPONSE,MATERIAL_BOOK_PAGE_POLICY}=await import('../../src/shared/material-ai-page.ts');
const response=(text,issues=[])=>({schemaVersion:'xiaozhi.material-ai-page-response.v1',outcome:'no_questions',questions:[],pageText:text,pageIssues:issues}),text='第十三、十四章 素养基础测试卷\n1.D 已知原文解释。\n2.答案 42\n解析 由条件计算得42。\n第十三、十四章 素养提优测试卷\n1.B 已知另一份解释。';let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
check('Same number in different full exam titles stays in separate groups',()=>{const v=bookAnswerPage(response(text),response(text));assert.equal(v.entries.length,3);const ones=v.entries.filter(e=>e.number==='1');assert.deepEqual(ones.map(e=>e.answer),['D','B']);assert.notEqual(ones[0].sectionKey,ones[1].sectionKey);assert(v.entries.every(e=>e.agrees));});
check('Title normalization preserves different chapter/test words and mathematical identities',()=>{assert.equal(bookSectionKey('第十三章 · 基础测试卷'),bookSectionKey('第十三章基础测试卷'));assert.notEqual(bookSectionKey('第十三章基础测试卷'),bookSectionKey('第十四章基础测试卷'));});
check('Duplicate numbering within one exam is never unique despite equal answers',()=>{const s='第十三章 素养基础测试卷\n1.D 解释。\n1.D 解释。';const v=bookAnswerPage(response(s),response(s));assert(v.entries.every(e=>e.issues.includes('duplicate_number')&&!e.agrees));});
check('A missing section is explicit and never inherited from an unrelated page',()=>{const v=bookAnswerPage(response('1.D 解释。'),response('1.D 解释。'));assert.equal(v.entries[0].section,'');assert(v.entries[0].issues.includes('missing_section'));});
check('Whitespace never merges digit boundaries or mathematical superscripts',()=>{for(const [a,b]of [['1 2','12'],['x²','x2']]){const head='第十三章 素养基础测试卷\n1.答案 ';const v=bookAnswerPage(response(head+a+'\n解析 已知。'),response(head+b+'\n解析 已知。'));assert(!v.entries[0].agrees);assert(v.entries[0].issues.includes('transcription_disagreement'));}});
check('Equal answers with different analysis remain a two-pass disagreement',()=>{const a='第十三章 素养基础测试卷\n1.D 由热传递改变。',b=a.replace('热传递','做功');assert(!bookAnswerPage(response(a),response(b)).entries[0].agrees);});
check('Entries missing from the second pass remain visible as omissions',()=>{const v=bookAnswerPage(response(text),response(text.split('第十三、十四章 素养提优测试卷')[0].trim()));assert.equal(v.firstOnly.length,1);assert.equal(v.firstOnly[0].number,'1');});
check('Page uncertainty applies to every entry even when those entries agree',()=>{const v=bookAnswerPage(response(text,['uncertain_ocr']),response(text));assert(v.pageUncertain);assert(v.entries.every(e=>e.issues.includes('page_uncertainty')));});
check('Missing answers and missing analysis are never filled or inferred',()=>{const s='第十三章 素养基础测试卷\n1.解析 原文只有解析。\n2.D';const v=bookAnswerPage(response(s),response(s));assert.equal(v.entries[0].answer,'');assert(v.entries[0].issues.includes('missing_answer'));assert.equal(v.entries[1].analysis,'');assert(v.entries[1].issues.includes('missing_analysis'));});
check('An unfinished final analysis stays cross-page instead of being completed by the parser',()=>{const s='第十三章 素养基础测试卷\n1.D 由图可知物体的温度';const v=bookAnswerPage(response(s),response(s));assert(v.entries[0].issues.includes('cross_page'));assert.equal(v.entries[0].analysis,'由图可知物体的温度');});
check('Explicit advertisements and unnumbered unsupported formats remain empty',()=>{for(const s of ['本页为广告页，打印前可以把这页删掉\n第十三章 素养基础测试卷\n1.D 解释。','答案速查\n1 2 3\nD B C'])assert.equal(bookAnswerPage(response(s),response(s)).status,'unstructured');});
check('A chapter on the line immediately before the title is preserved',()=>{const s='第十三章\n素养基础测试卷\n1.D 解释。';assert.equal(bookAnswerPage(response(s),response(s)).entries[0].section,'第十三章 素养基础测试卷');});
check('Over-limit input and too many entries return no partial list',()=>{for(const s of ['x'.repeat(64001),'第十三章 素养基础测试卷\n'+Array.from({length:201},(_,i)=>(i+1)+'.D 解释。').join('\n')]){const v=bookAnswerPage(response(s),response(s));assert.equal(v.status,'too_large');assert.equal(v.entries.length,0);}});
check('All displayed quotes map exactly into final saved text and raw responses are untouched',()=>{const first=response(text),final=response(text),before=JSON.stringify([first,final]),v=bookAnswerPage(first,final);for(const e of v.entries)assert.equal(text.slice(e.start,e.end).trim(),e.quote);assert.equal(JSON.stringify([first,final]),before);});
const scoped=(body,answerIssues=[],pageIssues=[],outcome=answerIssues.length||pageIssues.length?'needs_review':'no_questions')=>parseAiPageResponse(JSON.stringify({schemaVersion:MATERIAL_AI_BOOK_PAGE_RESPONSE,outcome,questions:[],pageText:body,pageIssues,answerIssues}));
const section='第十三、十四章 素养基础测试卷',other='第十三、十四章 素养提优测试卷',local={section,number:'2',issues:['uncertain_ocr']};
const {MATERIAL_BOOK_PAGE_LABEL_POLICY,MATERIAL_BOOK_PAGE_TABLE_POLICY}=await import('../../src/shared/material-ai-page.ts');
const {shanghaiMockSectionKey,WRAPPED_SHANGHAI_MOCK_SECTIONS}=await import('../../src/shared/shanghai-mock-sections.ts');
const {printedSingleChoiceRange}=await import('../../src/main/assets/material-compact-choice-key.ts');
const {localCompactChoicePage}=await import('../../src/main/assets/material-book-answer-content.ts');
const {independentChoiceLetters,independentNumberedChoice,locateLocalChoiceRow}=await import('../../src/main/assets/material-local-book-choice-layout.ts');
const {numberedChoiceRows}=await import('../../src/main/assets/material-numbered-choice-answers.ts');
const {bookPageRestorationInstruction}=await import('../../src/main/assets/material-ai-book-instruction.ts');
const printed=(first,final=first)=>bookAnswerPage(scoped(first),scoped(final),undefined,MATERIAL_BOOK_PAGE_LABEL_POLICY);
check('Printed brackets after repeated question text recover literal answer and analysis only for new inputs',()=>{
 const source=section+'\n1. 设x²=16，x为正数。\n【参考答案】4\n【解析】由题意，x=4。';
 const proof=scoped(source),old=bookAnswerPage(proof,proof,undefined,MATERIAL_BOOK_PAGE_TABLE_POLICY).entries[0];
 assert.equal(old.answer,'');assert.equal(old.analysis,'');
 const [candidate]=printed(source).entries;
 assert.equal(candidate.answer,'4');assert.equal(candidate.analysis,'由题意，x=4。');
 assert.equal(candidate.quote,source.slice(candidate.start,candidate.end).trim());
 assert(!candidate.issues.length&&candidate.agrees);
 assert(pageResponseMatchesPolicy(proof,MATERIAL_BOOK_PAGE_LABEL_POLICY,true));
 assert(!pageResponseMatchesPolicy(proof,MATERIAL_BOOK_PAGE_LABEL_POLICY,false));
 assert(bookPageRestorationInstruction('page',MATERIAL_BOOK_PAGE_LABEL_POLICY).includes('实际印刷的【答案】【解析】'));
 assert(!bookPageRestorationInstruction('page',MATERIAL_BOOK_PAGE_TABLE_POLICY).includes('实际印刷的【答案】【解析】'));
});
check('Same-line labels and mixed plain and bracket markers preserve literal fields',()=>{
 const source=section+'\n1. [答案]B［解析］选项B成立。\n2. 答案：x²\n【解析】保留上标。\n3. C【解答】选项C成立。';
 assert.deepEqual(printed(source).entries.map(e=>[e.answer,e.analysis,e.issues]),
  [['B','选项B成立。',[]],['x²','保留上标。',[]],['C','选项C成立。',[]]]);
});
check('A missing answer, a bare reference, and uncorroborated interpretation stay held',()=>{
 const source=section+'\n1. 复制的题干\n【解析】原文只有解析。\n2. 【答案】（1）12（2）见解析\n【解析】分两问逐步求解。';
 const result=printed(source);
 assert(result.entries.every(e=>e.answer===''&&e.issues.includes('missing_answer')));
 assert(result.entries.every(e=>e.quote.includes('【解析】')));
 for(const ref of ['见解答过程','详见解析步骤','见本题详解部分']){
  const [candidate]=printed(section+'\n1. 【答案】'+ref+'\n【解析】逐步计算。').entries;
  assert.equal(candidate.answer,'');assert(candidate.issues.includes('missing_answer'));
 }
 const changed=section+'\n1.【答案】8\n【解析】由原图计算。';
 assert(printed(changed,changed.replace('】8','】9')).entries[0].issues.includes('transcription_disagreement'));
 assert(printed(changed,changed.replace('原图','公式')).entries[0].issues.includes('transcription_disagreement'));
});
check('Duplicate, reversed, broken, or quoted inline labels never supply a fact',()=>{
 for(const entry of ['1. 【答案】A【答案】D','1. 【解析】由题意。【答案】D','1. 【答案】A\n【解析 B。',
  '1. 题面要求抄写【答案】及含义。','1. 【答案】4\n【解题思路】另一段。',
  '1. 【答案】4\n【解析】由题意。\n【参考解答】应为5。']){
  const row=printed(section+'\n'+entry).entries[0];
  assert.equal(row.answer,'');assert(row.issues.includes('answer_conflict'));
 }
 const [explained]=printed(section+'\n1. 【答案】4\n【详解】正确推理。').entries;
 assert.equal(explained.answer,'4');assert.equal(explained.analysis,'正确推理。');assert.deepEqual(explained.issues,[]);
 const [short]=printed(section+'\n1. 【答】4\n【解】由题意，x=4。').entries;
 assert.equal(short.answer,'4');assert.equal(short.analysis,'由题意，x=4。');assert.deepEqual(short.issues,[]);
});
check('Version four retains answer table matching and holds real section and page uncertainty',()=>{
 const table=section+'\n答案速查\n1 2\nA B';
 assert.deepEqual(printed(table).entries.map(e=>e.answer),['A','B']);
 const uncert=scoped('1. 题干\n【答案】B\n【解析】由题意。',[],['uncertain_ocr']);
 const [candidate]=bookAnswerPage(uncert,uncert,undefined,MATERIAL_BOOK_PAGE_LABEL_POLICY).entries;
 assert(candidate.issues.includes('missing_section')&&candidate.issues.includes('page_uncertainty'));
});
check('A wrapped exam heading scopes a literal answer grid without losing the separate table label',()=>{
 const heading='2025年上海市静安区\n初三数学二模\n参考答案（乙卷）';
 const source=heading+'\n选择题答案\n3 4\nA B';
 const first=scoped(source.replace(heading,heading.replaceAll('\n','')));
 const result=bookAnswerPage(first,scoped(source),undefined,MATERIAL_BOOK_PAGE_LABEL_POLICY,true);
 assert.deepEqual(result.entries.map(e=>[e.number,e.answer,e.section]),[['3','A',heading],['4','B',heading]]);
 assert(result.entries.every(e=>e.agrees&&e.quote===source.slice(e.start,e.end)));
});
check('A separated or foreign cover cannot leave its answer under a previous Shanghai scope',()=>{
 const first='2025年上海市静安区初三数学二模参考答案';
 for(const incomplete of ['2025年上海市长宁区\n\n初三数学二模参考答案','2025年江苏省南京市\n初三数学二模参考答案']){
  const raw=scoped(first+'\n1. D\n解析：前一份。\n'+incomplete+'\n2. B\n解析：另一份。');
  const result=bookAnswerPage(raw,raw,undefined,MATERIAL_BOOK_PAGE_LABEL_POLICY,true);
  assert.deepEqual(result.entries.map(e=>[e.number,e.section]),[['1',first],['2','']]);
 }
});
check('An incomplete heading cannot absorb a new independently dated exam',()=>{
 const actual='2025年上海市静安区初三数学二模参考答案';
 const raw=scoped('2026年上海市长宁区\n'+actual+'\n1. D\n解析：该卷答案。');
 const [entry]=bookAnswerPage(raw,raw,undefined,MATERIAL_BOOK_PAGE_LABEL_POLICY,true).entries;
 assert.equal(entry.section,actual);
 assert(entry.agrees);
});
check('District term covers match across role placement and line wrapping while retaining the printed event',()=>{
 const paper='松江区2024学年度第一学期期末质量监控试卷\n高三数学';
 const answers='上海市松江区 2024—2025 学年 第1学期 期末质量监控试卷\n高三年级数学参考答案';
 const key=shanghaiMockSectionKey(paper);
 assert(key);
 assert.equal(key,shanghaiMockSectionKey(answers));
 assert.equal(shanghaiMockSectionKey(paper,WRAPPED_SHANGHAI_MOCK_SECTIONS),undefined);
 const second='黄浦区2024学年度第一学期高三年级期终调研测试\n数学试卷';
 assert.equal(shanghaiMockSectionKey(second),shanghaiMockSectionKey(second.replace('数学试卷','数学参考答案')));
 assert.notEqual(shanghaiMockSectionKey(second),shanghaiMockSectionKey('2025年上海黄浦区高三数学一模答案解析'));
 for(const altered of [answers.replaceAll('松江','金山'),answers.replace('第1学期','第2学期'),answers.replace('2024—2025','2023—2024'),
  answers.replace('质量监控','质量检测'),answers.replace('高三','高二'),answers.replace('数学','物理'),answers+'（乙卷）']){
  assert(shanghaiMockSectionKey(altered));
  assert.notEqual(shanghaiMockSectionKey(altered),key);
 }
 for(const invalid of [answers.replace('2024—2025','2024—2026'),answers.replace('试卷','（A卷）试卷')+'（B卷）',
  answers.replace('松江','鼓楼'),answers.replace('数学','')])assert.equal(shanghaiMockSectionKey(invalid),undefined);
});
check('District term heading boundaries prevent borrowing a prior scope over an incomplete or foreign cover',()=>{
 const title='松江区2024学年度第一学期期末质量监控试卷\n高三数学答案';
 const first=scoped(title+'\n1. D\n解析：本卷内容。');
 const same=scoped(first.pageText.replace('试卷\n高三','试卷高三'));
 assert.deepEqual(bookAnswerPage(same,first,undefined,MATERIAL_BOOK_PAGE_LABEL_POLICY,true).entries.map(e=>[e.section,e.agrees]),[[title,true]]);
 for(const partial of ['青浦区2025学年度第二学期期末质量监控试卷\n\n高三数学答案',
  '南京市鼓楼区2025学年度第二学期期末质量监控试卷\n高三数学答案']){
  const proof=scoped(first.pageText+'\n'+partial+'\n2. B\n解析：另一份。');
  assert.deepEqual(bookAnswerPage(proof,proof,undefined,MATERIAL_BOOK_PAGE_LABEL_POLICY,true).entries.map(e=>[e.number,e.section]),[['1',title],['2','']]);
 }
});
check('Compact choice keys retain literal letters and require neighboring markers or a complete printed range',()=>{
 const title='松江区2024学年度第一学期期末质量监控试卷\n高三数学答案';
 const body='\n一、填空题\n12. 4.96\n二、选择题：ＤＣＣＡ\n微\n三、解答题\n17. 解：略。';
 const source=scoped(title+body);
 const answers=(first,final=first)=>bookAnswerPage(first,final,undefined,MATERIAL_BOOK_PAGE_LABEL_POLICY,true);
 const selected=answers(source).entries.filter(row=>row.compactChoiceRange);
 assert.deepEqual(selected.map(row=>[row.number,row.answer]),[['13','D'],['14','C'],['15','C'],['16','A']]);
 assert(selected.every(row=>row.agrees&&row.quote===source.pageText.slice(row.start,row.end)));
 assert.equal(new Set(selected.map(row=>row.start)).size,4);
 const wrongLetters=answers(source,scoped(source.pageText.replace('ＤＣＣＡ','ＤＢＣＡ'))).entries.find(row=>row.number==='14');
 assert(wrongLetters.issues.includes('transcription_disagreement'));
 const numbered=scoped(title+'\n选择题答案（第21～24题）：B、D、D、C');
 assert.deepEqual(answers(numbered).entries.map(row=>row.number),['21','22','23','24']);
 for(const incomplete of [body.replace('12.','11.'),body.replace('17.','18.'),body.replace('ＤＣＣＡ','ＤＣ？Ａ'),
  body.replace('三、解答题','不清楚'),body.replace('一、填空题','其他内容'),body.replace('微','请核对另一张卷')]){
  const page=answers(scoped(title+incomplete));
  assert(!page.entries.some(row=>row.compactChoiceRange));
  assert.equal(page.unresolvedTables,1);
 }
 const legacy=bookAnswerPage(source,source,undefined,MATERIAL_BOOK_PAGE_LABEL_POLICY,true,false);
 assert(!legacy.entries.some(row=>row.compactChoiceRange));
});
check('Printed original range requires a single-choice instruction, contiguous groups and the actual number on the page',()=>{
 const paper='二、选择题（本大题共有4题，满分18分，第13～14题每题4分，第15～16题每题5分）\n每题有且只有一个正确答案。\n13. 题面\n14. 题面\n15. 题面\n16. 题面';
 for(const n of ['13','14','15','16'])assert.deepEqual(printedSingleChoiceRange(paper,n),[13,16]);
 for(const invalid of [paper.replace('有且只有','可以有'),paper.replace('第15～16题','第16～17题'),paper.replace('共有4题','共有5题'),paper+'\n13. 另一个父题'])assert.equal(printedSingleChoiceRange(invalid,'13'),undefined);
 assert.equal(printedSingleChoiceRange(paper,'17'),undefined);
 const listed=paper.replace('，满分18分，第13～14题每题4分，第15～16题每题5分','');
 assert.deepEqual(printedSingleChoiceRange(listed,'16'),[13,16]);
 assert.equal(printedSingleChoiceRange(listed.replace('15. 题面\n',''),'16'),undefined);
});
check('Local preview uses printed source values and keeps unresolved, contradictory or unscoped keys out',()=>{
 const heading='2025年上海市浦东新区初三物理一模参考答案';
 const compact='选择题答案（第3～5题）：A、D、C';
 assert.deepEqual(localCompactChoicePage(heading+'\n'+compact),{
  answers:[{section:heading,number:'3',answer:'A'},{section:heading,number:'4',answer:'D'},{section:heading,number:'5',answer:'C'}],needsReview:false,
 });
 for(const [text,expected] of [[compact,[]],[heading+'\n'+compact.replace('A、D、C','A、？、C'),[]],
  [heading+'\n'+compact+'\n'+compact,[]],[heading+'\n'+compact+'\n3. B', ['4','5']]]){
  const view=localCompactChoicePage(text);
  assert.deepEqual(view.answers.map(row=>row.number),expected);
  assert(view.needsReview);
 }
 assert.deepEqual(localCompactChoicePage('复习参考资料正文'),{answers:[],needsReview:false});
});
check('The second OCR must read one isolated answer row and cannot borrow an adjacent sequence',()=>{
 const line=(text,left,top,right,bottom,score=.96)=>({text,score,normalizedQuad:[[left,top],[right,top],[right,bottom],[left,bottom]]});
 const key='二、选择题：DBAC';
 const main=line(key,.12,.31,.39,.33), after=line('三、解答题',.12,.333,.29,.35);
 const bounded=locateLocalChoiceRow({lines:[main,after]},key);
 assert(bounded&&bounded[3]>.33&&bounded[3]<.333);
 assert.equal(locateLocalChoiceRow({lines:[main,line('黑色重叠',.22,.324,.36,.345)]},key),undefined);
 assert.equal(locateLocalChoiceRow({lines:[main,line(key,.12,.36,.39,.38)]},key),undefined);
 assert.equal(locateLocalChoiceRow({lines:[{...main,score:.85}]},key),undefined);
 assert.equal(independentChoiceLetters(['一 、 选 择 题 ： D B A C']),'DBAC');
 assert.equal(independentChoiceLetters(['选择题答案（第4至6题）：A、D、C']),'ADC');
 for(const lines of [['选择题：','DBAC'],['选择题：D?AC'],['选择题：DBAC','选择题：DAAC'],['选项：DBAC']])
  assert.equal(independentChoiceLetters(lines),'');
});
check('A numbered choice range follows adjacent pages without borrowing another exam or a conflicting answer',()=>{
 const front=section+'\n二、选择题（本大题共3题，第6～8题）';
 const page=front+'\n【6】题干\n【解】B\n【7】第二题\n答案：D';
 const next='【8】题干\n由以上关系，选C。';
 const display=rows=>rows.map(({section,range,letters,numbered})=>[section,range,letters,numbered.choiceRange]);
 assert.deepEqual(display(numberedChoiceRows([page])),[[section,[6,6],'B',[6,8]],[section,[7,7],'D',[6,8]]]);
 assert.deepEqual(display(numberedChoiceRows([page,next])),[[section,[8,8],'C',[6,8]]]);
 assert.deepEqual(numberedChoiceRows([page,'',next]),[]);
 assert.deepEqual(numberedChoiceRows([page,next+'\n【8】重复编号\n选C']),[]);
 assert.deepEqual(numberedChoiceRows([page,next+'\n答案：A']),[]);
 assert.deepEqual(numberedChoiceRows([page,'2026届某区高三数学一模解析\n'+next]),[]);
 assert.equal(independentNumberedChoice(['【 8 】 题 干'],'number'),'8');
 assert.equal(independentNumberedChoice(['【解】 D'],'letter'),'D');
 assert.equal(independentNumberedChoice(['〖 8 〗 题 干'],'number'),'8');
 assert.equal(independentNumberedChoice(['〖 解 〗 c'],'letter'),'C');
 assert.equal(independentNumberedChoice(['〖 解 】 B'],'letter'),'');
 assert.equal(independentNumberedChoice(['故选 C。','答案：B'],'letter'),'');
 assert.equal(independentNumberedChoice(['C','设事件B'],'letter'),'');
 const line=(text,x,y,right,bottom)=>({text,score:.98,normalizedQuad:[[x,y],[right,y],[right,bottom],[x,bottom]]});
 const marker=line('【8】很长的原题题干',.1,.25,.8,.27);
 const irrelevant=line('叠印',.45,.24,.55,.28);
 assert(locateLocalChoiceRow({lines:[marker,irrelevant]},marker.text,'numbered-marker')[2]<.21);
 const key=line('【解】D',.1,.35,.155,.37);
 const edge=line('相邻选项',.11,.326,.21,.352);
 assert.equal(locateLocalChoiceRow({lines:[key,edge]},key.text),undefined);
 assert.equal(locateLocalChoiceRow({lines:[key,edge]},key.text,'numbered-answer')[1],.352);
 const overlap=line('遮挡答案',.11,.326,.21,.363);
 assert.equal(locateLocalChoiceRow({lines:[key,overlap]},key.text,'numbered-answer'),undefined);
});
if(process.env.OMNI_EDU_PRINTED_ANSWER_REPLAY){
 const db=new DatabaseSync(process.env.OMNI_EDU_PRINTED_ANSWER_REPLAY,{readOnly:true});
 try{
  const row=db.prepare(`SELECT s.body_json FROM material_book_pairs p JOIN material_structure_jobs j ON j.resource_id=p.answer_id
   AND j.version=p.answer_version JOIN material_structure_pages s ON s.generation=j.generation
   JOIN teacher_resources r ON r.id=p.answer_id WHERE p.active=1 AND r.original_file_name LIKE '%2025%上海高考数学答案.pdf' AND s.page=1`).get();
  assert(row);const source=JSON.parse(row.body_json);
  const excerpt=source.rawText.match(/^1[.．、][^\n]*\n[^]*?(?=^2[.．、])/mu)?.[0];
  assert(excerpt);assert(source.issues.includes('ambiguous_columns'));
  // Replay the local OCR excerpt only. This does not impersonate two independent model responses.
  const receipt=scoped(excerpt.trimEnd(),[],['uncertain_ocr']);
  const old=bookAnswerPage(receipt,receipt,undefined,MATERIAL_BOOK_PAGE_TABLE_POLICY).entries[0];
  const next=bookAnswerPage(receipt,receipt,undefined,MATERIAL_BOOK_PAGE_LABEL_POLICY).entries[0];
  assert.equal(old.answer,'');assert.equal(next.answer,'[4,5]');assert(next.analysis.startsWith('由题意'));
  assert(next.issues.includes('missing_section')&&next.issues.includes('page_uncertainty'));
  assert.equal(next.quote,excerpt.slice(next.start,next.end).trim());
  checks++;console.log(JSON.stringify({actualPage:1,previousAnswerRecovered:false,labelledAnswerRecovered:true,retainedReview:true}));
 }finally{db.close();}
}
check('An entry-local doubt in either pass never blocks a clear answer in another exam with the same number',()=>{for(const pair of [[scoped(text,[local]),scoped(text)],[scoped(text),scoped(text,[local])]]){const before=JSON.stringify(pair),v=bookAnswerPage(...pair);assert.equal(v.policy,'section-number-two-pass.v2');assert.equal(v.pageUncertain,false);assert(v.entries.find(e=>e.section===section&&e.number==='2').issues.includes('uncertain_ocr'));assert(v.entries.filter(e=>e.number==='1').every(e=>!e.issues.length));assert.equal(pageTranscriptionStatus(...pair),'needs_review','A partial answer page must stay outside whole-page retrieval');assert.equal(JSON.stringify(pair),before);}});
check('Local scope uses the full title, not just the number or a fuzzy chapter match',()=>{const v=bookAnswerPage(scoped(text,[{section:other,number:'1',issues:['answer_conflict']}]),scoped(text));assert(!v.entries.find(e=>e.section===section&&e.number==='1').issues.length);assert(v.entries.find(e=>e.section===other&&e.number==='1').issues.includes('answer_conflict'));});
check('Unknown, ambiguous or unspecified doubts retain global uncertainty instead of silently clearing it',()=>{const duplicate=text+'\n1.C 另一段。';for(const [body,issues]of [[text,[{...local,number:'99'}]],[text,[{...local,section:'第十四章 素养基础测试卷'}]],[duplicate,[{section:other,number:'1',issues:['uncertain_ocr']}]]]){const v=bookAnswerPage(scoped(body,issues),scoped(body));assert(v.pageUncertain&&v.entries.every(e=>e.issues.includes('page_uncertainty')));}assert(bookAnswerPage(scoped(text,[],[],'needs_review'),scoped(text)).pageUncertain);assert(bookAnswerPage(scoped(text,[],['uncertain_ocr']),scoped(text,[local])).pageUncertain);assert(bookAnswerPage(response(text),scoped(text)).pageUncertain);});
check('Versioned schemas freeze legacy/new policies and reject malformed or duplicate entry scopes',()=>{assert(pageResponseMatchesPolicy(response(text),undefined,true));assert(!pageResponseMatchesPolicy(scoped(text),undefined,true));assert(!pageResponseMatchesPolicy(response(text),MATERIAL_BOOK_PAGE_POLICY,true));assert(!pageResponseMatchesPolicy(scoped(text),MATERIAL_BOOK_PAGE_POLICY,false));assert(pageResponseMatchesPolicy(scoped(text),MATERIAL_BOOK_PAGE_POLICY,true));const base=scoped(text,[local]);for(const bad of [{...base,answerIssues:[{...local,extra:true}]},{...base,answerIssues:[{...local,issues:[]}]},{...base,answerIssues:[{...local,issues:['invented']}]},{...base,answerIssues:[local,{...local,section:section.replace(' ',' · ')}]},{...base,outcome:'no_questions'},{...base,schemaVersion:'xiaozhi.material-ai-page-response.v1'},{...base,questions:[{}],outcome:'questions'}])assert.throws(()=>parseAiPageResponse(JSON.stringify(bad)),/invalid_response/);assert.equal(pageTranscriptionStatus(scoped(text),scoped(text)),'complete');});
if(process.argv[2]){const root=path.resolve(process.argv[2]);assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert(/^omni-real-material-[a-z0-9]+$/i.test(path.basename(root)));assert.equal(fs.realpathSync(root),root);const db=new DatabaseSync(path.join(root,'data','app.db'),{readOnly:true});try{
 const row=db.prepare("SELECT u.first_json,u.final_json,u.status FROM material_ai_units u JOIN material_ai_batches b ON b.id=u.batch_id JOIN teacher_resources r ON r.id=b.resource_id WHERE r.original_file_name='答案.pdf' AND json_extract(u.input_json,'$.bookRole.kind')='answers' AND json_extract(u.input_json,'$.page')=3 AND json_extract(u.first_json,'$.schemaVersion')='xiaozhi.material-ai-page-response.v1' ORDER BY b.created_at DESC LIMIT 1").get();assert(row);const v=bookAnswerPage(parseAiPageResponse(row.first_json),parseAiPageResponse(row.final_json));assert.equal(v.entries.length,22);const ones=v.entries.filter(e=>e.number==='1');assert.deepEqual(ones.map(e=>e.answer),['D','B']);assert.equal(new Set(ones.map(e=>e.sectionKey)).size,2);assert(v.pageUncertain&&v.entries.every(e=>e.issues.includes('page_uncertainty')));assert(v.entries.at(-1).issues.includes('cross_page'));checks++;console.log(JSON.stringify({actualPage:3,entries:v.entries.length,sections:new Set(v.entries.map(e=>e.sectionKey)).size,agreed:v.entries.filter(e=>e.agrees).length,allRetainPageReview:true,scope:'Read-only legacy actual saved two-pass DeepSeek responses; no mathematical accuracy or automatic writeback claim'}));
 }finally{db.close();}}
console.log(JSON.stringify({success:true,checks}));
