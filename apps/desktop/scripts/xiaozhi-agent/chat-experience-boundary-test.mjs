import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true}});
let passed=0;
const check=(label,fn)=>{fn();passed++;console.log('PASS '+label);};
try{
 const {readComposerDraft,writeComposerDraft}=await server.ssrLoadModule('/src/renderer/components/office/composer-drafts.ts');
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 check('drafts isolated by session and reloadable',()=>{writeComposerDraft('one',{text:'未发送的教学要求',skill:'lesson'},storage);writeComposerDraft('two',{text:'另一个学生',skill:''},storage);assert.equal(readComposerDraft('one',storage).text,'未发送的教学要求');assert.equal(readComposerDraft('two',storage).text,'另一个学生');});
 check('accepted draft clear does not clear other sessions',()=>{writeComposerDraft('one',{text:'',skill:''},storage);assert.equal(readComposerDraft('one',storage).text,'');assert.equal(readComposerDraft('two',storage).text,'另一个学生');});
 check('broken or unavailable storage never blocks editing',()=>{assert.deepEqual(readComposerDraft('bad',{getItem(){throw Error();}}),{text:'',skill:''});assert.doesNotThrow(()=>writeComposerDraft('x',{text:'a',skill:''},{setItem(){throw Error();}}));});
 const {OfficeMarkdown}=await server.ssrLoadModule('/src/renderer/components/office/OfficeMarkdown.tsx');
 for(const text of ['求 $x+2=5$。','$$\\frac{1}{2}+\\frac{1}{3}$$','|题目|答案|\n|---|---|\n|$x^2$|$4$|','$$\n\\begin{aligned}x+2&=5\\\\x&=3\\end{aligned}\n$$']){
  check('math rendered '+text.slice(0,12),()=>{const html=renderToStaticMarkup(React.createElement(OfficeMarkdown,{children:text}));assert.match(html,/katex/);assert(!html.includes('<script>'));});
 }
 check('incomplete and erroneous math preserve readable content',()=>{for(const text of ['正在推导 $\\frac{1}{','$$\\unknowncommand{x}$$'])assert.doesNotThrow(()=>renderToStaticMarkup(React.createElement(OfficeMarkdown,{children:text,isStreaming:true})));});
 const {normalizeMathDelimiters}=await server.ssrLoadModule('/src/renderer/components/office/math-delimiters.ts');
 check('model TeX parentheses and brackets render in prose and tables',()=>{for(const text of ['求 \\(x+2=5\\)。','\\[\\frac{1}{2}+\\frac{1}{3}\\]','|题目|答案|\n|---|---|\n|\\(x^2\\)|\\(4\\)|'])assert.match(renderToStaticMarkup(React.createElement(OfficeMarkdown,{children:text})),/katex/);});
 check('math delimiter compatibility preserves code escaped text and streaming fragments',()=>{for(const text of ['`\\(x\\)`','``\\(x\\)``','```tex\n\\[x\\]\n```','~~~tex\n\\(x\\)\n~~~','    \\(x\\)','\\\\(literal\\\\)','<code>\\(x\\)</code>','<code>\\(x\\)','未完成 \\(\\frac{1}{','$\\text{\\(x\\)}$','$$\n\\text{\\(x\\)}\n$$'])assert.equal(normalizeMathDelimiters(text),text);assert.equal(normalizeMathDelimiters('代码 `\\(x\\)` 后面 \\(y\\)'), '代码 `\\(x\\)` 后面 $y$');});
 const {applyXiaozhiEvent}=await server.ssrLoadModule('/src/shared/xiaozhi-projection.ts');
 check('stopped text is partial rather than final',()=>{const turn={id:'r',status:'running',items:[{id:'m',kind:'message',role:'assistant',phase:'commentary',text:'部分结果'}]};assert.equal(applyXiaozhiEvent(turn,{kind:'status',status:'interrupted',runId:'r',sessionId:'s',sequence:2}).items[0].phase,'partial_answer');});
 check('public tool empty summary survives projection',()=>{let t={id:'r',status:'running',items:[]};t=applyXiaozhiEvent(t,{kind:'tool_start',tool:'search_teacher_knowledge',callId:'c'});t=applyXiaozhiEvent(t,{kind:'tool_end',tool:'search_teacher_knowledge',callId:'c',success:true,resultSummary:{version:1,count:0,text:'没有找到匹配资料'}});assert.equal(t.items[0].resultSummary.count,0);});
 const {availableChatTool,sourceAvailabilityText}=await server.ssrLoadModule('/src/shared/chat-source-availability.ts');
 const empty={knowledge:false,materials:false,questions:false,attachments:false,workspace:false};
 check('known empty entrances skipped without removing ask/approval tools',()=>{for(const name of ['search_teacher_knowledge','office_list_files','office_list_materials','education_search_questions','office_list_attachments'])assert(!availableChatTool(name,empty));assert(availableChatTool('ask_teacher',empty));assert(availableChatTool('office_create_document',empty));assert(sourceAvailabilityText(empty).includes('禁止虚构来源'));});
 check('available sources and existing sessions retain their tools',()=>{for(const name of ['search_teacher_knowledge','office_list_files','office_list_materials','education_search_questions','office_list_attachments'])assert(availableChatTool(name,Object.fromEntries(Object.keys(empty).map(k=>[k,true]))));});
 const {publicToolResult}=await server.ssrLoadModule('/src/main/xiaozhi-agent/public-tool-result.ts');
 check('tool summaries never copy arbitrary model or private payloads',()=>{const result=publicToolResult('education_search_questions',true,{count:0,raw:'PRIVATE STUDENT'});assert.equal(result.count,0);assert(!JSON.stringify(result).includes('PRIVATE'));assert(!publicToolResult('office_web_search',true,{count:-2}).count);});
 const {validReplyExport}=await server.ssrLoadModule('/src/shared/reply-export.ts');
 const exportInput={version:1,sessionId:'aisession_00000000-0000-0000-0000-000000000001',runId:'run_00000000-0000-0000-0000-000000000001',itemId:'item',requestId:'reply_00000000-0000-0000-0000-000000000001',contentHash:'a'.repeat(64),title:'教学内容'};
 check('reply export rejects renderer paths and supplied content',()=>{assert(validReplyExport(exportInput));assert(!validReplyExport({...exportInput,destinationRoot:'C:/Windows'}));assert(!validReplyExport({...exportInput,content:'forged'}));assert(!validReplyExport({...exportInput,contentHash:'bad'}));});
 console.log(JSON.stringify({suite:'chat-experience-boundaries',passed}));
}finally{await server.close();}
