/** Teacher-authored INPUT, using the small PDF/xref construction already used by
 * education/original-multi-journey. No OCR, model answer or application receipt. */
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

// Actual source contract, bundled in memory with no source/build file writes.
const planBuild=await build({stdin:{contents:
  "export {TASK_PLAN_PARAMETERS,validTaskPlanInput} from './src/shared/xiaozhi-task-plan.ts';",
  resolveDir:fileURLToPath(new URL('../..',import.meta.url)),loader:'ts'},
  bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
export const planContract=await import('data:text/javascript;base64,'+Buffer.from(planBuild.outputFiles[0].text).toString('base64'));

export const fixturePlanSteps=Object.freeze({
  initial:[
    {id:'single_save',text:'对照单页原图核对并保存第一道原题',kind:'saved_questions',target:'current',dependsOn:[],reported:'in_progress'},
    {id:'multi_save',text:'对照跨页原图核对并保存第二道原题',kind:'saved_questions',target:'current',dependsOn:[],reported:'pending'},
    {id:'original_review',text:'教师最终核对两道已保存原题',kind:'human',dependsOn:['single_save','multi_save'],reported:'pending'},
  ],
  advance:[
    {id:'single_save',text:'对照单页原图核对并保存第一道原题',kind:'saved_questions',target:'current',dependsOn:[],reported:'completed'},
    {id:'multi_save',text:'对照跨页原图核对并保存第二道原题',kind:'saved_questions',target:'current',dependsOn:[],reported:'in_progress'},
    {id:'original_review',text:'教师最终核对两道已保存原题',kind:'human',dependsOn:['single_save','multi_save'],reported:'pending'},
  ],
  pending:[
    {id:'pending_crop',text:'提出新的跨页待裁图候选并等待教师核对',kind:'saved_questions',target:'current',dependsOn:[],reported:'in_progress'},
    {id:'pending_review',text:'教师最终核对本次待裁图候选',kind:'human',dependsOn:['pending_crop'],reported:'pending'},
  ],
});

export const fixtureCases = Object.freeze([
  {role:'single',name:'arithmetic-single-page',title:'合成算术单页原题',pages:[1],
    statement:'Question 1. Figure A has 2 dots and Figure B has 3 dots. Calculate 2 + 3.',
    formulas:'2 + 3',figures:'Figure A: 2 dots. Figure B: 3 dots.'},
  {role:'multi',name:'arithmetic-cross-page',title:'合成算术跨页原题',pages:[2,3],
    statement:'Question 2. The condition continues on page 3. Figure C shows x and 2. Figure D shows a total of 5. Solve x + 2 = 5.',
    formulas:'x + 2 = 5',figures:'Page 2 Figure C: x and 2. Page 3 Figure D: total 5.'},
  {role:'pending',name:'arithmetic-pending-crop',title:'合成算术待裁图候选',pages:[2,3],
    statement:'Question 2. The condition continues on page 3. Figure C shows x and 2. Figure D shows a total of 5. Solve x + 2 = 5.',
    formulas:'x + 2 = 5',figures:'Page 2 Figure C: x and 2. Page 3 Figure D: total 5.'},
]);
export const projectionFor = item => Object.fromEntries(
  ['statement','formulas','tables','figures','choices','subquestions'].map(key =>
    [key,{state:item[key]?'provided':'not_applicable',text:item[key]||''}]));

export function proposalFor(item,resourceId) {
  const regions=item.pages.map(page=>({page,box:[0,0,1,1]}));
  return {resourceId,title:item.title,subject:'数学',grade:'初一',knowledgePoint:'合成算术原图核对',
    questionType:'计算题',difficulty:'easy',stem:item.statement,
    ...(item.role==='single'?{page:1,box:[0,0,1,1]}:{regions}),
    transcription:{schemaVersion:'xiaozhi.question-transcription.v1',formulas:item.formulas,
      figures:item.figures,tables:'',choices:'',subquestions:''}};
}

export function arithmeticPdf() {
  const objects=[null];
  const add=value=>{objects.push(Buffer.isBuffer(value)?value:Buffer.from(value,'ascii'));return objects.length-1;};
  const catalog=add(''),pages=add(''),font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  // A genuine embedded RGB image carries the five countable dots on every page.
  const pixels=Buffer.alloc(120*24*3,255);
  for(const center of [10,30,60,80,100])for(let y=4;y<20;y++)for(let x=center-6;x<center+6;x++) {
    const at=(y*120+x)*3;pixels[at]=30;pixels[at+1]=60;pixels[at+2]=120;
  }
  const lines=[
    ['Teacher-authored synthetic arithmetic. Page 1 of 3.',
      'Question 1. Figure A has 2 dots and Figure B has 3 dots.',
      'Calculate 2 + 3. Figure A: first 2. Figure B: last 3.'],
    ['Teacher-authored synthetic arithmetic. Page 2 of 3.',
      'Question 2. The condition continues on page 3.',
      'Figure C shows x and 2. See the total on page 3.'],
    ['Teacher-authored synthetic arithmetic. Page 3 of 3.',
      'Question 2 continued. Figure D shows a total of 5.',
      'Solve x + 2 = 5. Figure D: all five dots.'],
  ];
  const kids=[];
  for(const [index,text]of lines.entries()) {
    const raster=Buffer.from(pixels);
    if(index===1) {
      // The unknown group is a box labelled x, followed by two known dots.
      for(let y=0;y<24;y++)for(let x=0;x<75;x++) {
        const shade=x>=5&&x<50&&y>=4&&y<20?210:255,at=(y*120+x)*3;
        raster[at]=raster[at+1]=raster[at+2]=shade;
      }
    }
    const image=add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 120 /Height 24 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${raster.length} >>\nstream\n`),raster,Buffer.from('\nendstream')]));
    const stream='BT /F1 12 Tf 36 730 Td '+text.map((line,i)=>(i?'0 -28 Td ':'')+`(${line}) Tj`).join('\n')+' ET\nq 360 0 0 72 48 500 cm /Diagram Do Q\n'+
      (index===1?'BT /F1 16 Tf 105 530 Td (x) Tj ET\n':'');
    const content=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Diagram ${image} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog]=Buffer.from(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  objects[pages]=Buffer.from(`<< /Type /Pages /Kids [${kids.map(id=>`${id} 0 R`).join(' ')}] /Count 3 >>`);
  const parts=[Buffer.from('%PDF-1.4\n')],offsets=[0];let length=parts[0].length;
  for(let i=1;i<objects.length;i++) {
    offsets.push(length);const part=Buffer.concat([Buffer.from(`${i} 0 obj\n`),objects[i],Buffer.from('\nendobj\n')]);
    parts.push(part);length+=part.length;
  }
  parts.push(Buffer.from(`xref\n0 ${objects.length}\n0000000000 65535 f \n`+
    offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+
    `trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(parts);
}

export function inputSelfTest() {
  const bytes=arithmeticPdf(),text=bytes.toString('latin1');
  assert.equal(text.match(/\/Type \/Page\b/g).length,3);
  assert(text.includes('/Subtype /Image'));assert(text.includes('Question 2 continued'));
  const offset=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(offset,offset+4),'xref');
  const entries=text.slice(offset).split('\n').slice(3,3+Number(text.slice(offset).split('\n')[1].split(' ')[1])-1);
  entries.forEach((entry,i)=>assert(text.slice(Number(entry.slice(0,10))).startsWith(`${i+1} 0 obj\n`)));
  for(const item of fixtureCases) {
    const proposal=proposalFor(item,'resource_test');assert.equal(proposal.answer,undefined);
    assert.equal(proposal.sourceChecked,undefined);assert.equal(proposal.transcription.state,undefined);
    assert.equal(projectionFor(item).tables.state,'not_applicable');
  }
  return ['three actual PDF pages','embedded raster diagram','xref byte offsets','teacher input has no approval flags'];
}
