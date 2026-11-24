import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},css:{postcss:{plugins:[]}},server:{middlewareMode:true,watch:null,hmr:false}});
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
try {
  const {AppNativeSelect}=await server.ssrLoadModule('/src/renderer/components/ui/AppNativeSelect.tsx');
  const options=[React.createElement('option',{key:'one',value:'one'},'基础'),React.createElement('option',{key:'two',value:'two',disabled:true},'不可用')];
  const props={name:'difficulty','aria-label':'难度',value:'one',onChange:()=>{},children:options};
  const single=render(AppNativeSelect,props);
  check('native form name, label and selected value survive the adapter',()=>{assert.match(single,/name="difficulty"/);assert.match(single,/aria-label="难度"/);assert.match(single,/value="one" selected/);});
  check('disabled option remains disabled',()=>assert.match(single,/value="two" disabled/));
  check('decorative indicator is hidden from accessibility tree',()=>assert.match(single,/aria-hidden="true"/));
  check('disabled field retains native disabled semantics',()=>assert.match(render(AppNativeSelect,{...props,disabled:true}),/<select[^>]*disabled/));
  check('invalid field and description remain addressable',()=>assert.match(render(AppNativeSelect,{...props,'aria-invalid':true,'aria-describedby':'error'}),/aria-invalid="true" aria-describedby="error"/));
  check('list selection has no misleading popup indicator',()=>assert(!render(AppNativeSelect,{...props,multiple:true,value:['one']}).includes('<svg')));
  const {TaskOverviewCard}=await server.ssrLoadModule('/src/renderer/components/office/workbench/TaskOverviewCard.tsx');
  const row={sessionId:'aisession_11111111-1111-4111-8111-111111111111',taskId:'xitask_'+'a'.repeat(64),revision:1,requirementsVersion:1,
    sessionTitle:'上海七年级数学期中试卷，只含一模，不含二模。<script>不可执行</script>'.repeat(3),state:'interrupted',updatedAt:'2026-11-24T08:00:00Z',
    lastRunId:'run-1',isLatestForSession:true,resumeCandidate:false,continuationCandidate:false,blockedReasons:['unknown_effect'],pendingApprovalCount:1,unknownEffectCount:1,
    planningLevel:1,nativeInspection:'not_checked',goalExcerpt:'只选一模；不含二模；保留教师手选题。',steps:{total:3,verified:1}};
  const common={row,expanded:true,disabled:false,partial:false,onOpen:()=>{}};
  for(const [state,label] of Object.entries({active:'执行中',review_required:'待你核对',paused:'需要重新核对',interrupted:'本轮未完成',completed:'你已确认',ended:'已结束'})) {
    check('task state and legal return action: '+state,()=>{const html=render(TaskOverviewCard,{...common,row:{...row,state}});assert(html.includes(label));assert(html.includes(state==='completed'||state==='ended'?'查看原对话':'回到对话继续'));assert(!html.includes('继续剩余步骤'));});
  }
  const card=render(TaskOverviewCard,common);
  check('long original title is escaped and constraints are not removed',()=>{assert(card.includes('&lt;script&gt;'));assert(!card.includes('<script>'));assert(card.includes(row.goalExcerpt));assert(card.includes('查看完整原对话'));});
  check('record identity remains explicit on the task card',()=>{assert(card.includes('data-task-id="'+row.taskId+'"'));assert(card.includes('data-session-id="'+row.sessionId+'"'));});
  check('no native disclosure marker in the task card',()=>{assert(!/<details|<summary/.test(card));assert(card.includes('aria-expanded="false"'));});
  check('partial snapshot cannot enable direct resume',()=>{const html=render(TaskOverviewCard,{...common,partial:true,row:{...row,resumeCandidate:true},onRestore:async()=>{}});assert.match(html,/<button[^>]*disabled[^>]*data-testid="pi-task-overview-resume"|<button[^>]*data-testid="pi-task-overview-resume"[^>]*disabled/);});
  console.log(JSON.stringify({suite:'ui-ux-r1-components',passed,layer:'component',fixtures:'synthetic task metadata only; no provider or business acceptance claim'}));
}finally{await server.close();}
