import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const base=new URL('../src/renderer/components/office/',import.meta.url);
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(name){const module={exports:{}};vm.runInNewContext(compile(fs.readFileSync(new URL(name,base),'utf8')),{module,exports:module.exports,Promise,Symbol,Error,setTimeout});return module.exports;}
const {createPiSessionNavigation}=load('pi-session-navigation.ts');
const {createPiSnapshotHydrator}=load('pi-snapshot-hydrator.ts');
const ast=ts.createSourceFile('workspace.tsx',fs.readFileSync(new URL('PiEducationWorkspace.tsx',base),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=[],callbacks={onOpenSession:[],onNewSession:[]};
function visit(n){
 if(ts.isFunctionDeclaration(n)&&['open','fresh'].includes(n.name?.text))functions.push(n.getText(ast));
 if(ts.isJsxAttribute(n)&&callbacks[n.name.text]&&n.initializer?.expression)callbacks[n.name.text].push(n.initializer.expression.getText(ast));
 if(ts.isPropertyAssignment(n)&&callbacks[n.name.getText(ast)])callbacks[n.name.getText(ast)].push(n.initializer.getText(ast));
 ts.forEachChild(n,visit);
}visit(ast);
assert.equal(functions.length,2);assert.equal(callbacks.onOpenSession.length,2);assert.equal(callbacks.onNewSession.length,2);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const tick=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function fixture(){
 const reads=[],creates=[],notices=[],navs=[];let listReads=0;
 const ref=current=>({current});
 const s={active:ref(true),visibleRef:ref(true),idRef:ref('old'),snapshotRef:ref(undefined),opening:ref(undefined),loadingEarlierRef:ref(false),attempt:ref(undefined),queueAttempt:ref(undefined),compactAttempt:ref(undefined),snapshotBarrier:ref(undefined),sequences:ref(new Map()),eventReceiver:ref({reset(){}}),viewBuffer:ref({clear(){}}),navigationRef:ref(undefined),sessionNavigation:ref(undefined)};
 const navigation={target:{view:'ai',sessionId:'old'},navigate(target){navs.push(target);if(navigation.blocked)return false;navigation.target=target;s.sessionNavigation.current.observe(target);return true;}};s.navigationRef.current=navigation;
 s.hydration=ref(createPiSnapshotHydrator({read:target=>{const d=deferred();reads.push({target,...d});return d.promise;},publish:value=>{assert.equal(value.id,s.idRef.current);s.snapshotRef.current=value;},failed:()=>notices.push('refresh_failed')}));
 const noop=()=>{};
 const sandbox={...s,window:{omniEdu:{createAiConversationSession:input=>{const d=deferred();creates.push({input,...d});return d.promise;}}},localStorage:{setItem:noop},setId:noop,setSnapshot:noop,setModels:noop,setNotice:n=>notices.push(n),setLoadingEarlier:noop,setHydrating:noop,setRefreshFailed:noop,clearSnapshotBarrier:noop,requireSynchronized(){if(sandbox.syncBlocked)throw Error('sync_blocked');},refreshList:async()=>{listReads++;},hydrate:target=>s.hydration.current.hydrate(target),onSelected:noop,navigation};
 vm.createContext(sandbox);vm.runInContext(compile(functions.join('\n')+'\nthis.open=open;this.fresh=fresh;'),sandbox);
 s.sessionNavigation.current=createPiSessionNavigation({target:()=>navigation.target,active:()=>s.active.current,navigate:id=>navigation.navigate({view:'ai',sessionId:id}),open:id=>sandbox.open(id,false)});
 const cb=Object.fromEntries(Object.entries(callbacks).map(([key,items])=>[key,items.map(text=>vm.runInContext(compile('('+text+')'),sandbox))]));
 return {...s,navigation,sandbox,cb,reads,creates,notices,navs,get listReads(){return listReads;},move:target=>navigation.navigate(target),finish:async id=>{await tick();const r=reads.find(r=>r.target===id);assert(r,'expected read '+id);r.resolve({id});await tick();}};
}
let passed=0;
async function test(name,run){await run();passed++;console.log('PASS '+name);}
for(let i=0;i<2;i++){
 await test(`open ${i}: normal single hydration`,async()=>{const f=fixture(),p=f.cb.onOpenSession[i]('A');assert.equal(f.navigation.target.sessionId,'A');await f.finish('A');await p;assert.equal(f.reads.length,1);assert.equal(f.navs.length,1);});
 await test(`open ${i}: teaching during deferred read wins`,async()=>{const f=fixture(),p=f.cb.onOpenSession[i]('A');await tick();f.move({view:'teaching'});await f.finish('A');await p;assert.equal(f.navigation.target.view,'teaching');assert.equal(f.navs.length,2);});
 await test(`open ${i}: B wins with A finishing last`,async()=>{const f=fixture(),a=f.cb.onOpenSession[i]('A');await tick();const b=f.cb.onOpenSession[i]('B');await f.finish('B');await b;await f.finish('A');await a;assert.equal(f.idRef.current,'B');assert.equal(f.snapshotRef.current.id,'B');assert.equal(f.navigation.target.sessionId,'B');assert.equal(f.reads.length,2);});
 await test(`open ${i}: failure reports error, preserves later navigation`,async()=>{const f=fixture(),p=f.cb.onOpenSession[i]('A');await tick();f.move({view:'teaching'});f.reads[0].reject(Error('disk_failed'));await p;assert.equal(f.navigation.target.view,'teaching');assert(f.notices.includes('无法读取本地会话，请重试。'));assert(f.notices.includes('refresh_failed'));});
 await test(`open ${i}: rejected navigation preserves session and draft`,async()=>{const f=fixture(),target={view:'teaching',draft:'teacher draft'};f.navigation.target=target;f.navigation.blocked=true;await f.cb.onOpenSession[i]('A');assert.strictEqual(f.navigation.target,target);assert.equal(f.idRef.current,'old');assert.equal(f.reads.length,0);});
 await test(`new ${i}: create/open once, no navigation after hydration`,async()=>{const f=fixture(),p=f.cb.onNewSession[i]('folder','Lesson');f.creates[0].resolve({session:{id:'new'}});await tick();assert.equal(f.navigation.target.sessionId,'new');f.move({view:'teaching'});await f.finish('new');await p;assert.equal(f.navigation.target.view,'teaching');assert.equal(f.reads.length,1);assert.equal(f.listReads,1);});
 await test(`new ${i}: module change during create preserves draft`,async()=>{const f=fixture(),p=f.cb.onNewSession[i](),target={view:'teaching',draft:'teacher text'};f.move(target);f.creates[0].resolve({session:{id:'new'}});await p;assert.strictEqual(f.navigation.target,target);assert.equal(f.idRef.current,'old');assert.equal(f.reads.length,0);assert.equal(f.listReads,1);});
 await test(`new ${i}: selected B supersedes creation`,async()=>{const f=fixture(),p=f.cb.onNewSession[i](),b=f.cb.onOpenSession[i]('B');await f.finish('B');await b;f.creates[0].resolve({session:{id:'new'}});await p;assert.equal(f.idRef.current,'B');assert.equal(f.navigation.target.sessionId,'B');assert.equal(f.reads.length,1);assert.equal(f.listReads,1);});
 await test(`new ${i}: failure propagates without navigation`,async()=>{const f=fixture(),p=f.cb.onNewSession[i]();f.creates[0].reject(Error('create_failed'));await assert.rejects(p,/create_failed/);assert.equal(f.idRef.current,'old');assert.equal(f.navs.length,0);});
}
await test('newest creation wins, older remains discoverable',async()=>{const f=fixture(),a=f.cb.onNewSession[1](),b=f.cb.onNewSession[1]();f.creates[1].resolve({session:{id:'B'}});await f.finish('B');await b;f.creates[0].resolve({session:{id:'A'}});await a;assert.equal(f.idRef.current,'B');assert.equal(f.reads.length,1);assert.equal(f.listReads,2);});
await test('leave and return to same target invalidates pending create',async()=>{const f=fixture(),target=f.navigation.target,p=f.cb.onNewSession[1]();f.move({view:'teaching'});f.move(target);f.creates[0].resolve({session:{id:'new'}});await p;assert.equal(f.reads.length,0);assert.equal(f.listReads,1);});
await test('hidden bridge enters AI with one hydration',async()=>{const f=fixture();f.visibleRef.current=false;f.move({view:'teaching'});const p=f.cb.onOpenSession[1]('A');await f.finish('A');await p;assert.equal(f.navigation.target.sessionId,'A');assert.equal(f.reads.length,1);});
await test('legacy fresh shares cancellation',async()=>{const f=fixture(),p=f.sandbox.fresh(null);f.move({view:'teaching'});f.creates[0].resolve({session:{id:'new'}});await p;assert.equal(f.reads.length,0);assert.equal(f.idRef.current,'old');});
await test('synchronization guard precedes bridge create',async()=>{const f=fixture();f.sandbox.syncBlocked=true;await assert.rejects(f.cb.onNewSession[1](),/sync_blocked/);assert.equal(f.creates.length,0);});
await test('missing creation keeps existing bridge failure',async()=>{const f=fixture(),p=f.cb.onNewSession[1]();f.creates[0].resolve(undefined);await assert.rejects(p,/对话创建失败/);assert.equal(f.navs.length,0);});


// Mount the whole production orchestrator with inert presentation components.
// React effects, navigation observation, IPC callbacks and hydrator remain real.
const React=await import('react');
const {JSDOM}=await import('jsdom');
const {createRequire}=await import('node:module');
const require=createRequire(import.meta.url);
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','localStorage'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const {flushSync}=await import('react-dom');
let nav,bridge;
const Context=React.createContext(null);
const passthrough=({children})=>children??null,empty=()=>null;
const workspaceModule={exports:{}};
const snapshot=id=>({projection:{threadId:id,turns:[],sourceSequence:0},running:false});
const special={
 './pi-session-navigation':{createPiSessionNavigation},'./pi-snapshot-hydrator':{createPiSnapshotHydrator},
 '../desktop/DesktopFrame':{useDesktopNavigation:()=>React.useContext(Context),useDesktopCommands(){}},
 './PiWorkbenchBridge':{PiWorkbenchBridge:({data})=>{bridge=data;return null;}},
 './usePiAttachments':{usePiAttachments:()=>({selections:[],cards:null})},
 './permissionModes':{readPiPermissionMode:()=> 'request',writePiPermissionMode(){}},
 './PiHomeLayout':{isHomeConversation:()=>true,PiHomeSuggestions:empty},
 './workspace-notifications':{workspaceNotifications:()=>[]},
 './pi-text-view-buffer':{createPiTextViewBuffer:()=>({clear(){},flush(){},canReplace:()=>true,acknowledge(){}}),mergePiViewSnapshot:(_old,current)=>current},
 '../../../shared/xiaozhi-event-receiver':{createEventReceiver:()=>({reset(){},cursors:()=>[],seed(){},synchronization:()=> 'ready'})},
};
const production=fs.readFileSync(new URL('PiEducationWorkspace.tsx',base),'utf8');
const compiled=ts.transpileModule(production,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
vm.runInNewContext(compiled,{module:workspaceModule,exports:workspaceModule.exports,require:id=>{
 if(id==='react')return React;if(id==='react-dom')return {flushSync};if(id==='react/jsx-runtime')return require(id);
 if(special[id])return special[id];
 return new Proxy({}, {get:(_t,key)=>key==='__esModule'?true:(key==='OfficeComposerState'||key==='OfficeSynchronization'||key==='PiWorkspaceShell'?passthrough:empty)});
},window:dom.window,localStorage:dom.window.localStorage,crypto:globalThis.crypto,Promise,Error,Symbol,Set,Map,setInterval,clearInterval});
const Workspace=workspaceModule.exports.PiEducationWorkspace;
let root;
async function mounted(run){
 localStorage.clear();
 const reads=[],creates=[];
 const sessions=['old','A','B'].map(id=>({id,title:id}));
 window.omniEdu={listAiConversations:async()=>({folders:[],sessions,archivedFolders:[],archivedSessions:[]}),getXiaozhiSnapshot:id=>{const d=deferred();reads.push({id,...d});if(id==='old')d.resolve(snapshot(id));return d.promise;},getXiaozhiSettings:async()=>({ok:false}),onXiaozhiEvent:()=>()=>{},createAiConversationSession:()=>{const d=deferred();creates.push(d);return d.promise;}};
 function Host(){const [target,setTarget]=React.useState({view:'ai'});nav={target,navigate:t=>{setTarget(t);return true;},reject(){},flush(){},consumeDraft(){}};return React.createElement(Context.Provider,{value:nav},React.createElement(Workspace,{visible:target.view==='ai',onLeave(){},onSettings(){}}));}
 root=createRoot(document.getElementById('root'));
 const act=fn=>React.act(async()=>{fn?.();await tick();});
 try{await act(()=>root.render(React.createElement(Host)));await act();await run({act,reads,creates});}
 finally{await act(()=>root.unmount());root=undefined;}
}
try{
 await test('mounted production: navigation effect does not reopen selected session',()=>mounted(async({act,reads})=>{let p;await act(()=>{p=bridge.onOpenSession('A');});assert.equal(reads.filter(r=>r.id==='A').length,1);await act(()=>nav.navigate({view:'teaching'}));await act(()=>reads.find(r=>r.id==='A').resolve(snapshot('A')));await p;assert.equal(nav.target.view,'teaching');assert.equal(reads.filter(r=>r.id==='A').length,1);}));
 await test('mounted production: hidden bridge selection hydrates once',()=>mounted(async({act,reads})=>{await act(()=>nav.navigate({view:'teaching'}));let p;await act(()=>{p=bridge.onOpenSession('A');});await act(()=>reads.find(r=>r.id==='A').resolve(snapshot('A')));await act();assert.equal(reads.filter(r=>r.id==='A').length,1);await p;assert.equal(nav.target.sessionId,'A');assert.equal(reads.filter(r=>r.id==='A').length,1);}));
 await test('mounted production: delayed creation preserves committed module navigation',()=>mounted(async({act,reads,creates})=>{let p;await act(()=>{p=bridge.onNewSession(null,'Lesson');});await act(()=>nav.navigate({view:'teaching'}));await act(()=>creates[0].resolve({session:{id:'new'}}));await p;assert.equal(nav.target.view,'teaching');assert.equal(reads.filter(r=>r.id==='new').length,0);}));
 await test('mounted production: creation from teaching opens and hydrates once',()=>mounted(async({act,reads,creates})=>{await act(()=>nav.navigate({view:'teaching'}));let p;await act(()=>{p=bridge.onNewSession(null,'Lesson');});await act(()=>creates[0].resolve({session:{id:'A'}}));assert.equal(reads.filter(r=>r.id==='A').length,1);await act(()=>reads.find(r=>r.id==='A').resolve(snapshot('A')));await p;assert.equal(nav.target.sessionId,'A');assert.equal(reads.filter(r=>r.id==='A').length,1);}));
 await test('mounted production: failed open releases token so return can retry',()=>mounted(async({act,reads})=>{let p;await act(()=>{p=bridge.onOpenSession('A');});await act(()=>reads.find(r=>r.id==='A').reject(Error('disk_failed')));await p;await act(()=>nav.navigate({view:'teaching'}));await act(()=>nav.navigate({view:'ai',sessionId:'A'}));const retry=reads.filter(r=>r.id==='A');assert.equal(retry.length,2);await act(()=>retry[1].resolve(snapshot('A')));assert.equal(bridge.activeSessionId,'A');}));
}finally{dom.window.close();}
console.log(JSON.stringify({success:true,passed,scope:'includes mounted production orchestrator; presentation components are inert fixtures'}));
