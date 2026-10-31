import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
const server = await createServer({
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});
let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed++;
  console.log('PASS ' + name);
};
try {
  const { createPresentationEventAdapter, visibleAssistantText } = await server.ssrLoadModule(
    '/src/main/xiaozhi-agent/presentation-event-adapter.ts',
  );
  const { applyXiaozhiEvent } = await server.ssrLoadModule('/src/shared/xiaozhi-projection.ts');
  const { splitAgentTrace } = await server.ssrLoadModule(
    '/src/renderer/components/office/agent-trace.ts',
  );
  const { agentTraceTimeline } = await server.ssrLoadModule(
    '/src/renderer/components/office/agent-trace-timeline.ts',
  );
  const { OfficeAgentTurn } = await server.ssrLoadModule(
    '/src/renderer/components/office/OfficeAgentTurn.tsx',
  );
  const { createChatStreamBuffer } = await server.ssrLoadModule(
    '/src/renderer/components/office/chat-stream-buffer.ts',
  );
  const { applyChatSnapshotEvent } = await server.ssrLoadModule(
    '/src/renderer/components/office/chat-snapshot-reducer.ts',
  );
  const parse = (chunks) => {
    const out = [],
      adapter = createPresentationEventAdapter((event) => out.push(event));
    adapter.start(1);
    chunks.forEach((chunk) => adapter.delta(chunk));
    adapter.end();
    return out;
  };
  await check('optional provider closing markers never leak across any chunk boundary', () => {
    const raw = '<xiaozhi_answer>正文。</xiaozhi_answer>\n';
    for (let i = 0; i <= raw.length; i++) {
      const out = parse([raw.slice(0, i), raw.slice(i)]);
      assert.equal(
        out
          .filter((e) => e.kind === 'text_delta')
          .map((e) => e.delta)
          .join(''),
        '正文。',
      );
    }
    assert.equal(visibleAssistantText(raw), '正文。');
    const code = '<xiaozhi_answer>代码：`</xiaozhi_answer>`。';
    assert.equal(
      parse([code])
        .filter((e) => e.kind === 'text_delta')
        .map((e) => e.delta)
        .join(''),
      '代码：`</xiaozhi_answer>`。',
    );
  });
  await check('every split of the answer marker hands off before the first body token', () => {
    const raw = '<xiaozhi_answer>你好🙂，这是正文。';
    for (let i = 0; i <= raw.length; i++) {
      const out = parse([raw.slice(0, i), raw.slice(i)]);
      assert.equal(out[0].kind, 'assistant_phase');
      assert.equal(out[0].phase, 'final_answer');
      assert.equal(
        out
          .filter((e) => e.kind === 'text_delta')
          .map((e) => e.delta)
          .join(''),
        '你好🙂，这是正文。',
      );
    }
  });
  await check('explicit progress remains progress, while ordinary words never imply final', () => {
    assert.equal(parse(['<xiaozhi_progress>先读资料'])[0].phase, 'commentary');
    const out = parse(['最终答案：我先查一下']);
    assert(!out.some((e) => e.kind === 'assistant_phase'));
    assert.equal(out[0].delta, '最终答案：我先查一下');
  });
  await check('a marker inside user-facing code is literal, not a new phase', () => {
    const raw = '<xiaozhi_answer>代码：`<xiaozhi_progress>`';
    const out = parse([raw]);
    assert.equal(out.filter((e) => e.kind === 'assistant_phase').length, 1);
    assert.equal(out.at(-1).delta, '代码：`<xiaozhi_progress>`');
  });
  await check('cancelled incomplete control prefixes cannot leak into UI', () =>
    assert.deepEqual(parse(['<xiaozhi_ans']), []),
  );
  await check('export strips the same leading marker and preserves all Markdown', () =>
    assert.equal(visibleAssistantText(' \n<xiaozhi_answer>## 标题\n\n正文🙂'), '## 标题\n\n正文🙂'),
  );
  await check(
    'protocol separators split across chunks never add a blank line to the answer/export',
    () => {
      const out = parse(['<xiaozhi_answer>', '\n', '  ', '正文\n']);
      assert.equal(
        out
          .filter((e) => e.kind === 'text_delta')
          .map((e) => e.delta)
          .join(''),
        '正文\n',
      );
      assert.equal(visibleAssistantText('<xiaozhi_answer>\n  正文\n'), '正文');
    },
  );
  let sequence = 0,
    turn = { id: 'r', status: 'running', startedAt: 1000, items: [] };
  const event = (e) => {
    const value = { sessionId: 's', runId: 'r', sequence: ++sequence, ...e };
    turn = applyXiaozhiEvent(turn, value);
    return value;
  };
  const reasoning = (n, order) => ({
    id: `reasoning:${n}:0`,
    text: `模型返回的第${n}段`,
    source: 'provider',
    startedAt: 1000,
    durationMs: 100,
    status: 'completed',
    traceOrder: order,
  });
  event({ kind: 'assistant_start', segment: 1 });
  event({ kind: 'assistant_phase', segment: 1, phase: 'commentary', since: 1100 });
  event({ kind: 'text_delta', delta: '先实读附件。', traceOrder: 20, capturedAt: 1500 });
  await check('public prelude never appears as answer before tools', () =>
    assert.equal(splitAgentTrace(turn).body.length, 0),
  );
  event({ kind: 'tool_start', callId: 't1', tool: 'office_list_attachments', traceOrder: 30 });
  event({ kind: 'tool_end', callId: 't1', tool: 'office_list_attachments', success: true });
  // Delayed sanitizer publication must not reorder the captured SDK event.
  event({ kind: 'model_reasoning', block: reasoning(1, 10) });
  event({ kind: 'assistant_end', segment: 1, final: false });
  event({ kind: 'assistant_start', segment: 2 });
  event({ kind: 'model_reasoning', block: reasoning(2, 40) });
  event({ kind: 'tool_start', callId: 't2', tool: 'office_read_attachment', traceOrder: 50 });
  event({ kind: 'tool_end', callId: 't2', tool: 'office_read_attachment', success: true });
  await check(
    'public actions retain capture order and private reasoning is excluded',
    () =>
      assert.deepEqual(
        agentTraceTimeline(turn).map((e) => e.id),
        ['r:segment:1', 't1', 't2'],
      ),
  );
  event({ kind: 'assistant_start', segment: 3 });
  event({ kind: 'assistant_phase', segment: 3, phase: 'final_answer', since: 5000 });
  event({ kind: 'text_delta', delta: '最终正文', traceOrder: 60 });
  const render = () =>
    new JSDOM(renderToStaticMarkup(React.createElement(OfficeAgentTurn, { turn, sessionId: 's' })))
      .window.document;
  await check('one aggregate is folded during final streaming while host is still running', () => {
    const doc = render();
    assert.equal(turn.status, 'running');
    assert.equal(doc.querySelectorAll('[data-testid="agent-trace-toggle"]').length, 1);
    assert.equal(
      doc.querySelector('[data-testid="agent-trace-toggle"]').getAttribute('aria-expanded'),
      'false',
    );
    assert.equal(doc.querySelector('[data-testid="agent-reply-body"]').textContent, '最终正文');
    assert.equal(doc.querySelectorAll('[data-testid="office-turn-duration"]').length, 0);
    assert.equal(turn.presentation.processElapsedMs, 3500);
  });
  await check(
    'handoff preserves the answer identity through incremental deltas and host completion',
    () => {
      const id = splitAgentTrace(turn).body[0].id;
      event({ kind: 'text_delta', delta: '继续输出', traceOrder: 61 });
      event({ kind: 'assistant_end', segment: 3, final: true, since: 10000 });
      event({ kind: 'status', status: 'completed', finishedAt: 12000 });
      assert.equal(splitAgentTrace(turn).body[0].id, id);
      assert.equal(turn.presentation.processElapsedMs, 3500);
      assert.equal(splitAgentTrace(turn).body[0].text, '最终正文继续输出');
    },
  );
  await check(
    'failure keeps real progress in process instead of promoting a pre-tool statement to an answer',
    () => {
      const stopped = applyXiaozhiEvent(
        {
          id: 'stop',
          status: 'running',
          items: [
            { id: 'x', kind: 'message', role: 'assistant', phase: 'commentary', phaseSource:'explicit', text: '先读取' },
          ],
        },
        { kind: 'status', status: 'interrupted' },
      );
      assert.equal(splitAgentTrace(stopped).body.length, 0);
      assert.equal(splitAgentTrace(stopped).process[0].text, '先读取');
    },
  );
  await check(
    'unknown-phase compatibility waits for actual SDK stop, never a last-array heuristic',
    () => {
      let t = { id: 'legacy', status: 'running', items: [] };
      for (const e of [
        { kind: 'assistant_start', segment: 1 },
        { kind: 'text_delta', delta: '未带标记的原文' },
      ])
        t = applyXiaozhiEvent(t, e);
      assert.equal(splitAgentTrace(t).body.length, 0);
      t = applyXiaozhiEvent(t, { kind: 'assistant_end', segment: 1, final: true });
      assert.equal(splitAgentTrace(t).body[0].text, '未带标记的原文');
    },
  );
  await check(
    'buffer flushes text before a tool/phase/status boundary and never drops Unicode',
    async () => {
      const commits = [],
        buffer = createChatStreamBuffer((events) => commits.push(events));
      buffer.push({ kind: 'text_delta', delta: '🙂' });
      buffer.push({ kind: 'text_delta', delta: '汉' });
      assert.equal(commits.length, 0);
      buffer.push({ kind: 'tool_start', callId: 't' });
      assert.equal(commits.length, 1);
      assert.equal(commits[0].length, 3);
      buffer.push({ kind: 'text_delta', delta: '终' });
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(commits.length, 2);
      buffer.push({ kind: 'text_delta', delta: '已切会话' });
      buffer.dispose();
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(commits.length, 2);
    },
  );
  await check('snapshot readback cannot replay already hydrated deltas', () => {
    const previous = {
      running: true,
      projection: { sourceSequence: 5, turns: [{ id: 'r', status: 'running', items: [] }] },
    };
    assert.equal(
      applyChatSnapshotEvent(previous, {
        kind: 'text_delta',
        sessionId: 's',
        runId: 'r',
        sequence: 4,
        delta: '重复',
      }),
      previous,
    );
  });
  await check('header wall clock advances despite a stale SDK snapshot and freezes at answer handoff',async()=>{
    const {AgentTraceHeader}=await server.ssrLoadModule('/src/renderer/components/office/AgentTraceHeader.tsx');
    const {createRoot}=await import('react-dom/client');
    const dom=new JSDOM('<div id="clock"></div>'),previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
    globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const host=dom.window.document.getElementById('clock'),root=createRoot(host);
    const active={id:'clock',status:'running',items:[],startedAt:Date.now()-50000,elapsedMs:0,presentation:{version:1,phase:'process',processStartedAt:Date.now()-5000}};
    try{
      await React.act(async()=>root.render(React.createElement(AgentTraceHeader,{turn:active,streaming:true})));
      assert.match(host.textContent,/[5-9] 秒/);
      const before=host.textContent;
      await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100));});
      assert.notEqual(host.textContent,before);
      await React.act(async()=>root.render(React.createElement(AgentTraceHeader,{turn:{...active,presentation:{version:1,phase:'answer',processStartedAt:1000,processEndedAt:7200,processElapsedMs:6200}},streaming:false})));
      assert(host.textContent.includes('6 秒'));const frozen=host.textContent;
      await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100));});
      assert.equal(host.textContent,frozen);
    }finally{
      await React.act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;
    }
  });
  await check('public clock persists exact boundaries and does not count preparation or private events', async () => {
    const {readChatPresentation}=await server.ssrLoadModule('/src/shared/chat-presentation.ts');
    let t={id:'timed',status:'running',items:[],startedAt:100};
    const emit=e=>{t=applyXiaozhiEvent(t,e);};
    emit({kind:'assistant_start',segment:1,capturedAt:1000});
    emit({kind:'assistant_phase',segment:1,phase:'commentary',since:1100,capturedAt:1100});
    emit({kind:'text_delta',delta:'  ',capturedAt:1200});
    assert.equal(t.presentation.processStartedAt,undefined);
    emit({kind:'text_delta',delta:'先读资料',capturedAt:2000});
    emit({kind:'tool_start',tool:'office_read_attachment',callId:'tool',capturedAt:3000});
    emit({kind:'assistant_start',segment:2,capturedAt:4000});
    emit({kind:'assistant_phase',segment:2,phase:'final_answer',since:5000});
    assert.equal(t.presentation.processElapsedMs,3000);
    assert.deepEqual(readChatPresentation(JSON.parse(JSON.stringify(t.presentation))),t.presentation);
    emit({kind:'assistant_end',segment:2,final:true,since:9000});
    assert.equal(t.presentation.processElapsedMs,3000);
    emit({kind:'tool_start',tool:'office_read_attachment',callId:'late',capturedAt:9500});
    assert.equal(t.presentation.phase,'process');assert.equal(t.presentation.toolAfterAnswer,true);
    assert(agentTraceTimeline(t).some(entry=>entry.id==='late'));
  });
  await check('unknown historical clock and private-only runs never acquire a duration', async () => {
    const {AgentTraceHeader}=await server.ssrLoadModule('/src/renderer/components/office/AgentTraceHeader.tsx');
    const html=renderToStaticMarkup(React.createElement(AgentTraceHeader,{turn:{id:'old',status:'completed',items:[],startedAt:1,elapsedMs:999999,presentation:{version:1,phase:'answer',processElapsedMs:999999}},streaming:false}));
    assert(!html.includes('model-thinking-duration'));
    let t={id:'unknown',status:'running',items:[]};
    t=applyXiaozhiEvent(t,{kind:'tool_start',tool:'read',callId:'old'});
    t=applyXiaozhiEvent(t,{kind:'assistant_phase',segment:1,phase:'final_answer',since:6000});
    assert.equal(t.presentation.processElapsedMs,undefined);
  });
  await check('tool evidence shows safe receipt and retry outcome without invocation timings', async () => {
    const {OfficeToolEvidence}=await server.ssrLoadModule('/src/renderer/components/office/OfficeToolProcess.tsx');
    const html=renderToStaticMarkup(React.createElement(OfficeToolEvidence,{item:{id:'tool',kind:'tool',status:'completed',durationMs:9876,resultSummary:{version:1,scope:'read',text:'已读取指定页',query:'浮力'},toolAttempt:{version:1,callId:'tool',attempt:1,maxAttempts:2,state:'succeeded',effect:'none',queueWaitMs:1000,executionMs:8000}}}));
    assert(html.includes('已读取指定页'));assert(html.includes('浮力'));assert(!/实际用时|本次排队|本次执行|pi-tool-timing|9876/.test(html));
    const old=renderToStaticMarkup(React.createElement(OfficeToolEvidence,{item:{id:'old',kind:'tool',status:'completed'}}));
    assert(old.includes('未保存公开详情'));
  });
  await check('manual reopen survives final-token updates and host completion',async()=>{
    const {useAgentTraceState}=await server.ssrLoadModule('/src/renderer/components/office/useAgentTraceState.ts');
    const {createRoot}=await import('react-dom/client');
    const dom=new JSDOM('<div id="hook"></div>'),previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
    globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    let state;const root=createRoot(dom.window.document.getElementById('hook'));
    function Harness({turn}){state=useAgentTraceState(turn);return null;}
    const active={id:'same',status:'running',items:[],presentation:{version:1,phase:'process'}};
    const render=t=>React.act(async()=>root.render(React.createElement(Harness,{turn:t})));
    try{
      await render(active);assert.equal(state.expanded,true);
      const final={...active,presentation:{version:1,phase:'answer'}};
      await render(final);assert.equal(state.expanded,false);
      await React.act(async()=>state.setExpanded(true));
      await render({...final,status:'completed'});assert.equal(state.expanded,true);
      await render({...final,status:'completed',elapsedMs:10000});assert.equal(state.expanded,true);
      await render({...active,id:'new'});assert.equal(state.expanded,true);
      await render({...active,id:'new',status:'interrupted'});assert.equal(state.expanded,true);
    }finally{await React.act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;}
  });
  await check('explicit commentary cannot be promoted by a generic SDK stop or terminal status',()=>{
    let t={id:'comment',status:'running',items:[]};
    for(const e of [
      {kind:'assistant_start',segment:1},
      {kind:'assistant_phase',segment:1,phase:'commentary',since:1000},
      {kind:'text_delta',delta:'我先核对资料',capturedAt:2000},
      {kind:'assistant_end',segment:1,final:true,since:3000},
      {kind:'status',status:'completed',capturedAt:4000},
    ])t=applyXiaozhiEvent(t,e);
    assert.equal(splitAgentTrace(t).body.length,0);
    assert.equal(splitAgentTrace(t).process[0].text,'我先核对资料');
    assert.equal(t.presentation.phase,'process');
  });
  await check('phase for a nonexistent segment cannot fold the current process',()=>{
    const t=applyXiaozhiEvent({id:'r',status:'running',items:[]},{kind:'assistant_phase',segment:99,phase:'final_answer',since:3000});
    assert.equal(t.presentation,undefined);
  });
  await check('tool detail choice survives unmount at handoff and reopening the process',async()=>{
    const {OfficeToolExpansionScope}=await server.ssrLoadModule('/src/renderer/components/office/OfficeToolExpansion.tsx');
    const {AgentPublicTool}=await server.ssrLoadModule('/src/renderer/components/office/AgentPublicTool.tsx');
    const {createRoot}=await import('react-dom/client');
    const dom=new JSDOM('<div id="tool-scope"></div>'),previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
    globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const host=dom.window.document.getElementById('tool-scope'),root=createRoot(host);
    const item={id:'kept',kind:'tool',toolName:'office_read_attachment',status:'completed',label:'读取资料',resultSummary:{version:1,scope:'read',text:'已读取指定资料'}};
    const render=show=>React.act(async()=>root.render(React.createElement(OfficeToolExpansionScope,null,show?React.createElement(AgentPublicTool,{item,sessionId:'s'}):null)));
    try{
      await render(true);
      await React.act(async()=>{const details=host.querySelector('details');details.open=true;details.dispatchEvent(new dom.window.Event('toggle'));});
      assert.equal(host.querySelector('details').open,true);
      await render(false);assert.equal(host.querySelector('details'),null);
      await render(true);assert.equal(host.querySelector('details').open,true);
      assert(host.textContent.includes('已读取指定资料'));
    }finally{await React.act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;}
  });
  await check('public tool target uses recorded title/query, escapes markup and suppresses paths/payloads',async()=>{
    const {agentToolTarget}=await server.ssrLoadModule('/src/renderer/components/office/agent-tool-target.ts');
    const {AgentPublicTool}=await server.ssrLoadModule('/src/renderer/components/office/AgentPublicTool.tsx');
    const base={id:'target',kind:'tool',status:'completed',label:'读取资料'};
    assert.equal(agentToolTarget({...base,sources:[{title:'浮力实验.pdf'}]}),'浮力实验.pdf');
    assert.equal(agentToolTarget({...base,resultSummary:{query:'浮力',text:'已查找'}}),'浮力');
    assert.equal(agentToolTarget(base),undefined);
    for(const title of ['C:\\Users\\teacher\\secret.pdf','/home/private/file.txt','{"path":"private"}'])
      assert.equal(agentToolTarget({...base,sources:[{title}]}),undefined);
    assert(Array.from(agentToolTarget({...base,sources:[{title:'长'.repeat(100)}]})).length<=60);
    const html=renderToStaticMarkup(React.createElement(AgentPublicTool,{item:{...base,sources:[{title:'<img src=x onerror=alert(1)>'}]},sessionId:'s'}));
    const doc=new JSDOM(html).window.document;
    assert.equal(doc.querySelectorAll('img').length,0);
    assert.equal(doc.querySelector('[data-testid="agent-tool-target"]').textContent,'<img src=x onerror=alert(1)>');
    assert(doc.querySelector('summary .edu-operation-chevron'));
  });
  await check('summary focus restores to handoff control without stealing composer focus',async()=>{
    const {OfficeToolExpansionScope}=await server.ssrLoadModule('/src/renderer/components/office/OfficeToolExpansion.tsx');
    const {AgentPublicTool}=await server.ssrLoadModule('/src/renderer/components/office/AgentPublicTool.tsx');
    const {createRoot}=await import('react-dom/client');
    const dom=new JSDOM('<textarea id="composer-native"></textarea><div id="focus-tools"></div>'),previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
    globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const host=dom.window.document.getElementById('focus-tools'),root=createRoot(host);
    function Harness({show}){
      const fallback=React.useRef(null);
      return React.createElement(React.Fragment,null,
        React.createElement(OfficeToolExpansionScope,{fallbackRef:fallback,collapsed:!show},
          React.createElement('button',{ref:fallback},'处理过程'),
          show?React.createElement(AgentPublicTool,{item:{id:'focus',kind:'tool',status:'completed'},sessionId:'s'}):null));
    }
    const render=show=>React.act(async()=>root.render(React.createElement(Harness,{show})));
    try{
      await render(true);
      await React.act(async()=>host.querySelector('summary').focus());
      assert.equal(dom.window.document.activeElement,host.querySelector('summary'));
      await render(false);
      assert.equal(dom.window.document.activeElement,host.querySelector('button'));
      await render(true);
      await React.act(async()=>host.querySelector('summary').focus());
      await React.act(async()=>dom.window.document.getElementById('composer-native').focus());
      await render(false);
      assert.equal(dom.window.document.activeElement,dom.window.document.getElementById('composer-native'));
    }finally{await React.act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;}
  });
  console.log(JSON.stringify({ suite: 'reply-presentation-boundaries', passed }));
} finally {
  await server.close();
}
