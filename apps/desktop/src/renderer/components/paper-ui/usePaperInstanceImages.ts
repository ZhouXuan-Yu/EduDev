import {useEffect,useState} from 'react';
import type {PaperInstanceBlock,PaperInstanceRole} from '../../../shared/paper-instance';
import {independentQuestionImage} from '../../../shared/question-document';
import {ORIGINAL_MULTI_SCHEMA} from '../../../shared/original-multi-review';
import type {PaperWorkspaceEntry} from './paper-basket-client';

type Entry=Pick<PaperWorkspaceEntry,'question'|'questionId'|'contentVersion'>;
type State={key:string;images:Record<string,string>;loaded:Record<string,boolean>;error:string;loading:boolean};
/** One bounded gallery read for the edited role, not one read per image block. */
export function usePaperInstanceImages(entry:Entry,role:PaperInstanceRole,blocks:PaperInstanceBlock[],onReady?:(ready:boolean)=>void){
 const refs=blocks.flatMap(b=>b.type==='sourceImage'?[b]:[]),signature=JSON.stringify(refs);
 const [attempt,setAttempt]=useState(0),[state,setState]=useState<State>({key:'',images:{},loaded:{},error:'',loading:true});
 const key=entry.questionId+':'+entry.contentVersion+':'+role+':'+signature+':'+attempt;
 useEffect(()=>{
  let live=true;onReady?.(false);setState({key,images:{},loaded:{},error:'',loading:!!refs.length});
  if(!refs.length){onReady?.(true);return;}
  async function read(){
   if(role!=='question'||refs.length>8||new Set(refs.map(r=>r.blockId)).size!==refs.length)throw Error('unsupported');
   const images=refs.map(r=>{
    const image=independentQuestionImage(entry.question.document,r.blockId);
    if(r.role!==role||r.sourceVersion!==entry.contentVersion||!image)throw Error('unsupported');return image;
   });
   const gallery=await window.omniEdu!.getOriginalQuestionGallery({schemaVersion:ORIGINAL_MULTI_SCHEMA,questionId:entry.questionId,version:entry.contentVersion});
   if(!gallery.ok)throw Error('source_changed');
   return Object.fromEntries(images.map(image=>{
    const found=gallery.value.filter(i=>i.role===role&&i.kind==='diagram'&&i.assetId===image.assetId&&i.sha256===image.sha256);
    if(found.length!==1||!found[0].dataUrl)throw Error('source_changed');return [image.id,found[0].dataUrl];
   }));
  }
  void read().then(images=>{if(live)setState({key,images,loaded:{},error:'',loading:false});}).catch(()=>{
   if(live){setState({key,images:{},loaded:{},error:'配图尚不能独立交付，或原资料已变化。引用已保留，请重新读取后对照原题核实。',loading:false});onReady?.(false);}
  });
  return ()=>{live=false;};
 },[key,onReady]);
 const current:State=state.key===key?state:{key,images:{},loaded:{},error:'',loading:!!refs.length};
 useEffect(()=>{if(state.key===key&&refs.length)onReady?.(!state.loading&&!state.error&&refs.every(r=>state.loaded[r.blockId]));},[state,key,onReady]);
 const loaded=(id:string,ok:boolean)=>setState(old=>old.key!==key?old:{...old,loaded:{...old.loaded,[id]:ok},...(!ok?{error:'配图无法显示，请重新读取并核对后再确认。'}:{})});
 return {...current,onLoad:(id:string)=>loaded(id,true),onError:(id:string)=>loaded(id,false),retry:()=>setAttempt(v=>v+1)};
}
