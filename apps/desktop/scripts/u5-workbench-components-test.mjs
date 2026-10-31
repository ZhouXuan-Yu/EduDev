import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server = await createServer({appType:'custom', optimizeDeps:{noDiscovery:true}, server:{middlewareMode:true,hmr:false}});
let count=0;
const check=(value,message)=>{assert(value,message);count++;};
try {
 const nav=await server.ssrLoadModule('/src/renderer/components/product/WorkbenchPageNavigation.tsx');
 check(nav.studentPages.length===7,'all student routes retained');
 check(nav.teachingPages.length===5,'all teaching routes retained');
 for(const [id] of nav.studentPages)check(nav.isStudentPage(id),'student route '+id);
 for(const [id] of nav.teachingPages)check(nav.isTeachingPage(id),'teaching route '+id);
 check(!nav.isStudentPage('ai')&&!nav.isTeachingPage('settings'),'unrelated pages excluded');
 const markup=renderToStaticMarkup(React.createElement(nav.WorkbenchPageNavigation,{view:'mistakes'}));
 check(markup.includes('aria-current="page"'),'active route announced');
 check(markup.includes('hub-entry-intake'),'intake reachable');
 const {StudentWorkbench,canShowStudentContext,rememberStudentContext}=await server.ssrLoadModule('/src/renderer/components/product/StudentWorkbench.tsx');
 check(canShowStudentContext('one','one'),'explicit matching selection');
 check(!canShowStudentContext('one','two'),'late different student cannot show details');
 check(!canShowStudentContext('one',undefined),'deleted or missing student cannot show details');
 check(!canShowStudentContext('','one'),'host auto-selection cannot reveal details');
 const student={id:'one',displayName:'教师本地称呼',grade:'八年级',subjects:['物理']};
 const props={student,directory:()=>React.createElement('div',null,'真实学生目录'),creating:false,children:React.createElement('div',null,'PRIVATE_DETAIL')};
 const empty=renderToStaticMarkup(React.createElement(StudentWorkbench,props));
 check(empty.includes('student-workbench-empty'),'initial explicit selection required');
 check(empty.includes('真实学生目录'),'real directory retained');
 check(empty.includes('hub-entry-intake')&&empty.includes('hub-entry-search'),'intake and search accessible before selection');
 check(!empty.includes('PRIVATE_DETAIL'),'implicit host fallback does not expose student detail');
 const creating=renderToStaticMarkup(React.createElement(StudentWorkbench,{...props,creating:true}));
 check(creating.includes('PRIVATE_DETAIL'),'existing create/edit form remains visible');
 check(!creating.includes(student.displayName),'new profile form does not show previous student context header');
 const previousStorage=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 const preferences=new Map();
 try {
   Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:key=>preferences.get(key)||null,setItem:(key,value)=>preferences.set(key,value)}});
   rememberStudentContext('one');
   const restored=renderToStaticMarkup(React.createElement(StudentWorkbench,props));
   check(restored.includes('PRIVATE_DETAIL'),'explicit legacy directory choice survives home remount');
   rememberStudentContext('other');
   const mismatched=renderToStaticMarkup(React.createElement(StudentWorkbench,props));
   check(!mismatched.includes('PRIVATE_DETAIL'),'mismatched persisted ID still cannot reveal fallback student');
   rememberStudentContext('one');
   const current=renderToStaticMarkup(React.createElement(StudentWorkbench,props));
   check(current.includes('PRIVATE_DETAIL'),'new explicit selection replaces older preference');
 } finally {
   if(previousStorage)Object.defineProperty(globalThis,'sessionStorage',previousStorage);else delete globalThis.sessionStorage;
 }
 const {SettingsNavigation}=await server.ssrLoadModule('/src/renderer/components/office/SettingsNavigation.tsx');
 const {Plug}=await import('lucide-react');
 const tabs=['models','permissions','interface','backup','archives','skills','tools','diagnostics'].map(id=>({id,label:id,icon:Plug}));
 const daily=renderToStaticMarkup(React.createElement(SettingsNavigation,{tabs,active:'models',disabled:false,onSelect:()=>{}}));
 check(daily.includes('日常设置')&&daily.includes('高级与诊断'),'daily/advanced hierarchy');
 check(/id="pi-settings-advanced-nav"[^>]*hidden/.test(daily),'advanced initially hidden');
 for(const id of tabs.map(t=>t.id))check(daily.includes('pi-settings-tab-'+id),'setting retained '+id);
 const advanced=renderToStaticMarkup(React.createElement(SettingsNavigation,{tabs,active:'tools',disabled:false,onSelect:()=>{}}));
 check(!/id="pi-settings-advanced-nav"[^>]*hidden/.test(advanced),'advanced active from search stays visible');
 console.log(JSON.stringify({passed:count,scope:'U5 component rendering, not Electron/data acceptance'}));
} finally {await server.close();}
