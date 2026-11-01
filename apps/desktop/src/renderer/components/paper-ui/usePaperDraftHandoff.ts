import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {PAPER_SCHEMA,type PaperView} from '../../../shared/paper-blueprint';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {clearPaperUiDraft,paperUiStorage,readPaperUiDraft,savePaperUiDraft,type PaperUiDraft} from './paper-draft-storage';

type Props={blocked:boolean;message:string;onRestore:(draft:PaperUiDraft,view?:PaperView)=>void};
/** One owner in the shared guard registry, with a synchronous, single-call handoff. */
export function usePaperDraftHandoff(props:Props){
 const navigation=useDesktopNavigation(),latest=useRef(props);latest.current=props;
 const permit=useRef(false);
 const [initial]=useState(()=>typeof window==='undefined'?{status:'empty'} as const:readPaperUiDraft(paperUiStorage()));
 const [restoring,setRestoring]=useState(initial.status==='ready'),[recovered,setRecovered]=useState(false),[error,setError]=useState('');
 useLayoutEffect(()=>navigation.registerGuard(()=>!permit.current&&(latest.current.blocked||restoring)?latest.current.message:undefined),[navigation.registerGuard,restoring]);
 useEffect(()=>{
  let live=true;
  if(initial.status==='invalid'){clearPaperUiDraft(paperUiStorage());setError('暂存蓝图损坏，未恢复任何确认状态。请重新设置蓝图。');return;}
  if(initial.status!=='ready')return;
  void(async()=>{
   const draft=initial.draft;let view:PaperView|undefined,failed=false;
   try{if(draft.currentView){const result=await window.omniEdu?.reviewPaper({schemaVersion:PAPER_SCHEMA,...draft.currentView});if(result?.ok&&result.value.id===draft.currentView.id&&result.value.sessionId===draft.currentView.sessionId)view=result.value;else failed=true;}}catch{failed=true;}
   if(!live)return;
   latest.current.onRestore(draft,view);setRecovered(true);setRestoring(false);clearPaperUiDraft(paperUiStorage());
   if(failed)setError('蓝图编辑已恢复，但原试卷未能重新核验。请重新组卷，不能确认或导出原快照。');
  })();
  return()=>{live=false;};
 },[initial]);
 function clear(){clearPaperUiDraft(paperUiStorage());setRecovered(false);setError('');}
 function handoff(draft:PaperUiDraft,prompt:string):boolean{
  if(!savePaperUiDraft(paperUiStorage(),draft)){setError('无法暂存当前蓝图，已保留编辑且未离开。请检查蓝图或本地界面存储。');return false;}
  permit.current=true;
  try{const accepted=navigation.navigate({view:'ai',sessionId:draft.targetSessionId,draft:prompt});if(!accepted){clearPaperUiDraft(paperUiStorage());setError('其他页面仍有未保存内容，未跳转；当前蓝图修改已保留。');}return accepted;}
  catch{clearPaperUiDraft(paperUiStorage());setError('打开出题任务未完成，当前蓝图修改已保留。');return false;}
  finally{permit.current=false;}
 }
 return {handoff,clear,restoring,recovered,error};
}
