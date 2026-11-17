import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
fs.mkdirSync(path.resolve('test-results/a28-c2b'),{recursive:true});
const out=fs.mkdtempSync(path.resolve('test-results/a28-c2b/s3-preview-'));
const report={scope:'Headless Chromium production Preview/ExportEntry with controlled read-only IPC; no Electron, model task, Office or file export',passed:[],errors:[]};
const entry=`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/renderer/heroui-styles.ts';
import {PaperBasketPreview} from '/src/renderer/components/paper-ui/PaperBasketPreview.tsx';
import {paperLayoutGeometry} from '/src/shared/paper-layout.ts';
const layout={schemaVersion:'xiaozhi.paper-layout.v1',paper:'A4',orientation:'landscape',columns:2,margins:{top:100,right:200,bottom:150,left:250},columnGap:80};
const draftLayout={...layout,orientation:'portrait',columns:1};
const blueprint={title:'确认布局卷',subject:'数学',grade:'初二',mode:'source_only',durationMinutes:30,totalPoints:5,sections:[{id:'section',label:'选择',questionType:'选择题',count:1,points:5}]};
const role=text=>({mode:'edited',blocks:[{type:'text',text}]});
const member={entryId:'member',questionId:'question',contentVersion:'v',sectionId:'section',position:0,question:{id:'question',stem:'问题',answer:'秘密答案',analysis:'秘密解析'},instance:{content:{question:role('预览题干'),answer:role('秘密答案'),analysis:role('秘密解析')}},reviewCurrent:true,availability:{available:true}};
const basket={schemaVersion:'xiaozhi.paper-basket.v2',id:'basket',sessionId:'session',revision:3,state:'active',title:blueprint.title,blueprint,entries:[member],gaps:[],complete:true,templateSourceCurrent:true,c2:{retainedSections:[],entryPoints:{member:5},layout:draftLayout}};
const snapshot={id:'paper',sessionId:'session',revision:1,title:blueprint.title,state:'pending',count:1,complete:true,sourceCurrent:true,exportCurrent:true,digest:'a'.repeat(64),blueprint,selection:{items:[]},snapshotSchema:'xiaozhi.paper-basket-snapshot.c2.v1',basket:{basketId:'basket',basketRevision:3,entryIds:['member']},c2:{...basket.c2,layout}};
window.reviews=[];window.reviewOk=true;window.expectedGeometry=paperLayoutGeometry(layout);
window.omniEdu={getXiaozhiSnapshot:async()=>({paperOutput:{label:'受控保存位置'}}),reviewPaper:async input=>{window.reviews.push(input);return window.reviewOk?{ok:true,value:{...snapshot,state:'confirmed'}}:{ok:false,error:'source_changed'};}};
function Fixture(){const [mode,setMode]=useState('pending');window.mode=setMode;
const view={...snapshot,state:mode==='pending'?'pending':mode==='rejected'?'rejected':'confirmed',sourceCurrent:mode!=='source_stale',exportCurrent:mode!=='not_latest',...(mode==='revision_stale'?{basket:{...snapshot.basket,basketRevision:2}}:{})};
return <PaperBasketPreview basket={basket} snapshot={view} disabled={mode==='disabled'} dirty={mode==='dirty'} onSnapshot={()=>{}} onDecide={()=>{}}/>;}
document.documentElement.dataset.theme='light';createRoot(document.getElementById('root')).render(<Fixture/>);
`;
const fixturePath = path.join(out, 'entry.jsx');
const fixtureUrl = '/' + path.relative(process.cwd(), fixturePath).replaceAll('\\', '/');
fs.writeFileSync(fixturePath, entry);
const server = await createServer({
  configFile: false,
  appType: 'custom',
  server: {host: '127.0.0.1', port: 0, hmr: false, watch: {ignored: ['**/*']}},
  esbuild: {jsx: 'automatic'},
  optimizeDeps: {
    entries: [fixtureUrl.slice(1)],
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@heroui/react'],
  },
  plugins: [{
    name: 'paper-preview-owned-entry',
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(`<div id="root"></div><script type="module" src="${fixtureUrl}"></script>`);
      });
    },
  }],
});
let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'});page.on('pageerror',e=>report.errors.push(String(e)));page.setDefaultTimeout(30000);
  await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:120000});await page.getByTestId('paper-layout-preview-sheet').waitFor();
  assert.equal(await page.getByTestId('paper-export-entry').count(),0);assert(!(await page.locator('body').innerText()).includes('秘密答案'));
  const measure=await page.evaluate(()=>({width:parseFloat(document.querySelector('[data-testid="paper-layout-preview-sheet"]').style.width),columns:document.querySelector('[data-testid="paper-layout-preview-columns"]').style.columnCount,padding:parseFloat(document.querySelector('[data-testid="paper-layout-preview-sheet"]').style.paddingLeft),gap:parseFloat(document.querySelector('[data-testid="paper-layout-preview-columns"]').style.columnGap),geometry:window.expectedGeometry}));
  assert(Math.abs(measure.width-measure.geometry.pageWidth.px)<0.01);assert.equal(measure.columns,'2');assert(Math.abs(measure.padding-measure.geometry.margins.left.px)<0.01);assert(Math.abs(measure.gap-measure.geometry.columnGap.px)<0.01);assert((await page.getByTestId('paper-layout-preview').innerText()).includes('不表示 Word/PDF 的实际分页'));
  report.passed.push('pending C2 snapshot uses frozen snapshot landscape/two-column geometry rather than draft layout; no export or student answers');
  await page.evaluate(()=>window.mode('confirmed'));await page.getByTestId('paper-export-entry').waitFor();assert((await page.getByTestId('paper-print-template').innerText()).includes('横向 · 2 栏'));
  await page.waitForFunction(()=>document.querySelector('[data-testid="paper-output-label"]')?.textContent.includes('受控保存位置'));await page.getByTestId('paper-export-student-docx').click();await page.waitForFunction(()=>window.reviews.length===1);assert.deepEqual(await page.evaluate(()=>window.reviews[0]),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:'session',id:'paper'});
  await page.evaluate(()=>{window.reviewOk=false;});await page.getByTestId('paper-export-student-docx').click();await page.getByTestId('paper-output-error').waitFor();assert((await page.getByTestId('paper-output-error').innerText()).includes('失效'));report.passed.push('confirmed C2 enables existing verified export preparation on exact snapshot; failed fresh review blocks preparation');
  for(const mode of ['pending','rejected','source_stale','not_latest','revision_stale','dirty']){await page.evaluate(value=>window.mode(value),mode);await page.waitForTimeout(30);assert.equal(await page.getByTestId('paper-export-entry').count(),0,mode);}
  await page.evaluate(()=>window.mode('disabled'));await page.getByTestId('paper-export-entry').waitFor();assert(await page.getByTestId('paper-export-student-docx').isDisabled());report.passed.push('pending/rejected/source stale/not latest/revision mismatch/dirty cannot export; busy state disables output');
  assert.equal(report.errors.length,0);report.success=true;
}catch(error){report.success=false;report.errors.push(String(error));process.exitCode=1;}finally{await browser?.close();await server.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));console.log('RAW_REPORT '+out);}
