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
  event({ kind: 'text_delta', delta: '先实读附件。', traceOrder: 20 });
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
    'reasoning, public action, tools remain in actual capture order despite async sanitization',
    () =>
      assert.deepEqual(
        agentTraceTimeline(turn).map((e) => e.id),
        ['reasoning:1:0', 'r:segment:1', 't1', 'reasoning:2:0', 't2'],
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
    assert.equal(turn.presentation.processElapsedMs, 4000);
  });
  await check(
    'handoff preserves the answer identity through incremental deltas and host completion',
    () => {
      const id = splitAgentTrace(turn).body[0].id;
      event({ kind: 'text_delta', delta: '继续输出', traceOrder: 61 });
      event({ kind: 'assistant_end', segment: 3, final: true, since: 10000 });
      event({ kind: 'status', status: 'completed', finishedAt: 12000 });
      assert.equal(splitAgentTrace(turn).body[0].id, id);
      assert.equal(turn.presentation.processElapsedMs, 4000);
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
            { id: 'x', kind: 'message', role: 'assistant', phase: 'commentary', text: '先读取' },
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
    const active={id:'clock',status:'running',items:[],startedAt:Date.now()-5000,elapsedMs:0};
    try{
      await React.act(async()=>root.render(React.createElement(AgentTraceHeader,{turn:active,streaming:true})));
      assert.match(host.textContent,/[5-9] 秒/);
      const before=host.textContent;
      await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100));});
      assert.notEqual(host.textContent,before);
      await React.act(async()=>root.render(React.createElement(AgentTraceHeader,{turn:{...active,presentation:{version:1,phase:'answer',processElapsedMs:6200}},streaming:false})));
      assert(host.textContent.includes('6 秒'));const frozen=host.textContent;
      await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100));});
      assert.equal(host.textContent,frozen);
    }finally{
      await React.act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;
    }
  });
  console.log(JSON.stringify({ suite: 'reply-presentation-boundaries', passed }));
} finally {
  await server.close();
}
