import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {_electron as electron} from 'playwright'
import {testMain, assertIsolatedPiMain} from '../acceptance/build-root.mjs'

const acceptance = process.env.OMNI_EDU_ACCEPTANCE_ROOT
assert(acceptance && process.env.DEEPSEEK_API_KEY)
const folder = fs.mkdtempSync(path.join(acceptance,'host-authorized-trial-'))
const fixture = JSON.parse(fs.readFileSync(path.join(acceptance,'../fixtures/history.json'),'utf8'))
const original = fixture.sources.find(item=>item.id==='a-26-01')
const desktop = path.resolve(import.meta.dirname,'../..')
const main = testMain(desktop)
const log = (kind,value) => fs.appendFileSync(path.join(folder,'result.ndjson'),JSON.stringify({kind,...value})+'\n')
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
log('start',{main,sha256:digest(main),data:folder})
let app, page, dispatches = 0

async function until(get,timeout=60000) {
  const end=Date.now()+timeout
  while(Date.now()<end) {
    const value=await get()
    if(value)return value
    await new Promise(resolve=>setTimeout(resolve,120))
  }
  throw Error('Teacher memory trial timed out')
}

async function open(mode,data,limit) {
  const profile=path.join(folder,mode,'profile')
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:'deepseek-flash'}
  if(['B','C'].includes(mode))env.OMNI_EDU_MEMORY_HINDSIGHT_TRIAL=mode
  else delete env.OMNI_EDU_MEMORY_HINDSIGHT_TRIAL
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key]
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000})
  await app.evaluate(({net},{limit,source})=>{
    const real=net.fetch.bind(net)
    globalThis.memoryTrialWire=[]
    net.fetch=async (input, init)=>{
      const url=new URL(typeof input==='string'?input:input.url)
      if(url.origin!=='https://api.deepseek.com')throw Error('Trial disallows this external origin')
      if(url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{
        id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],
        effort:{supported_levels:['low','high','max'],default_level:'high'},
      }]}),{headers:{'content-type':'application/json'}})
      if(url.pathname!=='/v1/chat/completions'||globalThis.memoryTrialWire.length>=limit)throw Error('Trial request bound')
      const body=JSON.parse(init.body)
      const text=x=>typeof x==='string'?x:Array.isArray(x)?x.map(y=>y.text??'').join(' '):''
      const row={started_at:new Date().toISOString(),model:body.model,
        max_tokens:body.max_tokens,effort:body.reasoning_effort,temperature:body.temperature,
        evidence:body.messages.filter(message=>text(message.content).includes(source)).map(message=>({role:message.role,content:text(message.content)}))}
      globalThis.memoryTrialWire.push(row)
      const start=Date.now()
      const response=await real(input,init)
      row.status=response.status
      row.response_ms=Date.now()-start
      void response.clone().text().then(stream=>{
        for(const line of stream.split('\n').filter(x=>x.startsWith('data: {'))){
          const item=JSON.parse(line.slice(6))
          if(item.usage)row.usage=item.usage
        }
        row.complete_ms=Date.now()-start
      }).catch(()=>{})
      return response
    }
  },{limit,source:original.content})
  page=await app.firstWindow()
  await page.getByTestId('office-prompt-input').waitFor({timeout:60000})
  await assertIsolatedPiMain(app,main,profile)
}

const id=()=>page.locator('.office-composer-container').getAttribute('data-session-id')
const snapshot=async session=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session??await id())
const input=()=>page.getByTestId('office-prompt-input')

async function send(question) {
  await until(async()=>Boolean(await id())&&!await input().isDisabled())
  const session=await id(),previous=(await snapshot(session)).projection.turns.at(-1)?.id
  await input().fill(question)
  await page.getByRole('button',{name:'发送消息',exact:true}).click()
  return until(async()=>{
    const current=await snapshot(session), latest=current.projection.turns.at(-1)
    return latest?.id!==previous&&!current.running&&['completed','failed','interrupted'].includes(latest?.status)?latest:null
  },110000)
}

async function close(mode) {
  const wire=await app.evaluate(()=>globalThis.memoryTrialWire)
  dispatches+=wire.length
  log('provider',{mode,wire})
  await app.close()
  app=null
}

async function seed(data) {
  await page.getByTestId('ai-return-workspace').click()
  await page.getByTestId('nav-memory').click()
  await page.getByTestId('memory-governance-workspace').waitFor({state:'visible'})
  await page.getByTestId('memory-draft-l2').click()
  await page.getByTestId('memory-adopt-l2-0').click({timeout:15000})
  const entry=await until(async()=> (await page.evaluate(()=>window.omniEdu.getAiMemoryDocument('chat')))?.entries[0])
  await page.getByTestId('memory-l2-text-'+entry.id).fill(original.content)
  await page.getByTestId('memory-save-l2-'+entry.id).click()
  const edited=await until(async()=>{
    const now=(await page.evaluate(()=>window.omniEdu.getAiMemoryDocument('chat')))?.entries.find(x=>x.id===entry.id)
    return now?.version>entry.version&&now.text===original.content?now:null
  })
  log('adopted',{data,entry:edited})
  return {id:edited.id,version:edited.version}
}

const reportArms=[]
for (const name of ['seed','A','B','C'])fs.mkdirSync(path.join(folder,name),{recursive:true})
try {
  const seedData=path.join(folder,'seed','data')
  const accepted=process.env.OMNI_EDU_HANDOUT_FIXTURE
  assert(accepted,'Pass the completed isolated live handout fixture')
  const handout=JSON.parse(fs.readFileSync(path.join(accepted,'report.json'),'utf8'))
  assert(handout.ok&&handout.paidRequests>0)
  const oldData=path.join(accepted,'data'),wal=path.join(oldData,'app.db-wal')
  assert(!fs.existsSync(wal)||!fs.statSync(wal).size)
  fs.cpSync(oldData,seedData,{recursive:true,filter:file=>!/app\.db-(wal|shm)$/u.test(file)})
  log('seed-fixture',{accepted,handoutSessionId:handout.sessionId})
  await open('seed',seedData,0)
  const entry=await seed(seedData)
  await close('seed')
  for(const mode of ['A','B','C']){
    const data=path.join(folder,mode,'data')
    fs.cpSync(seedData,data,{recursive:true})
    try {
      await open(mode,data,4)
      const previous=await until(async()=>{const current=await id();return current?.startsWith('aisession_')?current:null})
      await page.getByTestId('ai-conversation-new').click()
      const session=await until(async()=>{const current=await id();return current?.startsWith('aisession_')&&current!==previous?current:null})
      const before=(await snapshot(session)).memoryScope
      assert.equal(before.enabled,false)
      await until(async()=>await page.getByTestId('pi-memory-preview').count()===1)
      const preview=page.getByTestId('pi-memory-preview')
      if(!await preview.isVisible())await page.getByTestId('pi-memory-scope').locator('[data-slot="chat-tool-trigger"]').click()
      await preview.click()
      await page.getByTestId('pi-memory-select-'+entry.id).check()
      await page.getByTestId('pi-memory-enabled').check()
      await page.getByTestId('pi-memory-save').click()
      const after=await until(async()=>{
        const value=(await snapshot(session)).memoryScope
        return value.enabled&&value.selections?.some(s=>s.id===entry.id&&s.version===entry.version&&s.state==='ready')?value:null
      })
      const question='请先用读取教育记忆的工具核对这位老师以前确认的讲义顺序和学生版、教师版答案安排，再给出核对结果并附来源。不要创建文件。'
      const result=await send(question)
      const wire=await app.evaluate(()=>globalThis.memoryTrialWire)
      log('arm',{mode,session,before,after,question,turn:result,actualModelInput:wire.flatMap(x=>x.evidence)})
      await page.screenshot({path:path.join(folder,mode+'.png')})
      assert.equal(result.status,'completed')
      assert(wire.some(row=>row.evidence.some(item=>item.role==='tool')),'No real model dispatch saw the authorized source')
      reportArms.push(mode)
    } catch(error) {
      log('failure',{mode,error:String(error.stack)})
      if (page) await page.screenshot({path:path.join(folder,mode+'-failure.png')}).catch(()=>{})
    } finally {
      if(app)await close(mode)
    }
  }
} catch(error) {
  log('failure',{mode:'seed',error:String(error.stack)})
  if(page)await page.screenshot({path:path.join(folder,'seed-failure.png')}).catch(()=>{})
} finally{
  if(app)await close('seed')
  log('terminal',{reportArms,dispatches})
  console.log(JSON.stringify({folder,reportArms,dispatches}))
  process.exitCode=reportArms.length===3?0:1
}
