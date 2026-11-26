import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {rankHindsightTrialRows} from '../../src/main/xiaozhi-agent/memory-hindsight-trial.ts'

const gateway = 'http://127.0.0.1:18889/trial-rank'
const first = {text:'合成甲老师摘要一', revision:1}
const second = {text:'合成甲老师摘要二', revision:2}
const rows = [first,second]
const digest = item => createHash('sha256').update(item.text).digest('hex')
const allowed = rows.map(digest)
const realFetch = globalThis.fetch
const flags = ['OMNI_EDU_MEMORY_HINDSIGHT_TRIAL','OMNI_EDU_E2E_DIALOG_MODE','OMNI_EDU_DATA_ROOT']
const original = flags.map(key=>process.env[key])
const evidence = []
let requests = 0
let respond = () => Response.json([allowed[1]])
async function record(name, check) {
  const start = performance.now(), before = requests
  await check()
  evidence.push({name,elapsed_ms:Math.round(performance.now()-start),requests:requests-before,verdict:'PASS'})
}

try {
  globalThis.fetch = async (url, options) => {
    requests++
    assert.equal(url,gateway)
    const body = JSON.parse(options.body)
    assert.deepEqual(Object.keys(body).sort(),['authorizedHashes','mode'])
    assert.deepEqual(body.authorizedHashes,allowed)
    assert.equal(body.mode,'C')
    return respond(options)
  }
  process.env.OMNI_EDU_E2E_DIALOG_MODE='1'
  process.env.OMNI_EDU_DATA_ROOT='isolated-hindsight-unit'
  delete process.env.OMNI_EDU_MEMORY_HINDSIGHT_TRIAL
  await record('off-no-request',async()=>{assert.strictEqual(await rankHindsightTrialRows(rows),rows);assert.equal(requests,0)})
  process.env.OMNI_EDU_MEMORY_HINDSIGHT_TRIAL='C'
  await record('empty-no-request',async()=>{assert.deepEqual(await rankHindsightTrialRows([]),[]);assert.equal(requests,0)})
  await record('approved-hash-ranks-existing-rows',async()=>assert.deepEqual(await rankHindsightTrialRows(rows),[second,first]))
  respond = () => Response.json([allowed[1],'x'.repeat(64)])
  await record('foreign-hash-falls-back',async()=>assert.strictEqual(await rankHindsightTrialRows(rows),rows))
  respond = () => new Response('rate limited',{status:429})
  await record('injected-429-falls-back',async()=>assert.strictEqual(await rankHindsightTrialRows(rows),rows))
  respond = () => new Response('{', {headers:{'content-type':'application/json'}})
  await record('injected-parse-error-falls-back',async()=>assert.strictEqual(await rankHindsightTrialRows(rows),rows))
  respond = options => new Promise((resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true})
  })
  const keepAlive = setTimeout(()=>{},2200)
  try {
    await record('injected-deadline-falls-back',async()=>assert.strictEqual(await rankHindsightTrialRows(rows),rows))
  } finally {clearTimeout(keepAlive)}
  const owner = new AbortController()
  await record('owner-cancel-propagates',async()=>{
    const pending = rankHindsightTrialRows(rows,owner.signal)
    owner.abort()
    await assert.rejects(pending,{name:'AbortError'})
  })
} finally {
  globalThis.fetch = realFetch
  flags.forEach((key,index)=>{
    if(original[index]===undefined)delete process.env[key]
    else process.env[key]=original[index]
  })
  console.log(JSON.stringify(evidence,null,2))
}
