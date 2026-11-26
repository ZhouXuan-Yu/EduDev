import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {SettingsWindowController} from '../src/main/settings-window/controller.ts';

class Contents extends EventEmitter {
 constructor(){super();this.mainFrame={url:''};this.url='';}
 getURL(){return this.url;}
 setWindowOpenHandler(handler){this.openHandler=handler;}
}
class Window extends EventEmitter {
 constructor(options){super();this.options=options;this.webContents=new Contents();this.destroyed=false;this.minimized=false;this.focused=false;this.visible=false;this.focusCalls=0;this.bounds={x:0,y:0,width:960,height:660,...options};}
 isDestroyed(){return this.destroyed;}
 isMinimized(){return this.minimized;}
 isFocused(){return this.focused;}
 isVisible(){return this.visible;}
 show(){this.visible=true;}
 focus(){this.focused=true;this.focusCalls++;this.emit('focus');}
 restore(){this.minimized=false;}
 getBounds(){return this.bounds;}
 setBounds(bounds){this.bounds={...this.bounds,...bounds};}
 setMinimumSize(width,height){this.minimum={width,height};}
 close(){this.destroy();}
 destroy(){this.destroyed=true;this.visible=false;this.emit('closed');}
}
function setup(overrides={}){
 const windows=[],dim=[],main=new Window({}),area={x:-1280,y:0,width:1280,height:720};
 const options={create:o=>{const w=new Window(o);windows.push(w);return w;},preload:'settings.cjs',trustedUrl:'file:///app/settings.html',main:()=>main,workArea:()=>area,onDim:v=>dim.push(v),timeoutMs:80,
  load:async w=>{w.webContents.url='file:///app/settings.html';w.webContents.mainFrame.url=w.webContents.url;w.webContents.emit('did-finish-load');w.emit('ready-to-show');},...overrides};
 return {windows,dim,main,area,controller:new SettingsWindowController(options)};
}
const checks=[];
async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
await test('repeated opens during creation share one top-level nonmodal sandboxed window',async()=>{
 const t=setup();const first=t.controller.open(),second=t.controller.open();await Promise.all([first,second]);
 assert.equal(t.windows.length,1);const w=t.windows[0];assert.equal(w.options.parent,undefined);assert.equal(w.options.modal,false);assert.equal(w.options.alwaysOnTop,false);assert.equal(w.options.show,false);
 assert.deepEqual(w.options.webPreferences,{preload:'settings.cjs',sandbox:true,contextIsolation:true,nodeIntegration:false});
 assert(w.visible);const previous=w.focusCalls;assert.equal(await t.controller.open(),w);assert(w.focusCalls>previous);assert.equal(t.windows.length,1);
 t.controller.dispose();
});
await test('load failure rejects, destroys its window and permits a fresh retry',async()=>{
 let failures=1;const t=setup({load:async w=>{if(failures--)throw Error('load_failed');w.webContents.url='file:///app/settings.html';w.webContents.mainFrame.url=w.webContents.url;w.webContents.emit('did-finish-load');w.emit('ready-to-show');}});
 await assert.rejects(t.controller.open(),/load_failed/);assert(t.windows[0].destroyed);assert(await t.controller.open());assert.equal(t.windows.length,2);t.controller.dispose();
});
await test('missing first paint times out and leaves no hidden singleton',async()=>{
 const t=setup({load:async()=>{},timeoutMs:8});await assert.rejects(t.controller.open(),/settings_load_timeout/);assert(t.windows[0].destroyed);assert.equal(t.controller.window,undefined);t.controller.dispose();
});
await test('close during creation settles the pending open instead of hanging',async()=>{
 const t=setup({load:async()=>{}});const pending=t.controller.open();t.windows[0].destroy();await assert.rejects(pending,/settings_closed/);assert.equal(t.controller.window,undefined);t.controller.dispose();
});
await test('main focus, settings blur, hide, minimize and close clear dimming',async()=>{
 const t=setup();const w=await t.controller.open();assert.equal(t.dim.at(-1),true);
 t.main.focus();assert.equal(t.dim.at(-1),false);t.main.focused=false;w.focus();assert.equal(t.dim.at(-1),true);
 for(const event of ['blur','hide','minimize']){w.emit(event);assert.equal(t.dim.at(-1),false);w.focus();}
 w.destroy();assert.equal(t.dim.at(-1),false);t.controller.dispose();
});
await test('all geometry stays in DIP workArea including a removed display',async()=>{
 const t=setup();const w=await t.controller.open();assert(w.options.x>=-1280);assert(w.options.x+w.options.width<=0);
 Object.assign(t.area,{x:0,y:0,width:700,height:500});t.controller.fit();const b=w.getBounds();assert(b.x>=0&&b.y>=0&&b.x+b.width<=700&&b.y+b.height<=500);t.controller.dispose();
});
await test('only current settings mainFrame at its exact local document is trusted',async()=>{
 const t=setup();const w=await t.controller.open(),event={sender:w.webContents,senderFrame:w.webContents.mainFrame};assert(t.controller.trusted(event));
 assert(!t.controller.trusted({...event,senderFrame:{url:w.webContents.url}}));assert(!t.controller.trusted({sender:new Contents(),senderFrame:w.webContents.mainFrame}));
 w.webContents.url='https://invalid.example/';assert(!t.controller.trusted(event));t.controller.dispose();
});
await test('unexpected navigation, webviews and popup windows are denied',async()=>{
 const t=setup();const w=await t.controller.open();let prevented=0;const event={preventDefault:()=>prevented++};
 w.webContents.emit('will-navigate',event,'https://invalid.example/');w.webContents.emit('will-frame-navigate',event);w.webContents.emit('will-attach-webview',event);assert.equal(prevented,3);assert.deepEqual(w.webContents.openHandler({url:'https://invalid.example/'}),{action:'deny'});
 t.controller.dispose();await assert.rejects(t.controller.open(),/settings_quitting/);assert(w.destroyed);
});
await test('a crashed settings renderer is revoked and a subsequent open recreates it',async()=>{
 const t=setup();const first=await t.controller.open();first.webContents.emit('render-process-gone',{},{});assert(first.destroyed);assert.equal(t.controller.window,undefined);
 assert.notEqual(await t.controller.open(),first);t.controller.dispose();
});
console.log(JSON.stringify({suite:'settings-window-controller',passed:checks.length,checks,boundary:'Lifecycle unit tests with injected window ports; not actual Electron or configuration acceptance'}));
