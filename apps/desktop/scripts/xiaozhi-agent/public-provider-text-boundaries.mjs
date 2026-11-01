import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';

const server = await createServer({configFile:false, appType:'custom', optimizeDeps:{noDiscovery:true}, server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const tags=['</｜｜DSML｜｜ parameter>','</｜｜DSML｜｜ invoke>','</｜｜DSML｜｜ calls>'];
const suffix=tags.join('\n');
const hash=value=>createHash('sha256').update(value).digest('hex');
let directory;
try {
  const {createPublicProviderTextFilter,publicProviderText,publicProviderTurn}=await server.ssrLoadModule('/src/shared/public-provider-text.ts');
  const {createPresentationEventAdapter,visibleAssistantText}=await server.ssrLoadModule('/src/main/xiaozhi-agent/presentation-event-adapter.ts');
  const {applyXiaozhiEvent}=await server.ssrLoadModule('/src/shared/xiaozhi-projection.ts');
  const parse=chunks=>{const events=[];const adapter=createPresentationEventAdapter(event=>events.push(event));adapter.start(1);chunks.forEach(chunk=>adapter.delta(chunk));adapter.end();return events;};
  const body=events=>events.filter(event=>event.kind==='text_delta').map(event=>event.delta).join('');
  const splitCheck=(raw,expected)=>{
    for(let split=0;split<=raw.length;split++) assert.equal(body(parse([raw.slice(0,split),raw.slice(split)])),expected,'split '+split);
    assert.equal(body(parse([...raw])),expected,'single character chunks');
    assert.equal(visibleAssistantText(raw),expected);
  };
  check('each exact end tag and full chain: all splits, character streaming, final result',()=>{
    for(const tail of [...tags,suffix])splitCheck('<xiaozhi_answer>正文。'+tail,'正文。');
  });
  check('public frames never flash complete or split provider control prefixes',()=>{
    const events=[];const adapter=createPresentationEventAdapter(event=>events.push(event));adapter.start(1);
    const raw='<xiaozhi_answer>正文。'+suffix;
    for(const char of raw){adapter.delta(char);assert.equal(body(events),'正文。'.slice(0,body(events).length));}
    adapter.end();assert.equal(body(events),'正文。');
  });
  check('split DSML suffix outside native answer closing marker',()=>splitCheck('<xiaozhi_answer>正文。</xiaozhi_answer>\n'+suffix,'正文。'));
  check('ordinary text streams before message end',()=>{
    let text='';const filter=createPublicProviderTextFilter(value=>text+=value);filter.delta('正常正文');assert.equal(text,'正常正文');filter.delta('</｜｜D');assert.equal(text,'正常正文');filter.delta('ifferent>');assert.equal(text,'正常正文</｜｜Different>');
  });
  const literals=[
    '数学：x < y，a > b，\\(a<b\\)，<div>教学内容</div>',
    '行内示例：`'+tags[0]+'`',
    '多反引号示例：``a ` '+suffix+'``',
    '```xml\n'+suffix+'\n```',
    '~~~text\n'+suffix+'\n~~~',
    '缩进代码示例：\n    '+tags[0],
    '\\'+tags[0],
    '标记示例：“'+tags[0]+'”',
    '标记示例："'+tags[0]+'"',
    '说明 '+tags[0]+' 后面仍有正文。',
    '无闭合代码示例：`'+tags[0],
    '```xml\n'+suffix,
    '<｜｜DSML｜｜ calls>参数不会被解析或执行',
    '</｜｜DSML｜｜ unknown>',
    '</DSML calls>',
  ];
  for(const [index,text] of literals.entries())check('literal/math/non-allowlisted content preserved '+index,()=>splitCheck('<xiaozhi_answer>'+text,text));
  check('literal code before real suffix does not suppress the actual suffix',()=>splitCheck('<xiaozhi_answer>示例：`'+tags[0]+'`。'+suffix,'示例：`'+tags[0]+'`。'));
  check('nonprotocol tail whitespace and unrelated incomplete prefixes remain exact',()=>{
    for(const text of ['正文\n\n','x <','x </','x </other','x <｜｜DSML'])assert.equal(publicProviderText(text),text);
  });
  check('finalization drops only an unambiguous truncated allowlisted namespace',()=>{
    for(const tail of ['</｜｜DSML｜｜ ','</｜｜DSML｜｜ par','</｜｜DSML｜｜ invo','</｜｜DSML｜｜ call']){
      assert.equal(publicProviderText('正文'+tail),'正文');
      assert.equal(body(parse(['<xiaozhi_answer>正文',tail])),'正文');
    }
  });
  check('segment reset cannot carry suffix state into a later reply',()=>{
    const events=[];const adapter=createPresentationEventAdapter(e=>events.push(e));adapter.start(1);adapter.delta('<xiaozhi_progress>公开步骤'+suffix);adapter.end();adapter.start(2);adapter.delta('<xiaozhi_answer>正文');adapter.end();assert.equal(body(events),'公开步骤正文');assert.deepEqual(events.filter(e=>e.kind==='assistant_phase').map(e=>e.phase),['commentary','final_answer']);
  });
  check('final phase remains before the first body token with DSML filtering',()=>{
    const events=parse(['<xiaozhi_ans','wer>正文',suffix]);assert.equal(events[0].kind,'assistant_phase');assert.equal(events[0].phase,'final_answer');assert.equal(events[1].delta,'正文');
  });
  check('cold public journal replay matches stream, preserving original persisted bytes',()=>{
    directory=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-dsml-cold-'));
    const file=path.join(directory,'synthetic-events.jsonl');
    const events=[{kind:'assistant_start',segment:1},{kind:'assistant_phase',segment:1,phase:'final_answer',since:1},{kind:'text_delta',delta:'正文。'+suffix},{kind:'assistant_end',segment:1,final:true,since:2},{kind:'status',status:'completed',finishedAt:2}].map((e,i)=>({...e,sessionId:'synthetic',runId:'r',sequence:i+1}));
    fs.writeFileSync(file,events.map(e=>JSON.stringify(e)).join('\n'));const before=fs.readFileSync(file);let turn={id:'r',status:'running',items:[]};
    for(const row of fs.readFileSync(file,'utf8').split('\n'))turn=applyXiaozhiEvent(turn,JSON.parse(row));
    const raw=JSON.stringify(turn);const snapshot=publicProviderTurn(turn);
    assert.equal(snapshot.items.find(i=>i.role==='assistant').text,body(parse(['<xiaozhi_answer>正文。',suffix])));
    assert.equal(JSON.stringify(turn),raw);assert.equal(hash(fs.readFileSync(file)),hash(before));assert(raw.includes(tags[0]));
    assert.deepEqual(publicProviderTurn(JSON.parse(JSON.stringify(snapshot))),snapshot,'repeated cold hydration is idempotent');
  });
  check('snapshot filtering touches only public assistant prose',()=>{
    const input={id:'r',status:'completed',items:[{id:'u',kind:'message',role:'user',text:suffix},{id:'t',kind:'tool',text:suffix},{id:'a',kind:'message',role:'assistant',text:'正文。'+suffix}],modelReasoning:[{text:'synthetic-private-sentinel'}]};
    const saved=JSON.stringify(input);const view=publicProviderTurn(input);assert.equal(view.items[0].text,suffix);assert.equal(view.items[1].text,suffix);assert.equal(view.items[2].text,'正文。');assert.deepEqual(view.modelReasoning,input.modelReasoning);assert.equal(JSON.stringify(input),saved);
  });
  check('P2: indented code remains literal after ordinary text on the same code line, all splits and cold view',()=>{
    const text='正文\n\n    const example = '+tags[0];
    splitCheck('<xiaozhi_answer>'+text,text);
    const turn={id:'r',status:'completed',items:[{id:'a',kind:'message',role:'assistant',phase:'final_answer',phaseSource:'explicit',text}]};
    assert.equal(publicProviderTurn(turn),turn);
  });
  check('P2: fence with trailing non-whitespace cannot close a code block, all splits and cold view',()=>{
    for(const fence of ['\x60\x60\x60','~~~']){
      const text=fence+'text\nexample\n'+fence+'not-a-close\n'+suffix;
      splitCheck('<xiaozhi_answer>'+text,text);
      const turn={id:'r',status:'completed',items:[{id:'a',kind:'message',role:'assistant',phase:'final_answer',phaseSource:'explicit',text}]};
      assert.equal(publicProviderTurn(turn),turn);
    }
  });
  check('P2: DSML on either side of explicit answer close is identical in stream/final/cold view',()=>{
    for(const tail of [...tags,suffix])for(const text of ['正文。'+tail+'</xiaozhi_answer>','正文。</xiaozhi_answer>'+tail]){
      splitCheck('<xiaozhi_answer>'+text,'正文。');
      const turn={id:'r',status:'completed',items:[{id:'a',kind:'message',role:'assistant',phase:'final_answer',phaseSource:'explicit',text}]};
      assert.equal(publicProviderTurn(turn).items[0].text,'正文。');
    }
  });
  check('namespace fast path preserves ordinary prose and shorter incomplete prefixes',()=>{
    for(const text of ['普通正文。'.repeat(50000),'x < y','</｜｜DSML','</｜｜DSML｜｜'])assert.equal(publicProviderText(text),text);
  });
  check('unchanged snapshot retains turn/items identity; changed view copies only the changed item',()=>{
    const literal={id:'r',status:'completed',items:[{id:'a',kind:'message',role:'assistant',text:'示例：\x60'+tags[0]+'\x60'}]};
    const view=publicProviderTurn(literal);assert.equal(view,literal);assert.equal(view.items,literal.items);
    const plain={id:'r',status:'completed',items:[{id:'u',kind:'message',role:'user',text:'合成输入'},{id:'a',kind:'message',role:'assistant',text:'正文'+suffix}]};
    const changed=publicProviderTurn(plain);assert.notEqual(changed,plain);assert.notEqual(changed.items,plain.items);assert.equal(changed.items[0],plain.items[0]);assert.notEqual(changed.items[1],plain.items[1]);assert.equal(changed.items[1].text,'正文');
  });
  check('production snapshot integration occurs after history hydration',()=>{
    const source=fs.readFileSync('src/main/xiaozhi-agent/production-host.ts','utf8');const start=source.indexOf('  async function snapshot(');const view=source.indexOf('projection.turns = projection.turns.map(publicProviderTurn);',start);const returned=source.indexOf('return { enabled, fileWritesEnabled:fileWritesEnabled(), projection, eventCursors:',start);assert(view>start&&returned>view);
  });
  console.log(JSON.stringify({success:true,checks,modelCalls:0,electron:false,coldProof:'synthetic disk journal replay; actual UI pending parent build'}));
} finally {
  await server.close();
  if(directory)for(const name of fs.readdirSync(directory))fs.unlinkSync(path.join(directory,name));
  if(directory)fs.rmdirSync(directory);
}
