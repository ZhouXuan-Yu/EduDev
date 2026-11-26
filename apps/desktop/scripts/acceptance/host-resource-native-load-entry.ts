import {app,BrowserWindow} from 'electron';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parsePdfFile} from '../../src/main/xiaozhi-agent/pdf-file-host';
import {VectorHost} from '../../src/main/retrieval/vector-host';
import {generateOfficeDocument} from '../../src/main/xiaozhi-agent/office-generator';
import {hostResourceDiagnostics,reserveHostStage} from '../../src/main/host-resources/desktop';
import {EMBEDDING_ID,EMBEDDING_MODEL,EMBEDDING_TOKENIZER,type GenerationSpec,type RetrievalFact} from '../../src/shared/retrieval';
import {OFFICE_DRAFT_SCHEMA,type OfficeDraft} from '../../src/shared/xiaozhi-office-draft';

const root=process.env.OMNI_EDU_R1_OUTPUT!,fixtures=process.env.OMNI_EDU_R1_FIXTURES!;
const dataRoot=path.join(root,'data');
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const owner=new VectorHost(()=>dataRoot);
const spec:GenerationSpec={id:'generation_00000000-0000-4000-8000-000000000001',identity:EMBEDDING_ID,
  modelHash:EMBEDDING_MODEL,tokenizerHash:EMBEDDING_TOKENIZER,dimension:512,pooling:'cls',normalization:'l2',
  distanceMetric:'cosine',factSnapshotSeq:0};
const report:Record<string,unknown>={success:false,checks:[]};
const checks=report.checks as string[];
const signal=new AbortController();
app.on('window-all-closed',()=>{});

async function parse(name:string){
  const localPath=path.join(fixtures,name),contentHash=sha(await fs.readFile(localPath));
  const pages:Record<number,string>={};
  await parsePdfFile({localPath,contentHash},[],signal.signal,async event=>{
    if(event.kind==='page')pages[event.page]=event.result.text;
  },{owner:'fixture-'+name,lane:'background',beforeStart:async()=>{
    assert.equal(sha(await fs.readFile(localPath)),contentHash);
  }});
  assert.equal(Object.keys(pages).length,6);
  assert(Object.values(pages).every(text=>text.trim().length>0));
  return {name,contentHash,pages};
}

async function index(corpus:{text:string;topic:string;id:string}[],queries:{query:string;known_relevant_ids:string[]}[]){
  const keyed=new Map<string,string>();
  const facts=corpus.map((item,i):RetrievalFact=>{
    const suffix=String(i+1).padStart(12,'0'),id='chunk_00000000-0000-4000-8000-'+suffix;
    keyed.set(id,item.id);
    return {id,seq:i+1,kind:'material',digest:sha(item.text),resourceId:'resource_00000000-0000-4000-8000-'+suffix,
      subject:'数学',grade:'初一',knowledgePoint:item.topic,questionType:'',difficulty:'medium',
      sourceKind:'teacher_resource',text:item.text,deleted:false};
  });
  await owner.ensure(spec);
  for(let i=0;i<facts.length;i+=16)await owner.applyMany(spec,facts.slice(i,i+16));
  const counts=await owner.counts(spec);
  assert.equal(counts.objects,48);
  const hits=[];
  for(const query of queries){
    const result=await owner.query(spec,{generation:spec.id,kind:'material',query:query.query,limit:10});
    const matched=result.hits.map(hit=>keyed.get(hit.id));
    assert(query.known_relevant_ids.every(id=>matched.includes(id)),'Expected corpus sources '+query.known_relevant_ids.join(','));
    hits.push(matched);
  }
  return {counts,hits};
}

function draftFromHtml(html:string):OfficeDraft{
  const decode=(value:string)=>value.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
  const title=decode(html.match(/<h1>([^<]+)<\/h1>/u)![1]);
  const sections=[...html.matchAll(/<section><h2>([^<]+)<\/h2><p>([^<]+)<\/p><\/section>/gu)]
    .map(item=>({heading:decode(item[1]),paragraphs:[decode(item[2])]}));
  sections[0].paragraphs.unshift('ARTIFACT-EXPORT-001 / version 1 / SYNTHETIC');
  sections.at(-1)!.paragraphs.push(decode(html.match(/<footer>([^<]+)<\/footer>/u)![1]));
  assert.equal(sections.length,4);
  return {schemaVersion:OFFICE_DRAFT_SCHEMA,title,sections};
}

async function output(draft:OfficeDraft){
  const pdf=await generateOfficeDocument('pdf',draft,{dataRoot,signal:signal.signal});
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  assert(pdf.includes(Buffer.from('%%EOF')));
  await fs.writeFile(path.join(root,'handout.pdf'),pdf,{flag:'wx'});
  return {sha256:sha(pdf),bytes:pdf.length};
}

async function outputDuringBackgroundWork(draft:OfficeDraft){
  const deadline=performance.now()+30000;
  for(;;){
    const events=hostResourceDiagnostics().events;
    const active=(owner:string,phase:string)=>events.find(event=>event.owner===owner&&event.phase===phase&&event.state==='started'&&
      !events.some(end=>end.lease===event.lease&&end.state==='actual_settled'));
    const ocr=active('fixture-material-scanned.pdf','parse'),index=active('vector-owner','applyMany');
    if(ocr&&index){
      const bytes=await output(draft);
      const after=hostResourceDiagnostics().events;
      const print=after.find(event=>event.owner==='office-export'&&event.phase==='pdf'&&event.state==='started');
      assert(print&&print.at>=ocr.at&&print.at>=index.at,'PDF must start while both jobs are active');
      for(const background of [ocr,index]){
        const settled=after.find(event=>event.lease===background.lease&&event.state==='actual_settled');
        assert(!settled||settled.at>print.at,'Background job ended before the PDF started');
      }
      report.overlap={ocr,index,print};
      return bytes;
    }
    if(performance.now()>=deadline)throw Error('No joint OCR and embedding/index execution was observed');
    await new Promise(resolve=>setTimeout(resolve,20));
  }
}

async function waitForValidHostSamples(){
  const probe=await reserveHostStage('fixture-sample-probe','sample','foreground',{cpu:1},5000);
  assert(probe.start());probe.settle();
  // Cold launch deliberately starts with the smallest capacity. Observe real
  // recovery before exercising concurrent admission at ordinary capacity.
  const deadline=performance.now()+30000;
  while(hostResourceDiagnostics().pressure!==0){
    if(performance.now()>=deadline)throw Error('The host did not reach ordinary capacity for the overlap case');
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  report.ordinaryCapacity=hostResourceDiagnostics().target;
}

async function cancelDuringPrint(draft:OfficeDraft){
  const cancellation=new AbortController();
  let unblock!:()=>void,markStarted!:()=>void;
  const barrier=new Promise<void>(resolve=>{unblock=resolve;});
  const started=new Promise<void>(resolve=>{markStarted=resolve;});
  app.once('web-contents-created',(_event,contents)=>{
    const print=contents.printToPDF.bind(contents);
    contents.printToPDF=async settings=>{
      const actual=print(settings);
      markStarted();
      const [bytes]=await Promise.all([actual,barrier]);
      return bytes;
    };
  });
  const first=generateOfficeDocument('pdf',draft,{dataRoot,signal:cancellation.signal});
  const early=first.then(()=>{throw Error('print unexpectedly completed before barrier');},error=>{throw error;});
  let next:Promise<Buffer>|undefined;
  try{
    await Promise.race([started,early]);
    cancellation.abort();
    next=generateOfficeDocument('pdf',draft,{dataRoot,signal:signal.signal});
    await new Promise<void>(resolve=>setImmediate(resolve));
    const snapshot=hostResourceDiagnostics();
    assert.equal(snapshot.used.pdfWindows,1);
    assert.equal(snapshot.queued,1);
  }finally{
    unblock();
    if(!next)await first.catch(()=>undefined);
  }
  await assert.rejects(first,/cancelled/u);
  assert((await next!).subarray(0,5).toString()==='%PDF-');
  return hostResourceDiagnostics().events.filter(event=>event.owner==='office-export');
}

void app.whenReady().then(async()=>{
  await fs.mkdir(dataRoot);
  try{
    const [source,corpus,queries]=await Promise.all(['export-source.html','teaching-corpus.jsonl','queries.json']
      .map(file=>fs.readFile(path.join(fixtures,file),'utf8')));
    const draft=draftFromHtml(source);
    await waitForValidHostSamples();
    const scanned=parse('material-scanned.pdf');
    const indexing=index(corpus.trim().split(/\r?\n/u).map(line=>JSON.parse(line)),JSON.parse(queries).queries);
    const printing=outputDuringBackgroundWork(draft);
    const results=await Promise.allSettled([printing.then(()=>parse('material-original.pdf')),scanned,indexing,printing]);
    report.results=results.map(result=>result.status==='fulfilled'?result.value:String(result.reason?.stack??result.reason));
    assert(results.every(result=>result.status==='fulfilled'),JSON.stringify(report.results));
    checks.push('Native file worker returned six nonempty pages for each package PDF');
    checks.push('Native embedding and Lance indexed 48 declared sources and returned the expected source for each query');
    checks.push('Electron generated the four-section PDF while native OCR and indexing leases were both running');
    report.cancelledPrint=await cancelDuringPrint(draft);
    checks.push('An aborted Chromium print retains its lease until actual receipt and permits the next print');
    assert.equal(BrowserWindow.getAllWindows().length,0);
    assert(!(await fs.readdir(dataRoot)).some(name=>name.startsWith('office-render-')));
    checks.push('The private print window and its owned staging files are gone');
    const residency=()=>hostResourceDiagnostics().events.filter(event=>event.phase==='embedding-resident');
    const started=residency().filter(event=>event.state==='started');
    assert(started.length>0&&started.every(event=>event.demand.processes===1&&event.demand.memoryMiB===640));
    assert(started.some(event=>!residency().some(exit=>exit.lease===event.lease&&exit.state==='actual_settled')));
    await owner.close();
    const drainedBy=performance.now()+10_000;
    while(started.some(event=>!residency().some(exit=>exit.lease===event.lease&&exit.state==='actual_settled'))){
      if(performance.now()>=drainedBy)throw Error('Native embedding residency did not settle after owner shutdown');
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    checks.push('Native embedding has independent residency after query results and settles at actual process close');
    report.success=true;
  }catch(error){
    report.error=String((error as Error).stack??error);
  }finally{
    signal.abort();
    await owner.close();
    report.resources=hostResourceDiagnostics();
    await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
    app.exit(report.success?0:1);
  }
});
