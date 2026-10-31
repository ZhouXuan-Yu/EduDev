import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const server = await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true}});
try {
  const load = path => server.ssrLoadModule('/src/'+path);
  const {defaultPaperBlueprint,validPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {paperDeliveryAllowed} = await load('renderer/components/paper-ui/paper-workflow.ts');
  const {PaperWorkflowNavigation} = await load('renderer/components/paper-ui/PaperWorkflowNavigation.tsx');
  const {PaperBlueprintEditor} = await load('renderer/components/paper-ui/PaperBlueprintEditor.tsx');
  const {PaperReviewPanel} = await load('renderer/components/PaperReviewPanel.tsx');
  const {PaperExportEntry} = await load('renderer/components/PaperExportEntry.tsx');
  const {PaperExportChoices} = await load('renderer/components/paper-ui/PaperExportChoices.tsx');
  const render = (component,props) => renderToStaticMarkup(React.createElement(component,props));
  const blueprint=defaultPaperBlueprint();
  const view={id:'paper-fixture',sessionId:'session-fixture',title:'教师试卷',state:'confirmed',count:0,totalPoints:100,
    revision:1,blueprint,complete:true,sourceCurrent:true,exportCurrent:true,answerVerified:false,
    selection:{items:[],shortages:[],scanned:0,scanComplete:true,excluded:{unsupported:0,missing_answer:0,source_unavailable:0},duplicateRecords:0}};
  assert.equal(paperDeliveryAllowed(view,false),true);
  for (const patch of [{state:'pending'},{state:'rejected'},{complete:false},{sourceCurrent:false},{exportCurrent:false},{exportCurrent:undefined}]) {
    assert.equal(paperDeliveryAllowed({...view,...patch},false),false,JSON.stringify(patch));
  }
  assert.equal(paperDeliveryAllowed(view,true),false);
  assert.equal(paperDeliveryAllowed(undefined,false),false);
  const navigation=render(PaperWorkflowNavigation,{stage:'blueprint',hasView:false,canDeliver:false,disabled:false,onChange:()=>{}});
  assert.match(navigation,/aria-current="step"/);
  assert.match(navigation,/paper-step-review[^>]*disabled/);
  assert.match(navigation,/paper-step-delivery[^>]*disabled/);
  assert.match(navigation,/先按蓝图组卷/);
  assert.match(render(PaperWorkflowNavigation,{stage:'review',hasView:true,canDeliver:false,disabled:false,dirty:true,onChange:()=>{}}),/切换不会丢失修改/);
  assert.match(render(PaperWorkflowNavigation,{stage:'blueprint',hasView:true,canDeliver:true,disabled:false,onChange:()=>{}}),/查看不会撤销确认/);
  const editorProps={busy:false,loading:false,contextsLoading:false,contexts:[],contextOwner:'',hasView:false,actualPoints:100,change:()=>{},field:()=>{},section:()=>{},onMode:()=>{},onContext:()=>{},onSupplement:()=>{},create:async()=>{},cancel:async()=>{}};
  for (const mode of ['source_only','hybrid','ai_original']) {
    const bp={...blueprint,mode,sections:blueprint.sections.map(s=>({...s,...(mode==='hybrid'?{generatedCount:1}:{})}))};
    assert(validPaperBlueprint(bp));
    const html=render(PaperBlueprintEditor,{...editorProps,blueprint:bp});
    for(const field of ['mode','title','subject','grade','duration','total','section-label','section-type','section-count','section-points','section-difficulty','section-kp']) assert(html.includes('paper-'+field));
    assert.equal(html.includes('paper-generation-context"'),mode!=='source_only');
    assert.equal(html.includes('paper-section-generated-count'),mode==='hybrid');
  }
  for (const [patch,allowConfirm] of [[{complete:false},true],[{sourceCurrent:false},true],[{},false]]) {
    const html=render(PaperReviewPanel,{view:{...view,state:'pending',...patch},allowConfirm,onChanged:()=>{}});
    assert.match(html,/paper-confirm[^>]*disabled/);
    assert(html.includes('paper-reject'));
  }
  const exports=render(PaperExportEntry,{view});
  for (const audience of ['student','teacher','answer_sheet']) for(const format of ['docx','pdf']) assert(exports.includes('paper-export-'+audience+'-'+format));
  assert(!exports.includes('交付成功'));
  for(const patch of [{state:'pending'},{sourceCurrent:false},{exportCurrent:false}]) assert.equal(render(PaperExportEntry,{view:{...view,...patch}}),'');
  const calls=[];
  const choices=PaperExportChoices({disabled:false,onPrepare:(...args)=>calls.push(args)});
  for(const section of choices.props.children) for(const button of section.props.children[1].props.children) button.props.onPress();
  assert.deepEqual(calls,[['student','docx',undefined],['student','pdf',undefined],['teacher','docx',undefined],['teacher','pdf',undefined],['student','docx','answer_sheet'],['student','pdf','answer_sheet']]);
  console.log('U4: delivery guards, navigation, three blueprint modes/fields, confirm/reject and six export entries/guards passed. No host writes, Electron or model calls.');
} finally {await server.close();}
