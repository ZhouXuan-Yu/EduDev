import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(acceptance);
const wordRequest=process.argv.includes('--word-request');
const output=fs.mkdtempSync(path.join(acceptance,'teaching-handout-'));
const data=path.join(output,'data'), profile=path.join(output,'profile');
const desktop=path.resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const modelTool='education_create_teaching_handout';
const title='等式变形分层学案', quote='等式两边同时减去同一个数，等式仍然成立。';
const original=path.join(output,'等式性质参考.md');
fs.writeFileSync(original,'# 等式性质\n\n'+quote+'\n\n等式两边同时除以同一个非零数，等式仍然成立。');
const report={ok:false,output,main,mainHash:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),checks:[],errors:[],paidRequests:0};
const check=(name,details)=>{report.checks.push({name,...details});console.log('PASS '+name);};
let app,page,sessionId;

function sql(statement,args=[],mutate=false){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:!mutate});
  try{return mutate?db.prepare(statement).run(...args):db.prepare(statement).all(...args);}
  finally{db.close();}
}

async function until(read,timeout=90000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const value=await read();
    if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error('Teaching handout scenario timed out');
}

async function launch(cold=false){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-teaching-handout',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop});
  await app.evaluate(({net,dialog},{cold,title,quote,modelTool,original,wordRequest})=>{
    const wire=globalThis.handoutWire={requests:[],results:[]};
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[original]});
    net.fetch=async(raw,init)=>{
      const url=new URL(typeof raw==='string'?raw:raw.url);
      if(url.origin!=='https://api.deepseek.com')throw Error('External request blocked');
      if(url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{
        id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],
        effort:{supported_levels:['low','high','max'],default_level:'high'},
      }]}),{headers:{'content-type':'application/json'}});
      if(cold||url.pathname!=='/v1/chat/completions')throw Error('Unexpected model dispatch');
      const phase=wire.requests.length, body=JSON.parse(init.body);
      const latest=()=> {
        const raw=body.messages.filter(item=>item.role==='tool').at(-1)?.content;
        const text=typeof raw==='string'?raw:raw?.map(part=>part.text||'').join('\n');
        try{return JSON.parse(text.split('\n')[0]);}catch{return {unparsed:text};}
      };
      const expect=(condition,message)=>{if(!condition){wire.error=message;throw Error(message);}};
      if(wordRequest&&phase===0){
        const names=body.tools.map(tool=>tool.function.name);
        expect(names.includes(modelTool)&&!names.includes('education_export_teaching_handout'),
          'New Word handout request must route to draft creation');
      }
      const document=(citation)=>({schemaVersion:'xiaozhi.teaching-handout.v1',title,targetLevel:'七年级',
        chapters:[{title:'等式两边同做一种运算',objectives:['用等式性质解一元一次方程'],
          focus:'保持等式两侧同步运算。',difficulty:'除法步骤必须说明除数非零。',
          explanation:'等式性质可以用于移项。比如 $3x+7=25$ 可先在两边同时减去 7。',
          example:{prompt:'解方程 $3x+7=25$。',steps:['两边同减 7，得到 $3x=18$。','两边同除以 3，得到 $x=6$。','把 6 代回原式核验。'],answer:'$x=6$'},
          exercises:[{prompt:'解 $2x+3=15$。',difficulty:'基础',answer:'$x=6$',explanation:'先两边减 3，再除以 2。'},
            {prompt:'解 $5x-2=2x+7$ 并代回。',difficulty:'巩固',answer:'$x=3$',explanation:'两边减去 $2x$ 并加 2，得到 $3x=9$。'}],
          citations:[{resourceId:wire.resourceId,offset:0,quote:citation}]}],sourceGaps:[]});
      let offer;
      if(phase){
        const result=latest();
        wire.results.push(result);
        if(phase===1){
          wire.resourceId=result.materials?.find(item=>item.title.includes('等式性质参考'))?.resourceId;
          expect(wire.resourceId,'Local imported resource did not appear');
          offer={name:'office_read_material',args:{resourceId:wire.resourceId,offset:0}};
        }
        if(phase===2){
          expect(result.text?.includes(quote),'Exact source paragraph was not read');
          offer={name:modelTool,args:document('这是未出现在本地段落的错误引文。')};
        }
        if(phase===3){
          expect(result.error==='source_quote_mismatch','Unverified quote was not refused');
          offer={name:modelTool,args:document(quote)};
        }
        if(phase===4){
          expect(result.success&&result.teacherConfirmed===false&&result.bookId,'Draft was not saved');
          wire.bookId=result.bookId;
          offer={name:modelTool,args:document(quote)};
        }
        if(phase===5){
          expect(result.bookId===wire.bookId,'Identical retry did not return same draft');
          offer={name:modelTool,args:{...document(quote),title:'另一份冲突草稿'}};
        }
        if(phase===6)expect(result.error==='conflict','Conflicting retry did not stop');
        expect(phase<=6,'Unexpected model request after handout save');
      }else offer={name:'office_list_materials',args:{query:'等式性质参考',offset:0}};
      if(offer)expect(body.tools.some(tool=>tool.function.name===offer.name),'Missing active tool '+offer.name);
      wire.requests.push(offer?.name||'answer');
      const event=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'teaching-handout',object:'chat.completion.chunk',
        created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
      const delta=offer?{tool_calls:[{index:0,id:'handout-call-'+phase,type:'function',
        function:{name:offer.name,arguments:JSON.stringify(offer.args)}}]}:{content:'已保存可编辑学案草稿，请打开讲义核对。'};
      return new Response(event({role:'assistant'})+event(delta)+event({},offer?'tool_calls':'stop')+'data: [DONE]\n\n',
        {headers:{'content-type':'text/event-stream'}});
    };
  },{cold,title,quote,modelTool,original,wordRequest});
  page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
  await assertIsolatedPiMain(app,main,profile);
  if(cold) await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);
}

const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
const getBook=bookId=>page.evaluate(id=>window.omniEdu.getTeachingBook(id),bookId);
const card=()=>page.getByTestId('pi-teaching-handout');
const blockButton=id=>page.getByTestId('teaching-book-block-edit-'+id);
const sourceLink=()=>page.getByTestId('teaching-book-sources').getByTestId('pi-material-source-open');

try{
  await launch();
  const oldBook=await page.evaluate(()=>window.omniEdu.createTeachingBook({title:'此前的独立讲义'}));
  if(await page.getByTestId('ai-return-workspace').isVisible())await page.getByTestId('ai-return-workspace').click();
  await page.getByTestId('nav-knowledge').click();
  await page.getByTestId('materials-import').click();
  await until(()=>sql("SELECT id FROM teacher_resources WHERE parse_status IN ('ready','parsed','chunked','indexed','graph_extracted')")[0]);
  await page.getByTestId('desktop-back').click();
  const input=page.getByTestId('office-prompt-input');
  await input.fill('请根据资料库里《等式性质参考》制作一份七年级一元一次方程的可编辑'+
    (wordRequest?' Word ':'')+'学案，包含重点难点、分步例题和分层练习。');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  sessionId=await until(async()=>{
    const id=await page.locator('.office-composer-container').getAttribute('data-session-id');
    return /^aisession_[a-f0-9-]{36}$/u.test(id??'')&&id;
  });
  const state=await until(async()=>{
    const value=await snapshot();
    const turn=value.projection.turns.at(-1);
    return !value.running&&turn?.status!=='running'&&value.teachingHandouts?.length&&value;
  });
  const wire=await app.evaluate(()=>globalThis.handoutWire);
  assert.equal(wire.error,undefined);
  assert.equal(wire.requests.length,7);
  assert.equal(state.projection.turns.at(-1)?.status,'completed');
  const [handout]=state.teachingHandouts;
  report.sessionId=sessionId; report.bookId=handout.bookId; report.runId=handout.runId; report.taskId=handout.taskId;
  assert.equal(handout.taskId,state.task?.id);
  assert.equal(handout.bookId,wire.bookId);
  assert.equal(sql('SELECT book_id FROM teaching_handout_origins WHERE session_id=?',[sessionId]).length,1);
  assert.equal(sql('SELECT call_id FROM teaching_handout_receipts WHERE book_id=?',[handout.bookId]).length,2);
  assert.equal(sql("SELECT call_id FROM xiaozhi_effects_v1 WHERE run_id=? AND state='committed' AND json_extract(document_json,'$.tool')=?",
    [handout.runId,modelTool]).length,2);
  assert.equal(sql('SELECT id FROM teaching_books').length,2);
  assert.equal(sql('SELECT id FROM document_artifacts').length,0);
  check('Native Pi source read, false quote rejection, exact task binding, idempotent save and conflicting retry',{bookId:handout.bookId});

  await card().getByTestId('pi-teaching-handout-open').click();
  let preview=page.getByTestId('teaching-book-preview');
  await preview.waitFor();
  assert.equal(await page.getByTestId('teaching-book-title').inputValue(),title);
  assert.match(await preview.innerText(),/例题解题过程/);
  assert.match(await preview.innerText(),/练习 2 · 巩固/);
  assert(await preview.locator('math').count()>0);
  const originalBook=await getBook(handout.bookId);
  assert.equal(originalBook.book.status,'draft');
  assert.equal(originalBook.blocks.length,8);
  assert.equal(originalBook.sources[0].snippet,quote);
  assert.equal(originalBook.materialSources[0].resourceId,wire.resourceId);
  await page.setViewportSize({width:1366,height:768});
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'editable-handout-1366.png'),animations:'disabled'});
  await page.setViewportSize({width:1920,height:1080});
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'editable-handout-1920.png'),animations:'disabled'});
  check('Conversation opens exact editable handout with chapter, staged exercises and locally rendered formulas',{blockCount:originalBook.blocks.length});

  const material=originalBook.materialSources[0];
  await sourceLink().click();
  const excerpt=page.getByTestId('materials-chunk-'+material.chunkId);
  await excerpt.waitFor();
  assert.match(await excerpt.innerText(),new RegExp(quote));
  await page.getByTestId('desktop-back').click();
  await preview.waitFor();
  check('Cited source opens original paragraph through the material viewer');

  const explanation=originalBook.blocks.find(block=>block.metadata.handoutRole==='explanation');
  const changed='教师补充：先写明使用了哪条等式性质。\n\n'+explanation.payload.text;
  await blockButton(explanation.id).click();
  await page.getByTestId('teaching-book-block-text').fill(changed);
  await page.getByTestId('teaching-book-block-save').click();
  await until(async()=> (await getBook(handout.bookId)).blocks.find(block=>block.id===explanation.id).version===2);
  const edited=await getBook(handout.bookId);
  assert.deepEqual(edited.blocks.filter(block=>block.id!==explanation.id),originalBook.blocks.filter(block=>block.id!==explanation.id));
  assert.deepEqual(await getBook(oldBook.id).then(value=>value.blocks),[]);
  const changedBlock=edited.blocks.find(block=>block.id===explanation.id);
  assert.equal(changedBlock.payload.text,changed);
  assert.deepEqual(changedBlock.sourceAnchors,explanation.sourceAnchors);
  assert.deepEqual(changedBlock.metadata,explanation.metadata);
  check('Teacher edits one block with CAS version while other blocks and sources are preserved');

  await app.close(); app=undefined;
  await launch(true);
  preview=page.getByTestId('teaching-book-preview');
  await card().getByTestId('pi-teaching-handout-open').click();
  await preview.waitFor();
  assert.match(await preview.innerText(),/教师补充/);
  assert.equal((await getBook(handout.bookId)).blocks.find(block=>block.id===explanation.id).version,2);
  assert.deepEqual((await app.evaluate(()=>globalThis.handoutWire)).requests,[]);
  check('Cold reopen retains teacher edit and original conversation card without replay');

  sql("UPDATE resource_chunks SET content_md=content_md||? WHERE id=?",['\n\n段落已重新整理。',material.chunkId],true);
  await page.getByTestId('teaching-book-health-refresh').click();
  await until(async()=> (await getBook(handout.bookId)).health.staleSourceRefs.includes(material.chunkId));
  const health=(await getBook(handout.bookId)).health;
  assert(health.staleBlockIds.includes(explanation.id));
  assert.deepEqual(report.errors,[]);
  check('Same document hash with changed source paragraph is reported stale');
  const added='\n\n段落已重新整理。';
  sql('UPDATE resource_chunks SET content_md=substr(content_md,1,length(content_md)-?) WHERE id=?',[added.length,material.chunkId],true);
  await page.getByTestId('teaching-book-health-refresh').click();
  await until(async()=> (await getBook(handout.bookId)).health.status==='healthy');
  report.ok=true;
}catch(error){
  report.error=String(error.stack);
  report.wire=await app?.evaluate(()=>globalThis.handoutWire).catch(()=>undefined);
  report.snapshot=await snapshot().then(state=>({running:state.running,turn:state.projection.turns.at(-1)})).catch(()=>undefined);
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
  console.error(report.error);
  process.exitCode=1;
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));
}
