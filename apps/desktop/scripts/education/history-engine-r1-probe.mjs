import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {writeFileSync} from 'node:fs'
import path from 'node:path'
import {setTimeout as wait} from 'node:timers/promises'
import {HindsightClient,createClient,sdk} from '@vectorize-io/hindsight-client'

const endpoint=process.env.OMNI_EDU_HISTORY_LOOPBACK, key=process.env.OMNI_EDU_HISTORY_TOKEN
assert.match(endpoint,/^http:\/\/127\.0\.0\.1:[0-9]+$/)
assert(key)
const output=process.env.OMNI_EDU_ACCEPTANCE_ROOT
assert(output)
const client=new HindsightClient({baseUrl:endpoint,apiKey:key,maxAttempts:1})
const raw=createClient({baseUrl:endpoint,headers:{Authorization:'Bearer '+key}})
const bank='edu-r1-probe-'+randomUUID().slice(0,10), stock='r1-teacher-alpha', foreign='r1-teacher-beta'
const result={bank,checks:[],version:null,config:null}
const check=(name,value)=>result.checks.push({name,value})
try{
  result.version=await client.getVersion()
  assert.equal(result.version.api_version,'1.3.0')
  const schema=await (await fetch(endpoint+'/openapi.json')).json()
  assert.equal(schema.info.version,'1.3.0')
  writeFileSync(path.join(output,'r1-live-openapi.json'),JSON.stringify(schema))
  const unauthorized=await fetch(endpoint+'/v1/default/banks/'+bank+'/config')
  assert.equal(unauthorized.status,401)
  check('loopback-auth',unauthorized.status)
  await client.createBank(bank,{retainExtractionMode:'chunks',enableObservations:false,enableTemporalRetrieval:false})
  const reply=await client.getBankConfig(bank)
  result.config=Object.fromEntries(['retain_extraction_mode','enable_observations','enable_auto_consolidation','enable_reranking'].map(k=>[k,reply.config[k]]))
  assert.equal(result.config.retain_extraction_mode,'chunks')
  assert.equal(result.config.enable_observations,false)
  assert.equal(result.config.enable_auto_consolidation,false)
  const content='合成教师甲的长期要求：秋季学期二次函数采用配方法讲解，先板书再练习。'
  const id=randomUUID()
  const retained=await client.retainBatch(bank,[{document_id:stock,content,tags:[stock]},
    {document_id:foreign,content:'教师乙安排同名班级二次函数采用图象与交点。',tags:[foreign]}],{async:true,operationId:id})
  assert.equal(retained.operation_id,id)
  let end
  for(let i=0;i<35;i++){
    const state=await sdk.getOperationStatus({client:raw,path:{bank_id:bank,operation_id:id}})
    if(!state.data)throw Error('operation not readable')
    end=state.data.status
    if(!['pending','processing'].includes(end))break
    await wait(700)
  }
  assert.equal(end,'completed')
  check('retain-terminal',{id,end})
  const doc=await client.getDocument(bank,stock)
  assert.equal(doc.original_text,content)
  assert.deepEqual(doc.tags,[stock])
  check('document-readback',{id:doc.id,text:doc.original_text})
  const recall=await client.recall(bank,'二次函数如何用配方法解释？',{tagGroups:[{tags:[stock],match:'any_strict',resolve:'exact'}],types:['world','experience'],
    includeEntities:false,includeChunks:false,includeSourceFacts:false})
  assert(recall.results.length>0)
  assert(recall.results.every(row=>row.document_id===stock))
  check('strict-recall',recall.results.map(x=>x.document_id))
  await client.deleteDocument(bank,stock)
  assert.equal(await client.getDocument(bank,stock),null)
  assert(await client.getDocument(bank,foreign))
  check('delete-readback',{removed:stock,isolated:foreign})
} catch(error){
  result.error=String(error.stack)
  process.exitCode=1
} finally{
  writeFileSync(path.join(output,'r1-engine-sdk-probe.json'),JSON.stringify(result,null,2))
  console.log(JSON.stringify(result))
}
