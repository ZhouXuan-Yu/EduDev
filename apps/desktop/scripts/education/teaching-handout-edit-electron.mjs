import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';

const root=process.env.OMNI_EDU_ACCEPTANCE_ROOT,fixture=process.env.OMNI_EDU_HANDOUT_FIXTURE;
assert(root&&fixture);
const baseline=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
const {bookId,sessionId}=baseline;
assert(baseline.ok&&bookId&&sessionId);
const output=fs.mkdtempSync(path.join(root,'handout-edit-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),oldData=path.join(fixture,'data');
const journal=path.join(oldData,'app.db-wal');
assert(!fs.existsSync(journal)||!fs.statSync(journal).size);
fs.cpSync(oldData,data,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)});
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const report={ok:false,output,bookId,sessionId,main,sha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),
  paidRequests:0,checks:[],errors:[]};
let app,page;

function sql(query,args=[],write=false){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:!write});
  try{db.exec('PRAGMA busy_timeout=5000');return write?db.prepare(query).run(...args):db.prepare(query).all(...args);}
  finally{db.close();}
}
function check(name){report.checks.push(name);console.log('PASS '+name);}
async function until(read,timeout=60000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const value=await read();
    if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  throw Error('Timed out while waiting for handout edit');
}
const reviewTool='education_propose_handout_edit',readTool='education_read_handout_for_edit';
const title='等式变形分层学案';
const schemaVersion='xiaozhi.handout-edit.v1';
const phases={
  apply:'修改《等式变形分层学案》。第一章标题改为「等式变形与验算」，将知识讲解中的「等式性质可以用于移项。」改为「等式变形后要代回原式验算。」。把第 2 道练习调为基础并改成 5x-2=2x+10，更新答案和解析。',
  reject:'将《等式变形分层学案》第 2 道练习改为拓展，我先核对再决定。',
  conflict:'把《等式变形分层学案》的知识讲解段落改成强调核对两边同做一种运算。',
  source:'再次修改《等式变形分层学案》的讲解段落，先由我核对后再应用。',
  stop:'修改《等式变形分层学案》，第 2 道练习调为拓展。',
  interrupted:'修改《等式变形分层学案》，把第 2 道练习变成拓展，先等我确认。',
};

async function launch(cold=false){
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-teaching-handout-edit',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  await app.evaluate(({net},{cold,title,readTool,reviewTool})=>{
    globalThis.handoutEditTest={cold,requests:[],errors:[]};
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin==='https://api.deepseek.com'&&url.pathname==='/v1/models')
        return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),
          {headers:{'content-type':'application/json'}});
      const state=globalThis.handoutEditTest;
      try{
        if(cold||url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')throw Error('Unexpected external dispatch');
        const phase=state.phase,body=JSON.parse(init.body),index=state.index++;
        const raw=body.messages.findLast(message=>message.role==='tool')?.content;
        const text=typeof raw==='string'?raw:raw?.map(part=>part.text||'').join('\n');
        let previous={};
        if(index>0&&text){
          try{previous=JSON.parse(text.split('\n')[0]);}catch{previous={unparsed:text};}
        }
        let call,content;
        if(index===0)call={name:readTool,args:{title}};
        else if(index===1&&phase==='apply'){
          if(!previous.success||!previous.chapter)throw Error('Unable to read exact handout: '+JSON.stringify(previous));
          state.scoped=previous;
          call={name:readTool,args:{bookId:previous.bookId,chapterId:previous.chapter.id,
            blockId:previous.chapter.blocks.find(item=>item.role==='explanation').id}};
        }else if(index===1||index===2&&phase==='apply'){
          if(!previous.success||!previous.chapter)throw Error('Unable to read exact handout: '+JSON.stringify(previous));
          if(phase==='apply'&&(previous.chapter.blocks.length!==1||previous.chapter.blocks[0].role!=='explanation'))
            throw Error('Single-block read did not constrain the model context');
          const {bookId,digest,chapter}=phase==='apply'?state.scoped:previous;
          const block=chapter.blocks.find(item=>item.role==='explanation');
          const question=chapter.blocks.find(item=>item.title.startsWith('练习 2 ·'));
          const paragraph={kind:'paragraph',blockId:block.id,selectedText:phase==='apply'?'等式性质可以用于移项。':'等式变形后要代回原式验算。',
            replacement:phase==='apply'?'等式变形后要代回原式验算。':'每次运算都应同步作用于等式两边。'};
          const exercise={kind:'exercise',blockId:question.id,difficulty:phase==='apply'?'基础':'拓展',
            ...(phase==='apply'?{prompt:'解 $5x-2=2x+10$ 并代回。',answer:'$x=4$',explanation:'两边减去 $2x$ 并加 2，得到 $3x=12$。'}:{})};
          state.valid=phase==='apply'?{bookId,digest,changes:[{kind:'chapter',chapterId:chapter.id,title:'等式变形与验算',
            objectives:['用代入检查解是否满足原方程']},paragraph,exercise]}:
            {bookId,digest,changes:[phase==='conflict'||phase==='source'?paragraph:exercise]};
          call={name:reviewTool,args:phase==='apply'?{bookId,digest,changes:[{...paragraph,selectedText:'这句话不在原文里'}]}:state.valid};
        }else if(index===3&&phase==='apply'){
          if(previous.success||previous.error!=='selection_conflict')throw Error('Wrong selection did not fail: '+JSON.stringify(previous));
          call={name:reviewTool,args:state.valid};
        }else content=previous.success?'老师已应用修改，当前讲义等待版本确认。':'这次建议未应用。';
        if(call&&!body.tools?.some(tool=>tool.function.name===call.name))throw Error('Tool unavailable: '+call.name);
        state.requests.push({phase,index,tool:call?.name,previous:index===1?{success:previous.success,bookId:previous.bookId}:previous});
        const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'handout-edit',object:'chat.completion.chunk',
          created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
        const update=call?{tool_calls:[{index:0,id:'edit-'+phase+'-'+index,type:'function',
          function:{name:call.name,arguments:JSON.stringify(call.args)}}]}:{content};
        return new Response(chunk({role:'assistant',content:''})+chunk(update)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',
          {headers:{'content-type':'text/event-stream'}});
      }catch(error){state.errors.push(String(error));throw error;}
    };
  },{cold,title,readTool,reviewTool});
  page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await assertIsolatedPiMain(app,main,profile);
  await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId);
}
const reviews=()=>sql('SELECT id,session_id,run_id,call_id,state,value_json,version_json FROM teaching_handout_edit_reviews ORDER BY rowid');
const versions=()=>sql('SELECT id,kind,digest,image_json FROM teaching_book_versions WHERE book_id=? ORDER BY revision',[bookId]);
const current=()=>page.evaluate(id=>window.omniEdu.getTeachingBook(id),bookId);
const blockOf=(content,role,number)=>content.blocks.find(block=>block.metadata.handoutRole===role&&(!number||block.title.startsWith('练习 '+number+' ·')));
const reply=()=>page.getByTestId('pi-handout-edit').last();
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
async function send(phase){
  await until(async()=>!(await snapshot()).running&&!await page.getByTestId('office-prompt-input').isDisabled());
  await app.evaluate((_electron,phase)=>Object.assign(globalThis.handoutEditTest,{phase,index:0}),phase);
  await page.getByTestId('office-prompt-input').fill(phases[phase]);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const approve=reply().getByTestId('pi-handout-edit-approve');
  await until(async()=>{
    const [run]=sql('SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1');
    assert.notEqual(run?.status,'failed',run?.error_message);
    return await approve.isVisible()&&!await approve.isDisabled();
  });
  return approve;
}
async function settle(state){
  await until(()=>reviews().at(-1)?.state===state);
  await until(async()=>!(await snapshot()).running);
  const wire=await app.evaluate(()=>globalThis.handoutEditTest);
  assert.deepEqual(wire.errors,[]);
}

try{
  const [resource]=sql('SELECT id,local_path FROM teacher_resources');
  const relative=path.relative(oldData,resource.local_path);
  assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  assert(fs.existsSync(path.join(data,relative)));
  sql('UPDATE teacher_resources SET local_path=? WHERE id=?',[path.join(data,relative),resource.id],true);
  const baselineVersions=versions();
  await launch();
  const before=await current();
  await page.setViewportSize({width:1366,height:768});
  const approve=await send('apply');
  const proposal=reviews().at(-1);
  assert.equal(reviews().length,1);
  assert.deepEqual(versions(),baselineVersions);
  assert.deepEqual((await current()).blocks,before.blocks);
  const preview=reply().getByTestId('pi-handout-edit-diffs');
  const diffText=await preview.innerText();
  assert.match(diffText,/修改前.*修改后/su);
  assert.match(diffText,/等式变形与验算/);
  assert.match(diffText,/参考答案/);
  assert(await preview.locator('math').count()>0);
  const layout=await preview.evaluate(element=>({overflow:getComputedStyle(element).overflowY,height:element.clientHeight,content:element.scrollHeight}));
  assert(layout.overflow==='auto'&&layout.height<layout.content);
  await approve.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'review-1366.png')});
  const fake=await page.evaluate(({sessionId,schemaVersion,id})=>window.omniEdu.decideHandoutEdit({
    sessionId,schemaVersion,id,fingerprint:'a'.repeat(64),action:'approve'}),{sessionId,schemaVersion,id:proposal.id});
  assert(!fake.ok&&fake.error==='permission_denied');
  await approve.click();
  await settle('applied');
  const after=await current();
  assert.equal(after.chapters[0].title,'等式变形与验算');
  assert.deepEqual(after.chapters[0].learningObjectives,['用代入检查解是否满足原方程']);
  const oldText=blockOf(before,'explanation').payload.text,newText=blockOf(after,'explanation').payload.text;
  assert.equal(newText,oldText.replace('等式性质可以用于移项。','等式变形后要代回原式验算。'));
  assert.deepEqual(after.blocks.filter(block=>!['explanation'].includes(block.metadata.handoutRole)&&!block.title.startsWith('练习 2 ·')),
    before.blocks.filter(block=>!['explanation'].includes(block.metadata.handoutRole)&&!block.title.startsWith('练习 2 ·')));
  assert.equal(blockOf(after,'exercise',2).title,'练习 2 · 基础');
  assert.match(blockOf(after,'exercise_solution',2).payload.text,/\$x=4\$/);
  assert.deepEqual(after.sources,before.sources);
  assert.deepEqual(versions().slice(0,baselineVersions.length),baselineVersions);
  assert.deepEqual(versions().slice(-2).map(item=>item.kind),['before_edit','edited_draft']);
  assert.equal(sql("SELECT COUNT(*) AS n FROM teaching_book_patches WHERE reason LIKE '对话审阅 %' AND status='applied'")[0].n,3);
  const replay=await page.evaluate(({sessionId,schemaVersion,id,fingerprint})=>window.omniEdu.decideHandoutEdit({
    sessionId,schemaVersion,id,fingerprint,action:'approve'}),{sessionId,schemaVersion,id:proposal.id,
    fingerprint:(await snapshot()).handoutEdits.find(item=>item.id===proposal.id).fingerprint});
  assert(replay.ok&&replay.value.version?.id===versions().at(-1).id);
  assert.equal(versions().length,baselineVersions.length+2);
  const [patch]=sql("SELECT id FROM teaching_book_patches WHERE reason LIKE '对话审阅 %' LIMIT 1");
  assert(await page.evaluate(id=>window.omniEdu.undoTeachingBookPatch(id).then(()=>false,()=>true),patch.id));
  check('Exact chapter, paragraph and paired question edits apply once, preserve untouched data and create recoverable versions');

  await page.setViewportSize({width:1920,height:1080});
  await send('reject');
  await reply().getByTestId('pi-handout-edit-reject').click();
  await settle('rejected');
  assert.deepEqual((await current()).blocks,after.blocks);
  assert.equal(versions().length,baselineVersions.length+2);
  check('Rejected proposal leaves the book and version history unchanged');

  const conflictApprove=await send('conflict');
  const modifying=blockOf(after,'focus');
  await page.evaluate(block=>window.omniEdu.upsertTeachingBookBlock({
    pageId:block.pageId,type:block.type,title:block.title,status:block.status,payload:{text:'老师在另一个界面保存的重点。'},
    params:block.params,metadata:block.metadata,sourceAnchors:block.sourceAnchors,order:block.order,
  },block.id,block.version),modifying);
  await conflictApprove.click();
  await settle('conflict');
  const competing=await current();
  assert.equal(blockOf(competing,'focus').payload.text,'老师在另一个界面保存的重点。');
  assert.equal(blockOf(competing,'explanation').payload.text,newText);
  assert.equal(versions().length,baselineVersions.length+2);
  check('A concurrent teacher edit invalidates the base version without overwriting either block');

  const sourceApprove=await send('source');
  const [source]=sql('SELECT id,content_md FROM resource_chunks WHERE id=?',[competing.materialSources[0].chunkId]);
  assert(sql('UPDATE resource_chunks SET content_md=? WHERE id=?',[source.content_md+'\n合成资料在预览后修订。',source.id],true).changes);
  await sourceApprove.click();
  await settle('conflict');
  assert.equal(blockOf(await current(),'explanation').payload.text,newText);
  sql('UPDATE resource_chunks SET content_md=? WHERE id=?',[source.content_md,source.id],true);
  check('Changed citation content invalidates the preview and causes no partial writes');

  await send('stop');
  await page.getByRole('button',{name:'停止本轮',exact:true}).click();
  await settle('interrupted');
  assert.deepEqual((await current()).blocks,competing.blocks);
  check('Stopping a live teacher review leaves the book unchanged');

  await send('interrupted');
  const pending=reviews().at(-1);
  await app.close();
  app=undefined;
  await launch(true);
  assert.equal(reviews().at(-1).state,'interrupted');
  assert.deepEqual((await app.evaluate(()=>globalThis.handoutEditTest)).requests,[]);
  const reopen=await page.evaluate(({sessionId,schemaVersion,id})=>window.omniEdu.reviewHandoutEdit({sessionId,schemaVersion,id}),
    {sessionId,schemaVersion,id:pending.id});
  assert(reopen.ok&&reopen.value.summary.state==='interrupted');
  assert.equal(versions().length,baselineVersions.length+2);
  check('Shutdown settles pending review as interrupted and cold start never replays it');

  const savedCard=page.locator('[data-testid="pi-handout-edit"][data-state="applied"]').first();
  const open=savedCard.getByTestId('pi-handout-edit-open');
  if(!await open.isVisible())await savedCard.getByRole('button',{name:/已保存为草稿/u}).click();
  await open.click();
  await until(async()=>/待确认/u.test(await page.getByTestId('teaching-book-version-status').innerText()));
  const disclosure=page.getByTestId('teaching-book-version-disclosure');
  const checkpoint=page.getByTestId('teaching-book-version-open-'+(baselineVersions.length+1));
  if(!await checkpoint.isVisible())await disclosure.getByRole('button',{name:'历史版本'}).click();
  await checkpoint.click();
  await page.getByTestId('teaching-book-version-dialog').waitFor();
  assert.match(await page.getByTestId('teaching-book-version-preview').innerText(),/等式两边同做一种运算/);
  await page.screenshot({path:path.join(output,'rollback-preview-1920.png')});
  await page.getByTestId('teaching-book-version-restore').click();
  await until(async()=>blockOf(await current(),'exercise',2).title==='练习 2 · 巩固');
  assert.equal(blockOf(await current(),'explanation').payload.text,oldText);
  assert.deepEqual(report.errors,[]);
  check('Opening the exact edited book exposes previous content and restores the original paired exercise');
  report.ok=true;
}catch(error){
  report.errors.push(String(error?.stack||error));
  if(app)report.wire=await app.evaluate(()=>globalThis.handoutEditTest).catch(()=>null);
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
  console.error(error);
  process.exitCode=1;
}finally{
  if(app)await app.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(output);
}
