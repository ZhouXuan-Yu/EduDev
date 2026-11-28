import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {physicsHandout,assertPhysicsHandout} from './live-physics-handout-fixture.mjs';

const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(acceptance);
const wordRequest=process.argv.includes('--word-request');
const sameTitle=process.argv.includes('--same-title');
const confirmFixture=process.argv.includes('--confirm-fixture');
const live=process.argv.includes('--live');
const namedBasis=process.argv.includes('--named-basis');
const physics=process.argv.includes('--physics');
assert(physics ? live&&namedBasis : !(live&&namedBasis));
assert(!sameTitle||!live&&!namedBasis);
const apiKey=live?process.env.DEEPSEEK_API_KEY:'synthetic-teaching-handout';
assert(apiKey,'Missing DeepSeek test credential');
const output=fs.mkdtempSync(path.join(acceptance,'teaching-handout-'));
const data=path.join(output,'data'), profile=path.join(output,'profile');
const desktop=path.resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const modelTool='education_create_teaching_handout';
const title=physics?physicsHandout.title:'等式变形分层学案';
const quote=physics?physicsHandout.quote:'等式两边同时减去同一个数，等式仍然成立。';
const firstName=physics?physicsHandout.firstName:'等式性质参考.md';
const secondName=physics?physicsHandout.secondName:'代回检验.md';
const duplicateName=physics?physicsHandout.duplicateName:'等式性质补充.md';
const original=path.join(output,firstName);
fs.writeFileSync(original,'# '+path.basename(firstName,'.md')+'\n\n'+quote+'\n\n'+
  (physics?'水的密度取 1000 kg/m³ 时，可用 F浮 = ρ液 g V排 计算。':'等式两边同时除以同一个非零数，等式仍然成立。'));
const secondQuote=physics?physicsHandout.secondQuote:'解方程后应把得到的未知数值代回原方程检验。';
const distractorQuote=physics?physicsHandout.distractor:'复习时可用算例检查等式性质的适用条件。';
const inputs=[original];
if(namedBasis){
  const second=path.join(output,secondName);
  fs.writeFileSync(second,'# '+path.basename(secondName,'.md')+'\n\n'+secondQuote+
    (physics?'\n\n在题目给出的重力加速度下，可用 G = mg 求物重。':''));
  for(const [folder,text] of [['v1',distractorQuote],['v2','这是一份同名的独立算例。']]){
    fs.mkdirSync(path.join(output,folder));
    const duplicate=path.join(output,folder,duplicateName);
    fs.writeFileSync(duplicate,'# 补充资料\n\n'+text);
    inputs.push(duplicate);
  }
  inputs.push(second);
}
const report={ok:false,output,main,mainHash:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),title,checks:[],errors:[],paidRequests:0};
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
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_API_KEY:apiKey,DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop});
  await app.evaluate(({net,dialog},{cold,title,quote,modelTool,inputs,wordRequest,live,namedBasis,secondQuote,distractorQuote})=>{
    const wire=globalThis.handoutWire={requests:[],results:[]};
    const remote=net.fetch.bind(net);
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:inputs});
    net.fetch=async(raw,init)=>{
      const url=new URL(typeof raw==='string'?raw:raw.url);
      if(url.origin!=='https://api.deepseek.com')throw Error('External request blocked');
      if(url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{
        id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],
        effort:{supported_levels:['low','high','max'],default_level:'high'},
      }]}),{headers:{'content-type':'application/json'}});
      if(cold||url.pathname!=='/v1/chat/completions')throw Error('Unexpected model dispatch');
      if(live){
        if(wire.requests.length>=10)throw Error('Live synthetic handout request limit');
        const request={sentAt:Date.now(),status:0};
        wire.requests.push(request);
        const response=await remote(raw,init);
        request.status=response.status;
        return response;
      }
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
      const source=(resourceId,quote)=>({resourceId,offset:0,quote});
      const document=(citation,extras=[])=>({schemaVersion:'xiaozhi.teaching-handout.v1',title,targetLevel:'七年级',
        chapters:[{title:'等式两边同做一种运算',objectives:['用等式性质解一元一次方程'],
          focus:'保持等式两侧同步运算。',difficulty:'除法步骤必须说明除数非零。',
          explanation:'等式性质可以用于移项。比如 $3x+7=25$ 可先在两边同时减去 7。',
          example:{prompt:'解方程 $3x+7=25$。',steps:['两边同减 7，得到 $3x=18$。','两边同除以 3，得到 $x=6$。','把 6 代回原式核验。'],answer:'$x=6$'},
          exercises:[{prompt:'解 $2x+3=15$。',difficulty:'基础',answer:'$x=6$',explanation:'先两边减 3，再除以 2。'},
            {prompt:'解 $5x-2=2x+7$ 并代回。',difficulty:'巩固',answer:'$x=3$',explanation:'两边减去 $2x$ 并加 2，得到 $3x=9$。'}],
          citations:[source(wire.resourceId,citation),...extras]}],sourceGaps:[]});
      let offer;
      if(wire.planning){
        expect(!wire.probe,'The new task may not read any handout');
      }else if(wire.probe){
        if(!wire.probeResult&&wire.requests.length===wire.probeStart){
          offer={name:'education_read_handout_for_edit',args:{}};
        }else{
          wire.probeResult=latest();
        }
      }else if(namedBasis){
        const read=resourceId=>({name:'office_read_material',args:{resourceId,offset:0}});
        const save=args=>({name:modelTool,args});
        const withRootCitations=draft=>{
          const [{citations,...chapter}]=draft.chapters;
          return {...draft,chapters:[chapter],citations};
        };
        const result=phase?latest():undefined;
        if(result)wire.results.push(result);
        const {first,second,distractor}=wire.ids;
        if(phase===0){
          const system=JSON.stringify(body.messages.filter(item=>item.role==='system'));
          const current=JSON.stringify(body.messages.filter(item=>item.role==='user').at(-1));
          expect(current.includes('宿主已按完整名称找到指定资料')&&current.includes(first)&&current.includes(second)&&!current.includes(distractor),'Named source scope was not delivered with the current request');
          expect(!system.includes(first)&&!system.includes(second),'Run-specific resources changed the stable system prompt');
          wire.resourceId=first;
          offer=read(first);
        }else if(phase===1){
          expect(result.text?.includes(quote),'First named source was not read');
          offer=save(document(quote));
        }else if(phase===2){
          expect(result.error==='named_sources_required','Omitted named source was accepted');
          offer=read(distractor);
        }else if(phase===3){
          expect(result.text?.includes(distractorQuote),'Distractor source was not read');
          offer=save(document(quote,[source(distractor,distractorQuote)]));
        }else if(phase===4){
          expect(result.error==='named_sources_required','A read but unnamed source replaced a named source');
          offer=read(second);
        }else if(phase===5){
          expect(result.text?.includes(secondQuote),'Second named source was not read');
          offer=save(withRootCitations(document(quote,[source(second,'本句不在第二份资料正文中。')])));
        }else if(phase===6){
          expect(result.error==='source_quote_mismatch','Repositioning a false quote must still fail source verification');
          const draft=document(quote,[source(second,secondQuote)]);
          offer=save({...draft,chapters:[...draft.chapters,{...draft.chapters[0],title:'第二章'}],citations:draft.chapters[0].citations});
        }else if(phase===7){
          expect(result.unparsed?.includes('chapters[i].citations'),'Unassigned citations across chapters must get actionable feedback');
          const draft=document(quote,[source(second,secondQuote)]);
          offer=save({...draft,citations:[source(first,quote)]});
        }else if(phase===8){
          expect(result.unparsed?.includes('chapters[i].citations'),'Conflicting copies of citations must be rejected');
          offer=save(withRootCitations(document(quote,[source(second,secondQuote)])));
        }else if(phase===9){
          expect(result.success&&!result.teacherConfirmed&&result.sourceCount===2,'Draft with misplaced citations did not retain both sources');
          wire.bookId=result.bookId;
          const draft=document(quote,[source(second,secondQuote)]);
          const citations=draft.chapters[0].citations.map(({resourceId,offset,quote})=>({quote,offset,resourceId}));
          offer=save({...draft,citations});
        }else if(phase===10){
          expect(result.bookId===wire.bookId,'Identical retry did not return same draft');
          offer=save({...document(quote,[source(second,secondQuote)]),title:'另一份冲突草稿'});
        }else if(phase===11)expect(result.error==='conflict','Conflicting retry did not stop');
        expect(phase<=11,'Unexpected model request after named handout save');
      }else if(phase){
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
        function:{name:offer.name,arguments:JSON.stringify(offer.args)}}]}:{content:wire.planning?'课堂检查清单：读题、列式、验算。':wire.probe?'请确认要修改的原讲义。':'已保存可编辑学案草稿，请打开讲义核对。'};
      return new Response(event({role:'assistant'})+event(delta)+event({},offer?'tool_calls':'stop')+'data: [DONE]\n\n',
        {headers:{'content-type':'text/event-stream'}});
    };
  },{cold,title,quote,modelTool,inputs,wordRequest,live,namedBasis,secondQuote,distractorQuote});
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

async function verifyLive(state,wire){
  const [handout]=state.teachingHandouts;
  assert.equal(state.teachingHandouts.length,1);
  assert.equal(handout.taskId,state.task?.id);
  assert.equal(state.projection.turns.at(-1)?.status,'completed');
  assert(wire.requests.length>0&&wire.requests.every(request=>request.status===200));
  const events=sql('SELECT event_json FROM xiaozhi_event_journal WHERE run_id=? ORDER BY rowid',[handout.runId]).map(row=>JSON.parse(row.event_json));
  const read=events.findIndex(event=>event.kind==='tool_end'&&event.tool==='office_read_material'&&event.success);
  const save=events.findIndex(event=>event.kind==='tool_end'&&event.tool===modelTool&&event.success);
  assert(read>=0&&save>read,'Read the stored source before drafting');
  assert.equal(sql('SELECT book_id FROM teaching_handout_origins WHERE session_id=?',[sessionId]).length,1);
  report.sessionId=sessionId; report.bookId=handout.bookId; report.runId=handout.runId; report.taskId=handout.taskId;
  report.wire=wire;
  await card().getByTestId('pi-teaching-handout-open').click();
  const preview=page.getByTestId('teaching-book-preview');
  await preview.waitFor();
  const book=await getBook(handout.bookId);
  assert.equal(book.book.title,title);
  assert.equal(book.book.status,'draft');
  const role=name=>book.blocks.filter(block=>block.metadata.handoutRole===name);
  assert.equal(book.chapters.length,1);
  assert.match(role('focus')[0].payload.text,/重点.+难点/su);
  assert.deepEqual(role('exercise').map(block=>block.title.split(' · ').at(-1)),['基础','巩固']);
  if(physics){
    assertPhysicsHandout(role);
    assert.deepEqual(new Set(book.materialSources.map(item=>item.resourceId)),new Set([wire.ids.first,wire.ids.second]));
    assert(events.slice(0,save).filter(event=>event.kind==='tool_end'&&event.tool==='office_read_material'&&event.success).length>=2);
    for(const item of book.materialSources){
      const file=item.resourceId===wire.ids.first?original:inputs.at(-1);
      assert(book.sources.some(source=>source.ref===item.chunkId&&fs.readFileSync(file,'utf8').includes(source.snippet)));
    }
  }else{
    const math=text=>text.replace(/[\s$`\\]/gu,'').replaceAll('−','-');
    assert.match(math(role('example')[0].payload.text),/3x\+7=25/u);
    const steps=math(role('worked_solution')[0].payload.text);
    assert.match(steps,/3x=18/u);
    assert.match(steps,/x=6/u);
    assert.match(steps,/代回|检验|验证/u);
    for(const [index,equation,answer] of [[0,/2x\+3=15/u,/x=6/u],[1,/5x-2=2x\+7/u,/x=3/u]]){
      assert.match(math(role('exercise')[index].payload.text),equation);
      assert.match(math(role('exercise_solution')[index].payload.text),answer);
    }
    assert(book.sources.length&&book.sources.every(source=>fs.readFileSync(original,'utf8').includes(source.snippet)));
  }
  for(const material of book.materialSources){
    await page.getByTestId('teaching-book-source-'+material.chunkId).getByTestId('pi-material-source-open').click();
    await page.getByTestId('materials-chunk-'+material.chunkId).waitFor();
    await page.getByTestId('desktop-back').click();
    await preview.waitFor();
  }
  assert(await preview.locator('math').count()>0);
  check('Real provider creates a sourced editable handout with the independently checked example and two exercises.');
  await page.setViewportSize({width:1366,height:768});
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'live-draft-1366.png')});
  await page.getByTestId('teaching-book-review-current').click();
  await page.getByTestId('teaching-book-version-confirm').click();
  const [version]=await until(()=>{const rows=sql("SELECT id,digest FROM teaching_book_versions WHERE book_id=? AND kind='confirmed'",[book.book.id]);return rows.length&&rows;});
  report.confirmedVersion=version;
  await app.close(); app=undefined;
  await launch(true);
  await card().getByTestId('pi-teaching-handout-open').click();
  await page.getByTestId('teaching-book-version-status').waitFor();
  assert.deepEqual(sql("SELECT id,digest FROM teaching_book_versions WHERE book_id=? AND kind='confirmed'",[book.book.id]),[version]);
  assert.deepEqual((await app.evaluate(()=>globalThis.handoutWire)).requests,[]);
  await page.setViewportSize({width:1920,height:1080});
  await page.screenshot({path:path.join(output,'live-confirmed-1920.png')});
  check('Teacher confirmation is durable and the original handout opens after cold start with no model replay.');
}

async function verifyControlled(state,wire,oldBook){
  assert.equal(wire.error,undefined);
  assert.equal(wire.requests.length,namedBasis?12:7);
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
  assert.equal(originalBook.materialSources[0].resourceId,wire.resourceId);
  const material=originalBook.materialSources[0];
  assert.equal(originalBook.sources.find(item=>item.ref===material.chunkId).snippet,quote);
  if(namedBasis){
    assert.deepEqual(originalBook.materialSources.map(item=>item.resourceId),[wire.ids.first,wire.ids.second]);
    assert.deepEqual(new Set(originalBook.sources.map(item=>item.snippet)),new Set([quote,secondQuote]));
    assert.equal(wire.requests[0],'office_read_material');
    assert(!wire.requests.includes('office_list_materials'));
    check('Exact names resolve before model dispatch; saved book contains both requested sources and no substitutes');
    check('Both observed single-chapter citation layouts converge on one draft; ambiguous layouts and false quotes are rejected');
  }
  await page.setViewportSize({width:1366,height:768});
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'editable-handout-1366.png'),animations:'disabled'});
  await page.setViewportSize({width:1920,height:1080});
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'editable-handout-1920.png'),animations:'disabled'});
  check('Conversation opens exact editable handout with chapter, staged exercises and locally rendered formulas',{blockCount:originalBook.blocks.length});

  await page.getByTestId('teaching-book-source-'+material.chunkId).getByTestId('pi-material-source-open').click();
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
}

async function verifySameTitleTasks(first){
  // Restore the original conversation after closing the editor. Each new task is created by the teacher UI.
  await app.close();app=undefined;
  await launch();
  await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);
  const endCurrent=async()=>{
    const review=page.getByTestId('pi-task-review').last();
    const toggle=review.getByTestId('pi-task-review-toggle');
    if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
    await review.getByTestId('pi-task-cancel').click();
    await review.getByTestId('pi-task-confirm-cancel').click();
    await until(async()=>(await snapshot()).task?.state==='ended');
  };
  const send=async(prompt)=>{
    const old=(await snapshot()).projection.turns.at(-1)?.id;
    await page.getByTestId('office-prompt-input').fill(prompt);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    return until(async()=>{
      const state=await snapshot(),turn=state.projection.turns.at(-1);
      if(!turn||turn.id===old||state.running)return;
      assert.equal(turn.status,'completed',JSON.stringify({turn:turn.status,wire:await app.evaluate(()=>globalThis.handoutWire.error)}));
      return state;
    });
  };
  const origins=()=>sql('SELECT book_id,task_id FROM teaching_handout_origins WHERE session_id=? ORDER BY created_at,book_id',[sessionId]);
  const initial=await getBook(first.bookId);
  await endCurrent();
  const secondState=await send('请参考相关本地资料制作一份七年级新学案，标题是《'+title+'》，包含例题和分层练习。');
  const second=origins().find(row=>row.book_id!==first.bookId);
  assert.equal(origins().length,2);
  assert(second&&second.task_id!==first.taskId&&second.task_id===secondState.task.id);
  assert.equal((await getBook(second.book_id)).book.title,initial.book.title);
  const secondBefore=await getBook(second.book_id);
  await endCurrent();
  await app.evaluate(()=>{globalThis.handoutWire.planning=true;});
  const unrelated=await send('请整理三条课堂检查要点，仅在聊天中给出清单。');
  assert(unrelated.task?.id&&!origins().some(row=>row.task_id===unrelated.task.id));
  await app.evaluate(()=>{globalThis.handoutWire.planning=false;});
  const probes=[];
  for(const [prompt,expected] of [['修改这份讲义，只改第一题。','book_selection_required'],['请修改《'+title+'》，只改第一题。','ambiguous']]){
    await app.evaluate(()=>{const w=globalThis.handoutWire;w.probe=true;w.probeStart=w.requests.length;w.probeResult=null;});
    const state=await send(prompt);
    assert(!origins().some(row=>row.task_id===state.task?.id));
    const result=await app.evaluate(()=>globalThis.handoutWire.probeResult);
    assert.equal(result?.error,expected,JSON.stringify(result));
    assert(!result.chapter&&!result.digest);
    if(expected==='ambiguous')assert.deepEqual(result.choices.map(choice=>choice.bookId).sort(),[first.bookId,second.book_id].sort());
    else assert(!result.choices&&!JSON.stringify(result).includes(title));
    probes.push({prompt,taskId:state.task?.id,result});
    if(expected==='book_selection_required')assert.equal(state.task.id,unrelated.task.id);
    else if(state.task.id!==unrelated.task.id)assert.equal(state.task.origin.runId,state.projection.turns.at(-1).id);
    assert.deepEqual(sql('SELECT key FROM app_settings WHERE key=?',['xiaozhi.memory-use.task.v1:'+state.task.id]),[]);
  }
  assert.deepEqual((await getBook(first.bookId)).blocks,initial.blocks);
  assert.deepEqual((await getBook(second.book_id)).blocks,secondBefore.blocks);
  assert.equal(sql('SELECT id FROM teaching_handout_edit_reviews').length,0);
  report.sameTitle={origins:origins(),probes};
  check('Two genuine same-title handouts from separate tasks remain untouched; an unbound task must get a teacher selection before reading either.');
}

try{
  await launch();
  const oldBook=await page.evaluate(()=>window.omniEdu.createTeachingBook({title:'此前的独立讲义'}));
  if(await page.getByTestId('ai-return-workspace').isVisible())await page.getByTestId('ai-return-workspace').click();
  await page.getByTestId('nav-knowledge').click();
  await page.getByTestId('materials-import').click();
  const saved=await until(()=>{
    const rows=sql("SELECT id,original_file_name AS name,content_hash AS hash FROM teacher_resources WHERE parse_status IN ('ready','parsed','chunked','indexed','graph_extracted')");
    return rows.length===inputs.length&&rows;
  });
  await page.getByTestId('desktop-back').click();
  const input=page.getByTestId('office-prompt-input');
  if(namedBasis){
    const ids={first:saved.find(row=>row.name===firstName).id,
      second:saved.find(row=>row.name===secondName).id,
      distractor:saved.find(row=>row.hash===createHash('sha256').update(fs.readFileSync(inputs[1])).digest('hex')).id};
    await app.evaluate((_electron,ids)=>{globalThis.handoutWire.ids=ids;},ids);
    for(const [file,feedback] of [[path.basename(firstName,'.md')+'缺件','找不到讲义指定的文件'],[duplicateName,'核对重名文件']]){
      const originalPrompt=`请根据资料库里的《${file}》制作一份七年级讲义。`;
      await input.fill(originalPrompt);
      await page.getByRole('button',{name:'发送消息',exact:true}).click();
      await page.getByTestId('pi-composer-viewport').getByRole('alert').filter({hasText:feedback}).waitFor({timeout:15000});
      assert.equal(await input.inputValue(),originalPrompt);
      assert.equal((await app.evaluate(()=>globalThis.handoutWire.requests)).length,0);
      assert.equal(sql('SELECT book_id FROM teaching_handout_origins').length,0);
      check('Composer retains draft and explains '+(file.endsWith('.md')?'duplicate exact file name':'missing exact file name')+' before model dispatch');
    }
  }
  const request=(namedBasis?'请根据资料库里的《等式性质参考.md》以及《代回检验》':live?'请根据资料库里《等式性质参考》':'请参考相关本地资料')+'制作一份七年级一元一次方程的可编辑'+
    (wordRequest?' Word ':'')+'学案，包含重点难点、分步例题和分层练习。';
  await input.fill(physics?physicsHandout.prompt:live?request+'标题是《等式变形分层学案》，只做一章。例题用 3x+7=25，写出两边同减、同除、代回检验。两道练习按基础、巩固排序，分别用 2x+3=15 和 5x-2=2x+7，保留答案与解析。引用实读到的等式性质，先保存讲义草稿让我核对。':request);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  sessionId=await until(async()=>{
    const id=await page.locator('.office-composer-container').getAttribute('data-session-id');
    return /^aisession_[a-f0-9-]{36}$/u.test(id??'')&&id;
  });
  const state=await until(async()=>{
    const value=await snapshot();
    const turn=value.projection.turns.at(-1);
    if((live||namedBasis)&&!value.running&&turn&&['failed','completed','interrupted'].includes(turn.status)&&!value.teachingHandouts?.length)
      throw Error('Run ended without a saved handout: '+turn.status+' '+(turn.errorCode||''));
    return !value.running&&turn?.status!=='running'&&value.teachingHandouts?.length&&value;
  });
  const wire=await app.evaluate(()=>globalThis.handoutWire);
  if(live){
    report.paidRequests=wire.requests.length;
    await verifyLive(state,wire);
  }else{
    await verifyControlled(state,wire,oldBook);
    if(sameTitle)await verifySameTitleTasks(state.teachingHandouts[0]);
    if(confirmFixture){
      await page.getByTestId('teaching-book-review-current').click();
      await page.getByTestId('teaching-book-version-confirm').click();
      report.confirmedVersion=await until(()=>sql("SELECT id,digest FROM teaching_book_versions WHERE book_id=? AND kind='confirmed'",[report.bookId])[0]);
      report.confirmationSource='teacher-ui';
      check('The real editor confirms this synthetic handout for the same-build export journey');
    }
  }
  report.ok=true;
}catch(error){
  report.error=String(error.stack);
  report.wire=await app?.evaluate(()=>globalThis.handoutWire).catch(()=>undefined);
  if(live&&!report.paidRequests)report.paidRequests=report.wire?.requests.length||0;
  report.snapshot=await snapshot().then(state=>{
    const turn=state.projection.turns.at(-1);
    return {running:state.running,turn:live?{status:turn?.status,errorCode:turn?.errorCode}:turn};
  }).catch(()=>undefined);
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
  console.error(report.error);
  process.exitCode=1;
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));
}
