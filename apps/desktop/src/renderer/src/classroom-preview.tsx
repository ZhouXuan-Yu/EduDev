import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SlideCanvas} from '@openmaic/renderer';
import type {Scene} from '@openmaic/dsl';
import {applyEditorTransaction,createEditorHistory,undoEditorTransaction,redoEditorTransaction,type EditorHistory,type EditorTransaction} from '@openmaic/editor/core';
import {EMPTY_SELECTION,type Selection} from '@openmaic/editor/react';
import {EditableSlideCanvasWithUI} from '@openmaic/editor/ui';
import 'katex/dist/katex.min.css';
import './classroom-preview.css';
/** Opaque-origin sandbox. No preload/API/files/network; parent passes already validated DSL only. */
function Preview(){
 const [payload,setPayload]=useState<{scene:Scene;editing:boolean;token:string}>();
 const [history,setHistory]=useState<EditorHistory>(),historyRef=useRef<EditorHistory|undefined>(undefined),payloadRef=useRef(payload);
 const [selection,setSelection]=useState<Selection>(EMPTY_SELECTION),[error,setError]=useState('');
 // React effects run after the canvas DOM commits. Offscreen/hidden frames can
 // suspend requestAnimationFrame, so it cannot gate the parent's review control.
 useEffect(()=>{if(payload&&!payload.editing&&document.querySelector('.classroom-canvas'))parent.postMessage({type:'xiaozhi-classroom-rendered',token:payload.token,sceneId:payload.scene.id},'*');},[payload]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{
  if(event.source!==parent||event.data?.type!=='xiaozhi-classroom-slide'||event.data.scene?.type!=='slide'||typeof event.data.token!=='string')return;
  const next=event.data as NonNullable<typeof payload>,scene=next.scene;if(scene.type!=='slide')return;
  if(payloadRef.current?.token!==next.token||payloadRef.current?.scene.id!==next.scene.id||JSON.stringify(historyRef.current?.present)!==JSON.stringify(next.scene.type==='slide'?next.scene.content:null)){
   const fresh=createEditorHistory(scene.content);historyRef.current=fresh;setHistory(fresh);setSelection(EMPTY_SELECTION);
  }
  payloadRef.current=next;setPayload(next);setError('');
 };window.addEventListener('message',receive);parent.postMessage({type:'xiaozhi-classroom-ready'},'*');return()=>window.removeEventListener('message',receive);},[]);
 function publish(next:EditorHistory){const p=payloadRef.current;if(!p?.editing||p.scene.type!=='slide')return;historyRef.current=next;setHistory(next);parent.postMessage({type:'xiaozhi-classroom-edited',token:p.token,scene:{...p.scene,content:next.present}},'*');}
 function apply(transaction:EditorTransaction){try{if(historyRef.current)publish(applyEditorTransaction(historyRef.current,transaction));}catch{setError('本次修改未应用，请重试。');}}
 if(payload?.scene.type!=='slide')return <p>正在加载课堂内容…</p>;
 if(!payload.editing||!history)return <SlideCanvas slide={payload.scene.content.canvas} className="classroom-canvas"/>;
 return <div className="classroom-editor"><header><span>点击文字修改；拖动图形调整位置</span><select aria-label="选择课页元素" data-testid="classroom-element-select" value={selection.primaryId??''} onChange={event=>{const id=event.target.value;setSelection(id?{elementIds:[id],primaryId:id}:EMPTY_SELECTION);}}><option value="">选择元素</option>{history.present.canvas.elements.map((element,index)=><option key={element.id} value={element.id}>{({text:'文字',line:'线条',shape:'图形',latex:'公式'} as Record<string,string>)[element.type]??'元素'} {index+1}</option>)}</select><button data-testid="classroom-undo" disabled={!history.past.length} onClick={()=>{setSelection(EMPTY_SELECTION);publish(undoEditorTransaction(history));}}>撤销</button><button data-testid="classroom-redo" disabled={!history.future.length} onClick={()=>{setSelection(EMPTY_SELECTION);publish(redoEditorTransaction(history));}}>重做</button></header>{error&&<p role="alert">{error}</p>}<div className="classroom-editor-surface" data-testid="classroom-editor-surface"><EditableSlideCanvasWithUI slide={history.present.canvas} selection={selection} onSelectionChange={setSelection} onTransaction={apply} insertItems={['text','line','latex']} host={{locale:'zh-CN'}} snapping/></div></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
