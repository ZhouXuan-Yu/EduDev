import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { _electron as electron } from 'playwright'
import { testMain,assertIsolatedPiMain } from '../acceptance/build-root.mjs'

const lane=process.argv[2]
assert(['A_prime','B'].includes(lane))
const extended=process.argv.includes('--rebuild')
const offline=process.argv.includes('--offline')
if(extended||offline)assert.equal(lane,'B')
assert(!(extended&&offline))
const testContainer='edudev-history-r1-test'
if(offline)assert.equal(process.env.OMNI_EDU_HISTORY_LOOPBACK,'http://127.0.0.1:18891')
const key=process.env.DEEPSEEK_API_KEY
const evidence=process.env.OMNI_EDU_ACCEPTANCE_ROOT
assert(key&&evidence)
const root=fs.mkdtempSync(path.join(evidence,'history-r1-'+lane+'-'))
const data=path.join(root,'data'),profile=path.join(root,'profile')
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop)
const marker='先圈平方项，再抄对称轴'
const source='这是合成教师规则。九年级二次函数配方法的讲义固定口令：'+marker+'。请只回复收到。'
const confirmQuery='请参考这位老师以前的二次函数配方法讲义，先调用读取本会话教育记忆工具，核对老师原话中的固定口令，给一句建议并注明来源。'
const secondSource='这是合成教师记录。物态变化实验观察冰水共存，冰融化时记录温度平台。请只回复收到。'
const secondQuery='按物态变化实验中冰融化时温度平台的记录，查找观察要求。'
const report={lane,variant:extended?'rebuild':offline?'offline':'discovery',root,main,sha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),checks:[],paidRequests:0}
let app,page,mainPage,paused=false
const check=(name,details={})=>{report.checks.push({name,...details});console.log('PASS '+name)}
async function until(read,timeout=90000){
  const end=Date.now()+timeout
  while(Date.now()<end){
    const v=await read()
    if(v)return v
    await new Promise(resolve=>setTimeout(resolve,150))
  }
  throw Error('Real history UI step timed out')
}
function db(sql,params=[]){
  const handle=new DatabaseSync(path.join(data,'app.db'),{readOnly:true})
  try{return handle.prepare(sql).all(...params)}finally{handle.close()}
}
async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:'deepseek-flash',DEEPSEEK_API_KEY:key}
  for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k]
  if(lane==='A_prime')delete env.OMNI_EDU_HISTORY_LOOPBACK
  else assert(env.OMNI_EDU_HISTORY_LOOPBACK&&env.OMNI_EDU_HISTORY_TOKEN)
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000})
  await app.evaluate(({net},marker)=>{
    const actual=net.fetch.bind(net)
    globalThis.r1HistoryWire=[]
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url)
      if(url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')return actual(input,init)
      if(globalThis.r1HistoryWire.length>=8)throw Error('R1 paid request cap reached')
      const body=JSON.parse(init.body)
      const extract=x=>typeof x==='string'?x:Array.isArray(x)?x.map(i=>i.text??'').join(' '):''
      const row={status:0,model:body.model,effort:body.reasoning_effort,max_tokens:body.max_tokens,started_ms:Date.now(),
        sourceMessages:body.messages.filter(m=>extract(m.content).includes(marker)).map(m=>({role:m.role,content:extract(m.content)}))}
      globalThis.r1HistoryWire.push(row)
      const response=await actual(input,init)
      row.status=response.status
      void response.clone().text().then(stream=>{
        for(const line of stream.split('\n').filter(x=>x.startsWith('data: {'))){
          const item=JSON.parse(line.slice(6))
          if(item.usage)row.usage=item.usage
        }
        row.elapsed_ms=Date.now()-row.started_ms
      }).catch(()=>{})
      return response
    }
  },marker)
  page=await app.firstWindow()
  await page.getByTestId('office-prompt-input').waitFor()
  await assertIsolatedPiMain(app,main,profile)
}
const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id')
const now=()=>until(async()=>{const id=await session();return id?.startsWith('aisession_')?id:null})
const snapshot=id=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id)
const prompt=()=>page.getByTestId('office-prompt-input')
const wire=()=>app.evaluate(()=>globalThis.r1HistoryWire)
async function send(text){
  const id=await now()
  await until(async()=>!await prompt().isDisabled())
  const before=(await snapshot(id)).projection.turns.at(-1)?.id
  await prompt().fill(text)
  await page.getByRole('button',{name:'发送消息',exact:true}).click()
  return until(async()=>{
    const snap=await snapshot(id), turn=snap.projection.turns.at(-1)
    if(!snap.running&&turn?.id!==before&&['completed','failed','interrupted'].includes(turn?.status))return turn
  })
}
async function fresh(){
  const old=await now()
  await page.getByTestId('pi-new-session').click()
  return until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==old?id:null})
}
async function settings(){
  mainPage=page
  const opening=app.waitForEvent('window')
  await page.getByRole('button',{name:'设置',exact:true}).click()
  page=await opening
  await page.getByTestId('pi-settings-tab-teacher-memory').click()
  await page.getByTestId('history-settings-session').waitFor()
}
async function back(){
  await Promise.all([page.waitForEvent('close'),page.getByTestId('settings-window-close').click()])
  page=mainPage
  await prompt().waitFor()
}
async function close(){
  const logs=await wire()
  report.paidRequests+=logs.length
  report.provider=[...(report.provider??[]),...logs]
  await app.close()
  app=undefined
}
try{
  await launch()
  const old=await now()
  const sent=await send(source)
  assert.equal(sent.status,'completed',sent.error)
  const message=db("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?",[old,source])[0]
  assert(message?.id)
  check('teacher request in canonical SQLite',{session:old,messageId:message.id})
  let second
  if(extended){
    const turn=await send(secondSource)
    assert.equal(turn.status,'completed',turn.error)
    second=db("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?",[old,secondSource])[0]
    assert(second?.id)
  }
  const target=await fresh()
  assert.equal((await snapshot(target)).memoryScope.enabled,false)
  await settings()
  await page.getByTestId('history-settings-session').selectOption(old)
  let entry=page.getByTestId('history-settings-source-'+message.id)
  await entry.getByRole('button',{name:'查看来源'}).click()
  await entry.getByTestId('history-settings-preview').getByText(new RegExp(marker)).waitFor()
  await entry.getByTestId('history-settings-allow').click()
  await page.getByTestId('history-settings-notice').getByText(/已允许查找/).waitFor()
  const row=db('SELECT source_id,generation,index_allowed,memory_state FROM memory_source_access WHERE record_id=?',[message.id])[0]
  assert.equal(row.index_allowed,1)
  assert.equal(row.memory_state,'active')
  check('index permission via settings, no scope grant',{row})
  if(second){
    const secondary=page.getByTestId('history-settings-source-'+second.id)
    await secondary.getByRole('button',{name:'查看来源'}).click()
    await secondary.getByTestId('history-settings-allow').click()
    await until(async()=>db("SELECT COUNT(*) n FROM memory_index_catalog WHERE status='ready'")[0].n===2)
  }
  if(lane==='B'){
    const ready=await until(async()=>db("SELECT document_id,source_version,generation FROM memory_index_catalog WHERE status='ready'")[0],35000)
    check('real SDK worker readback',ready)
  }
  await back()
  const receiver=await now()
  assert.equal(receiver,target)
  assert.equal((await snapshot(target)).memoryScope.selections.length,0)
  await prompt().fill(confirmQuery)
  await page.getByTestId('history-lookup-open').click()
  assert.equal(await page.getByTestId('history-lookup-query').inputValue(),confirmQuery)
  if(second){
    await page.getByTestId('history-lookup-query').fill(secondQuery)
    await page.getByTestId('history-lookup-search').click()
    await page.getByTestId('history-candidate-'+second.id).waitFor()
    assert.equal(await page.getByTestId('history-lookup').getAttribute('data-mode'),'hindsight')
    check('distinct current query returned second authorized original',{query:secondQuery,expectedRecord:second.id})
    await page.getByTestId('history-lookup-query').fill(confirmQuery)
  }
  if(offline){
    execFileSync('docker',['pause',testContainer],{stdio:'ignore',timeout:10000})
    paused=true
  }
  const lookupStarted=performance.now()
  await page.getByTestId('history-lookup-search').click()
  const hit=page.getByTestId('history-candidate-'+message.id)
  await hit.click()
  assert.equal(await page.getByTestId('history-lookup').getAttribute('data-mode'),lane==='B'&&!offline?'hindsight':'local')
  if(offline){
    const lookupMs=Math.round(performance.now()-lookupStarted)
    assert(lookupMs<10000,'Offline search exceeded the product test deadline')
    check('authorized local discovery continued while isolated engine was paused',{lookupMs})
    execFileSync('docker',['unpause',testContainer],{stdio:'ignore',timeout:10000})
    paused=false
  }
  await page.getByTestId('history-lookup-preview').getByText(source,{exact:true}).waitFor()
  assert.equal((await snapshot(target)).memoryScope.selections.length,0)
  assert.equal(await prompt().inputValue(),confirmQuery)
  await page.screenshot({path:path.join(root,'source-preview.png')})
  await page.getByTestId('history-lookup-use-session').click()
  await page.getByTestId('history-use-selection').waitFor()
  const scoped=await snapshot(target)
  assert.equal(scoped.memoryScope.selections[0].id,row.source_id)
  check('unselected source discovered, previewed and confirmed by teacher',{scope:scoped.memoryScope})
  const before=(await wire()).length
  const response=await send(confirmQuery)
  assert.equal(response.status,'completed',response.error)
  const delivery=(await wire()).slice(before).flatMap(r=>r.sourceMessages)
  assert(delivery.some(m=>m.role==='tool'&&m.content.includes(marker)),'No authorized source in actual provider request')
  assert(response.items.filter(i=>i.role==='assistant').some(i=>i.text?.includes(marker)),'Answer did not use the source')
  check('current real model consumed verified source',{turnId:response.id,delivery})
  await settings()
  await page.getByTestId('history-settings-session').selectOption(old)
  entry=page.getByTestId('history-settings-source-'+message.id)
  await entry.getByRole('button',{name:'不再记住'}).click()
  await entry.getByTestId('history-settings-forget').click()
  await page.getByTestId('history-settings-notice').getByText(/已停止参考/).waitFor()
  if(second){
    await page.getByTestId('history-index-rebuild').click()
    const generation=await until(async()=>{
      const value=db('SELECT active_generation,rebuild_generation FROM memory_history_index_state')[0]
      return value.active_generation===2&&value.rebuild_generation===null?value:null
    },40000)
    assert.equal(db("SELECT COUNT(*) n FROM memory_index_catalog WHERE source_id=? AND status='ready'",[row.source_id])[0].n,0)
    check('verified shadow generation promoted after tombstone; forgotten source never re-indexed',{generation})
  }
  await close()
  await launch()
  const saved=db('SELECT source_id,generation,index_allowed,memory_state FROM memory_source_access WHERE record_id=?',[message.id])[0]
  assert.equal(saved.source_id,row.source_id)
  assert.equal(saved.index_allowed,0)
  assert.equal(saved.memory_state,'forgotten')
  assert(saved.generation>row.generation)
  check('cold restart retains source tombstone',{saved})
  const blank=await fresh()
  await prompt().fill(confirmQuery)
  await page.getByTestId('history-lookup-open').click()
  await page.getByTestId('history-lookup-search').click()
  if(second){
    await until(async()=>await page.getByTestId('history-lookup').getAttribute('data-mode')==='hindsight')
    assert.equal(await page.getByTestId('history-candidate-'+message.id).count(),0)
  }else await page.getByText('当前没有更多获准查找的来源。',{exact:false}).waitFor()
  assert.equal((await snapshot(blank)).memoryScope.selections.length,0)
  check('forgotten source cannot rediscover after restart')
  report.ok=true
}catch(error){
  report.ok=false;report.error=String(error.stack)
  process.exitCode=1
  if(page)await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>undefined)
}finally{
  if(paused){
    try{execFileSync('docker',['unpause',testContainer],{stdio:'ignore',timeout:10000})}
    catch(error){report.ok=false;report.cleanupError=String(error);process.exitCode=1}
  }
  if(app)await close().catch(()=>undefined)
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify({root,ok:report.ok,checks:report.checks.length,reason:report.error}))
}
