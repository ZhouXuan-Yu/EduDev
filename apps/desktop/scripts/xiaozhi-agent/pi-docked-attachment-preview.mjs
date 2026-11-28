import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import {Document,Packer,Paragraph} from 'docx';
import ExcelJS from 'exceljs';
import {_electron as electron} from 'playwright';

const [build,evidence]=process.argv.slice(2);
assert(build&&evidence);
const main=path.resolve(build,'main/index.js');
const trial=fs.mkdtempSync(path.join(os.tmpdir(),'edu-docked-attachments-'));
const files=path.join(trial,'files');
fs.mkdirSync(files);
const names=['课堂导入.docx','教学备忘.md','课堂数据.xlsx','实验照片.png'];
const originals=names.map(name=>path.join(files,name));
const origin='https://preview-fixture.invalid';
fs.writeFileSync(originals[0],await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('课堂导入独立证据')]}]})));
fs.writeFileSync(originals[1],'# 教学备忘\n\n文字预览独立证据\n\n![外部图片](https://no-image.invalid/a.png)');
const workbook=new ExcelJS.Workbook();
const scores=workbook.addWorksheet('课堂成绩');
scores.addRow(['科目','分数','课堂练习','课后练习','期中测验','期末测验','作业情况','备注']);
scores.addRow(['物理',76,85,93,78,88,'完成','独立核对']);
const lesson=workbook.addWorksheet('课时');
lesson.addRow(['阶段','分钟']);lesson.addRow(['讲解',20]);
await workbook.xlsx.writeFile(originals[2]);
fs.copyFileSync('scripts/xiaozhi-agent/fixtures/attachment-rgb.png',originals[3]);
const provider=http.createServer((request,response)=>{
  if(request.url.endsWith('/models')){response.end(JSON.stringify({data:[{id:'deepseek-flash'}]}));return;}
  request.resume();
  request.on('end',()=>{
    response.setHeader('Content-Type','text/event-stream');
    const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'local-preview',model:'deepseek-flash',object:'chat.completion.chunk',choices:[{index:0,delta,finish_reason}]})+'\n\n';
    response.end(chunk({role:'assistant',content:'收到附件。'})+chunk({},'stop')+'data: [DONE]\n\n');
  });
});
provider.listen(0,'127.0.0.1');await once(provider,'listening');
const profile=path.join(trial,'profile');
const boot=path.join(trial,'boot.cjs');
fs.writeFileSync(boot,`const {app,net}=require('electron');
app.setPath('userData',${JSON.stringify(profile)});
net.fetch=(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url||input.href);
 if(url.origin!=='https://api.deepseek.com')throw Error('Unexpected primary API');
 return globalThis.fetch('http://127.0.0.1:${provider.address().port}'+url.pathname,init);
};
app.whenReady().then(()=>import(${JSON.stringify(pathToFileURL(main).href)}));`);
let app,page;
const checks=[];
try{
 const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_DATA_ROOT:path.join(trial,'data'),OMNI_EDU_REPO_ROOT:path.resolve('../..'),DEEPSEEK_API_KEY:'local-test',DEEPSEEK_MODEL:'deepseek-flash'};
 delete env.ELECTRON_RUN_AS_NODE;
 console.log('Launching Electron');
 app=await electron.launch({args:[boot],env,timeout:60000});
 console.log('Electron launch returned');
 app.process().stderr.on('data', data=>process.stderr.write(data));
 app.process().stdout.on('data', data=>process.stdout.write(data));
 page=await app.firstWindow({timeout:40000});
 console.log('First window is ready');
 page.setDefaultTimeout(25000);
 const prompt=page.getByTestId('office-prompt-input');
 await prompt.waitFor({timeout:60000});
 console.log('Chat composer is ready');
 await app.evaluate(({app,session},origin)=>{
   const seen=new Set();
   app.on('web-contents-created',(_event,contents)=>{
     const partition=contents.session;
     if(partition===session.defaultSession||contents.getLastWebPreferences().preload||seen.has(partition))return;
     seen.add(partition);
     partition.protocol.handle('https',req=>new URL(req.url).origin===origin
        ?new Response('<title>教研网页</title><h1>网页标签仍在</h1>',{headers:{'Content-Type':'text/html;charset=utf-8'}})
        :Response.error());
   });
 },origin);
 const remote=[];
 await page.route('https://no-image.invalid/**',route=>{remote.push(route.request().url());return route.abort();});
 const upload=page.getByTestId('office-composer').locator('input[type=file]');
 await upload.waitFor({state:'attached'});
 await page.locator('button[aria-label="添加本地附件"]:enabled').waitFor();
 await upload.setInputFiles(originals);
 console.log('Composer file input received the four local files');
 for(const name of names)await page.getByRole('button',{name:'预览附件 '+name,exact:true}).waitFor();
 await page.getByRole('button',{name:'预览附件 '+names[0],exact:true}).click();
 await page.getByTestId('pi-attachment-preview').getByText('课堂导入独立证据').waitFor();
 await page.getByTestId('pi-attachment-preview-close').click();
 checks.push('Draft attachment continues to use the local preview before sending');
 await prompt.fill('只确认收到附件，不调用工具。');
 await page.getByRole('button',{name:'发送消息',exact:true}).click();
 const history=page.getByTestId('pi-attachment-history');
 await history.waitFor();
 console.log('Submitted attachment cards are visible');
 fs.unlinkSync(originals[0]);
 const dock=page.getByTestId('pi-browser-dock');
 const pane=dock.locator('[data-testid=pi-docked-attachment-preview]:visible');
 const open=async name=>{
   await history.getByRole('button',{name:'预览附件 '+name,exact:true}).click();
   await dock.getByRole('region',{name,exact:true}).waitFor();
 };
 await open(names[0]);await pane.getByText('课堂导入独立证据').waitFor();
 await open(names[1]);await pane.getByRole('heading',{name:'教学备忘'}).waitFor();
 assert.deepEqual(remote,[]);
 assert.equal(await pane.locator('img').count(),0);
 await open(names[2]);
 await pane.getByText('课堂成绩',{exact:false}).first().waitFor();
 await pane.getByText('课时',{exact:false}).first().waitFor();
 await pane.getByText('76',{exact:true}).waitFor();
 assert.equal(await pane.locator('table').count(),2);
 await pane.getByRole('cell',{name:'物理',exact:true}).waitFor();
 await pane.getByRole('cell',{name:'20',exact:true}).waitFor();
 const tableScroll=pane.getByRole('region',{name:'表格预览'}).first();
 await tableScroll.scrollIntoViewIfNeeded();
 const widths=await tableScroll.evaluate(region=>{
   const table=region.querySelector('table');
   return {visible:region.clientWidth,total:region.scrollWidth,display:getComputedStyle(region).display,
     overflow:getComputedStyle(region).overflowX,element:region.outerHTML.slice(0,280),tableWidth:table?.offsetWidth,
     parentDisplay:getComputedStyle(region.parentElement).display,parentWidth:region.parentElement.clientWidth};
 });
 assert(widths.total>widths.visible,`wide table must scroll horizontally: ${JSON.stringify(widths)}`);
 assert(await tableScroll.evaluate(region=>{region.scrollLeft=region.scrollWidth;return region.scrollLeft>0;}));
 await tableScroll.evaluate(region=>{region.scrollLeft=0;});
 assert((await pane.locator('.docked-attachment-heading').evaluate(el=>parseFloat(getComputedStyle(el).paddingInlineStart)))>=10);
 await page.screenshot({path:path.join(evidence,'Excel右栏.png')});
 await open(names[3]);
 const img=pane.getByTestId('pi-attachment-image');
 await img.waitFor();
 assert(await img.evaluate(node=>node.complete && node.naturalWidth>0));
 await pane.getByRole('button',{name:'放大图片'}).click();
 assert.equal(await img.evaluate(node=>node.style.zoom),'1.25');
 await pane.getByRole('button',{name:'适合宽度'}).click();
 assert.equal(await img.evaluate(node=>node.style.zoom),'');
 checks.push('All four submitted formats render from authorized original versions in independent tabs');
 await dock.getByRole('button',{name:'新建网页标签'}).click();
 const address=dock.getByTestId('browser-address');
 await address.fill(origin);await address.press('Enter');
 await dock.getByRole('button',{name:'教研网页',exact:true}).waitFor();
 await dock.getByRole('button',{name:names[2],exact:true}).click();
 await pane.getByText('76',{exact:true}).waitFor();
 await dock.getByRole('button',{name:names[0],exact:true}).click();
 await pane.getByText('课堂导入独立证据').waitFor();
 await pane.getByTestId('pi-docked-attachment-close').click();
 assert.equal(await dock.getByRole('button',{name:names[0],exact:true}).count(),0);
 await dock.getByRole('button',{name:'教研网页',exact:true}).click();
 const guest=app.context().pages().find(p=>p.url().startsWith(origin));
 assert(guest);await guest.getByRole('heading',{name:'网页标签仍在'}).waitFor();
 checks.push('With an HTTPS fixture and multiple files open, switching and closing preserve the other tabs');
}catch(error){
 if(page&&!page.isClosed()){
  console.log('Attachment error:',await page.getByTestId('pi-attachment-error').allTextContents());
  console.log('Visible attachment controls:', await page.locator('button[aria-label^="预览附件"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))));
  await page.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});
 }
 throw error;
}finally{
 await app?.close();
 provider.close();provider.closeAllConnections();
 const resolved=fs.realpathSync(trial);
 assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
 assert(path.basename(resolved).startsWith('edu-docked-attachments-'));
 fs.rmSync(resolved,{recursive:true,force:false,maxRetries:2});
 console.log(JSON.stringify({checks,released:!fs.existsSync(resolved)}));
}
