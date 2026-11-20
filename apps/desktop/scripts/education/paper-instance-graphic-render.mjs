import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
import {_electron as electron} from 'playwright';

const desktop = path.resolve(import.meta.dirname, '../..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-edu-graphic-office-'));
const runner = path.join(root, 'runner.mjs');
fs.symlinkSync(path.join(desktop,'node_modules'),path.join(root,'node_modules'),process.platform==='win32'?'junction':'dir');
await build({
  stdin: {sourcefile:'paper-choice-render.ts', resolveDir:desktop, loader:'ts', contents: "import {app} from 'electron';\nimport fs from 'node:fs/promises';\nimport path from 'node:path';\nimport {generateOfficeDocument} from './src/main/xiaozhi-agent/office-generator';\nimport {preparedGraphicPaper, resolvedGraphicImages} from './scripts/education/paper-instance-graphic-export-boundaries.mjs';\nconst root=process.env.GRAPHIC_FIXTURE_ROOT;\napp.on('window-all-closed',()=>{});\napp.whenReady().then(async()=>{\n const report={ok:false};\n try{\n  for(const audience of ['student','teacher']){\n   const draft=preparedGraphicPaper(audience);\n   const images=await resolvedGraphicImages(draft);\n   for(const format of ['docx','pdf']){\n    const data=await generateOfficeDocument(format,draft,{dataRoot:root,images});\n    await fs.writeFile(path.join(root,audience+'.'+format),data);\n   }\n   report.imageShas=draft.sections.flatMap(section=>(section.figures||[]).map(figure=>figure.sha256));\n  }\n  report.ok=true;\n }catch(error){report.error=String(error.stack);}\n finally{await fs.writeFile(path.join(root,'renderer-report.json'),JSON.stringify(report));app.quit();}\n});"},
  outfile:runner, bundle:true, platform:'node', format:'esm', packages:'external', logLevel:'silent',
});
const env = {...process.env, GRAPHIC_FIXTURE_ROOT:root};
for (const name of Object.keys(env)) if (/KEY|TOKEN|SECRET/i.test(name) || ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE'].includes(name)) delete env[name];
let app;
try {
  app = await electron.launch({args:[runner,'--user-data-dir='+path.join(root,'profile'),'--host-resolver-rules=MAP * ~NOTFOUND'],env,cwd:desktop,timeout:60000});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Graphic Office rendering timed out')),120000);
    app.on('close',()=>{clearTimeout(timer);resolve();});
  });
  const report = JSON.parse(fs.readFileSync(path.join(root,'renderer-report.json'),'utf8'));
  assert(report.ok,report.error);

  const read = String.raw`import json, sys, zipfile, hashlib, xml.etree.ElementTree as ET
from pathlib import Path
import pymupdf
root = Path(sys.argv[1])
ns = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
result={}
for audience in ['student','teacher']:
 with zipfile.ZipFile(root/(audience+'.docx')) as docx:
  doc=ET.fromstring(docx.read('word/document.xml'))
  body=[''.join(t.text or '' for t in p.findall('.//w:t',ns)) for p in doc.findall('.//w:p',ns)]
  runs=[]
  for p, text in zip(doc.findall('.//w:p',ns),body):
   if text and text[:2] in ['A.', 'B.', 'C.', 'D.']: runs.append(text[:1])
   for fig in p.findall('.//wp:docPr',ns): runs.append(fig.attrib.get('name'))
  media=[hashlib.sha256(docx.read(n)).hexdigest() for n in docx.namelist() if n.startswith('word/media/') and not n.endswith('/')]
 with pymupdf.open(root/(audience+'.pdf')) as pdf:
  layout=[]
  texts=[]
  sizes=[]
  for page in pdf:
   sizes.append([page.rect.width,page.rect.height])
   texts.append(page.get_text())
   for block in page.get_text('dict')['blocks']:
    if block['type']==1:
     p=pymupdf.Pixmap(block['image'])
     layout.append(['image',p.pixel(10,10)[0],block['bbox'][1]])
    else:
     for line in block['lines']:
      label=''.join(s['text'] for s in line['spans']).strip()
      if label[:2] in ['A.','B.','C.','D.']: layout.append(['label',label[:1],line['bbox'][1]])
 result[audience]={'docxText':body,'docxMedia':media,'docxLayout':runs,'pdfText':texts,'pdfLayout':layout,'pdfSizes':sizes}
print(json.dumps(result,ensure_ascii=True))`;
  const inspection=JSON.parse(execFileSync('python',['-c',read,root],{encoding:'utf8',windowsHide:true}));
  for (const audience of ['student','teacher']) {
    const result=inspection[audience];
    assert.deepEqual(result.docxLayout, ['A','choice_image_A','B','choice_image_B','choice_image_B_detail','C','choice_image_C','D','choice_image_D']);
    assert.deepEqual([...result.docxMedia].sort(), [...report.imageShas].sort());
    assert.deepEqual(result.pdfLayout.map(x=>x[1]), ['A',50,'B',85,210,'C',120,'D',155]);
    assert(result.pdfSizes.every(([w,h])=>Math.abs(w-595)<2&&Math.abs(h-842)<2));
    for (const text of [result.docxText.join('\n'),result.pdfText.join('\n')]) {
      assert.equal(text.includes('PRIVATE_ANSWER_B'),audience==='teacher');
      assert.equal(text.includes('PRIVATE_ANALYSIS'),audience==='teacher');
    }
  }
  const fileShas=Object.fromEntries(['student.docx','student.pdf','teacher.docx','teacher.pdf'].map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')]));
  console.log(JSON.stringify({ok:true,root,fileShas,verifiedOptions:4,imagesPerFile:5,scope:'Real DOCX/PDF engines with controlled completed paper. No product approval or natural-source promotion.'}));
} finally {await app?.close().catch(()=>{});}
