import assert from 'node:assert/strict';
import {test} from 'node:test';
import {alignPdfChoiceAnswers,literalPrintedChoiceProjection,pdfChoiceHeadings,pdfPrintedAnswers} from '../../src/main/assets/material-pdf-printed-answers.ts';
import {NATIVE_TEXT_ENGINE,NATIVE_TEXT_SCHEMA} from '../../src/shared/material-native-text.ts';
import {printedChoiceTokens} from '../../src/main/assets/word-booklet.ts';

/** Synthetic page 3 uses numbered horizontal print. The OCR may omit the cell spacing. */
function evidence({rows=[['1.','B','2.','A'],['3.','D','4.','C']],ocrRows,labels=['标准答案：','一.单项选择题'],lastPage=false}={}){
  const physical=[...labels.map(text=>[text]),...rows,...(lastPage?[]:[['二.填空题']])];
  const items=[];
  const lines=physical.map((cells,i)=>{
    const top=.14+i*.033;
    const itemIds=cells.map((text,index)=>{
      const id='native-item-'+(items.length+1);
      const x=.15+index*.024;
      items.push({id,text,box:[x,top,x+(cells.length===1?.09:.022),top+.016],transform:[1,0,0,1,0,0],height:1,width:1});
      return id;
    });
    return {id:'native-line-'+(i+1),text:cells.join(''),itemIds,box:[.15,top,items.at(-1).box[2],top+.016]};
  });
  const ocr=lines.map((line,i)=>({...line,id:'p3-line-'+(i+1),text:ocrRows?.[i-2]??line.text,score:.98}));
  const paragraphs=ocr.map((line,i)=>({id:'p3-part-'+(i+1),role:i===0?'answer':i===1||i===ocr.length-1&&!lastPage?'heading':'question',
    rawText:line.text,text:line.text,lineIds:[line.id],anchor:{page:3,box:line.box},issues:[]}));
  const version='a'.repeat(64),rasterSha256='b'.repeat(64),totalPages=lastPage?3:4;
  const page={page:3,totalPages,version,rasterSha256,lines:ocr,paragraphs,rawText:ocr.map(line=>line.text).join('\n'),
    nativeRecovery:{rasterSha256,native:{ok:true,schemaVersion:NATIVE_TEXT_SCHEMA,engine:NATIVE_TEXT_ENGINE,version,page:3,total:totalPages,readBytes:50,items,lines}}};
  const receipt={status:'needs_review',error:'text_conflict',nativeText:lines.map(line=>line.text).join('\n'),ocrText:page.rawText};
  return {page,receipt};
}

function fixture(){
  const {page,receipt}=evidence();
  const printed=pdfPrintedAnswers(page,receipt);
  assert(printed);
  const text='一.选择题（共4题）';
  const [heading]=pdfChoiceHeadings({page:1,issues:[],paragraphs:[{role:'heading',rawText:text,text,issues:[]}]},1);
  const questions=printed.sections[0].cells.map(cell=>({
    id:'q'+cell.number,number:cell.number,section:text,kind:'question',status:'candidate',answer:'',subquestions:[],
    options:[...'ABCD'].map(label=>({label})),
  }));
  return {printed,heading,questions};
}

test('matched printed rows yield four separate page anchors with exact answer cells',()=>{
  const {printed,heading,questions}=fixture();
  const answers=alignPdfChoiceAnswers(heading,printed.sections[0],questions);
  assert.deepEqual([...answers.values()].map(answer=>answer.text),['B','A','D','C']);
  assert([...answers.values()].every(answer=>answer.anchor.page===3));
  assert(answers.get('q1').anchor.box[2]<answers.get('q2').anchor.box[0]);
  assert(answers.get('q2').anchor.box[3]<answers.get('q3').anchor.box[1]);
});
test('fullwidth tokens preserve literal source offsets and handle an unspaced key',()=>{
  const value='１．Ｂ２．Ａ';
  const parsed=printedChoiceTokens(value);
  assert.equal(parsed.complete,true);
  assert.deepEqual(parsed.items.map(item=>[item.number,item.letters,value.slice(item.start,item.to)]),[['1','B','１．Ｂ'],['2','A','２．Ａ']]);
});
test('a question-body heading or a strip with unexplained words cannot supply a key',()=>{
  for(const labels of [['本题答案：','一.单项选择题'],['参考答案：','本组按下图选择题']]){
    const {page,receipt}=evidence({labels});
    assert.equal(pdfPrintedAnswers(page,receipt),undefined);
  }
  const {page,receipt}=evidence({rows:[['1.','B','解法说明']]});
  assert.equal(pdfPrintedAnswers(page,receipt),undefined);
});
test('OCR mismatch, source version changes, another row in the corridor and weak confidence all stop binding',()=>{
  for(const change of [
    ({page})=>{page.version='c'.repeat(64);},
    ({page})=>{page.lines[2].score=.89;},
    ({page})=>{page.lines[2].box=[.70,.206,.82,.222];},
    ({page})=>{page.paragraphs.splice(2,1);},
    ({receipt})=>{receipt.ocrText+='额外文字';},
  ]){
    const input=evidence();
    change(input);
    assert.equal(pdfPrintedAnswers(input.page,input.receipt),undefined);
  }
  const changed=evidence({ocrRows:['1.C2.A']});
  assert.equal(pdfPrintedAnswers(changed.page,changed.receipt),undefined);
});
test('a native item spanning two cells never grants a position for either cell',()=>{
  const {page,receipt}=evidence({rows:[['1.B2.A'],['3.','D','4.','C']]});
  const {sections}=pdfPrintedAnswers(page,receipt);
  assert.deepEqual(sections[0].cells.map(cell=>!!cell.anchor),[false,false,true,true]);
});
test('duplicate, partial or wrong-order question number inventories fail section alignment',()=>{
  const {printed,heading,questions}=fixture(),section=printed.sections[0];
  for(const invalid of [[questions[0],...questions.slice(0,3)],questions.slice(1),[...questions].reverse()]){
    assert.equal(alignPdfChoiceAnswers(heading,section,invalid).size,0);
  }
  assert.equal(alignPdfChoiceAnswers({...heading,scope:{ordinal:'2',mode:'generic'}},section,questions).size,0);
});
test('held questions and missing options remain held, source answers take precedence',()=>{
  const {printed,heading,questions}=fixture();
  questions[0].number='0';
  questions[0].status='needs_review';
  questions[1].answer='A';
  questions[2].options=questions[2].options.slice(0,3);
  assert.deepEqual([...alignPdfChoiceAnswers(heading,printed.sections[0],questions).keys()],['q4']);
});
test('one final-page strip may close at the end of the source document',()=>{
  const {page,receipt}=evidence({lastPage:true});
  assert.equal(pdfPrintedAnswers(page,receipt)?.sections[0].cells.length,4);
  page.totalPages++;
  page.nativeRecovery.native.total++;
  assert.equal(pdfPrintedAnswers(page,receipt),undefined);
});
test('projection may split the identical stem and choices but cannot carry an answer into an altered question',()=>{
  const question={stem:'求相反数\nA. 1\nB. 2',options:[{text:'A. 1'},{text:'B. 2'}]};
  assert(literalPrintedChoiceProjection(question,'求相反数','A. 1\nB. 2'));
  assert(!literalPrintedChoiceProjection(question,'求相反数','A. 2\nB. 1'));
  assert(!literalPrintedChoiceProjection(question,'求倒数','A. 1\nB. 2'));
  assert(!literalPrintedChoiceProjection(question,'求相反数','A. 1\nB. 3'));
});
