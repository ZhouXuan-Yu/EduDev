import {useLayoutEffect,useRef,useState} from 'react';
import {PAPER_REFERENCE_SCHEMA} from '../../../shared/paper-reference';
import type {PaperTemplateVersion,PaperTemplateSave,PaperTemplateApply,PaperTemplateReceipt,PaperTemplateMapping,PaperTemplateArrange,PaperTemplateUnavailable} from '../../../shared/paper-template';
import type {PaperWorkspaceBasket} from './paper-basket-client';
import type {usePaperReference} from './usePaperReference';
import {paperTemplatePatches} from './paper-template-patches';
import {useDesktopNavigationGuard} from '../desktop/DesktopFrame';
type Pending={kind:'save';input:PaperTemplateSave}|{kind:'apply';input:PaperTemplateApply}|{kind:'arrange';input:PaperTemplateArrange};
export const templateVersionKey=(v:PaperTemplateVersion)=>v.templateId+':'+v.version;
const ref=(v:PaperTemplateVersion)=>({templateId:v.templateId,version:v.version,digest:v.digest});
export function usePaperTemplates(basket:PaperWorkspaceBasket|undefined,reference:ReturnType<typeof usePaperReference>,reload:()=>Promise<boolean>) {
  const [unavailable,setUnavailable]=useState<PaperTemplateUnavailable[]>([]);
  const [committedReceipt,setCommittedReceipt]=useState<PaperTemplateReceipt>();
  const [versions,setVersions]=useState<PaperTemplateVersion[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [name,setName]=useState(''),[editing,setEditing]=useState<PaperTemplateVersion>();
  const [structureKey,setStructureKey]=useState(''),[layoutKey,setLayoutKey]=useState('');
  const [mapping,setMapping]=useState<PaperTemplateMapping[]>([]),[retryable,setRetryable]=useState(false);
  const epoch=useRef(0),pending=useRef<Pending|undefined>(undefined),working=useRef(false),current=useRef(basket);current.current=basket;
  const structure=versions.find(v=>templateVersionKey(v)===structureKey),layout=versions.find(v=>templateVersionKey(v)===layoutKey);
  useDesktopNavigationGuard(busy||retryable,'模板操作尚未结束或提交结果待核实，请先核实原请求。');
  useLayoutEffect(()=>{epoch.current++;pending.current=undefined;setCommittedReceipt(undefined);setVersions([]);setUnavailable([]);setEditing(undefined);setStructureKey('');setLayoutKey('');setMapping([]);setName('');setMessage('');setRetryable(false);
    return()=>{const p=pending.current;if(p)void window.omniEdu?.cancelPaperTemplateOperation({sessionId:p.input.sessionId,basketId:p.input.basketId,requestId:p.input.requestId}).catch(()=>{});};
  },[basket?.id,basket?.sessionId]);
  useLayoutEffect(()=>()=>{epoch.current++;const p=pending.current;if(p)void window.omniEdu?.cancelPaperTemplateOperation({sessionId:p.input.sessionId,basketId:p.input.basketId,requestId:p.input.requestId}).catch(()=>{});},[]);
  useLayoutEffect(()=>{if(editing&&(!reference.candidate||reference.candidate.source.resourceId!==editing.candidate.source.resourceId||reference.candidate.digest!==editing.candidateDigest)){setEditing(undefined);setName('');}},[reference.candidate?.digest,reference.candidate?.source.resourceId]);
  async function list(){const b=current.current,api=window.omniEdu;if(!b||!api||working.current)return;const stamp=epoch.current;working.current=true;setBusy(true);
    try{const r=await api.listPaperTemplates({sessionId:b.sessionId,basketId:b.id});if(stamp!==epoch.current)return;
      if(r.ok){setVersions(r.value.versions);setUnavailable(r.value.unavailable);setMessage(r.value.versions.length?'已核实可用模板；失效版本单列，不可应用。':'尚无可用模板，请检查下方失效原因或保存新模板。');}else setMessage('模板列表读取失败：'+r.error);
    }catch{if(stamp===epoch.current)setMessage('模板列表读取失败，可重新读取。');}finally{working.current=false;setBusy(false);}}
  async function load(v:PaperTemplateVersion){const b=current.current,api=window.omniEdu;if(!b||!api||working.current||reference.dirty)return;
    const stamp=epoch.current;working.current=true;setBusy(true);
    try{const r=await api.readPaperTemplate({sessionId:b.sessionId,basketId:b.id,...ref(v)});if(stamp!==epoch.current)return;
      if(!r.ok){setMessage('模板读取失败：'+r.error);return;}
      if(reference.loadCandidate(r.value.candidate)){setEditing(r.value);setName(r.value.name);setMessage('正在修改确切版本；保存新版本不会改变题篮。');}
    }catch{if(stamp===epoch.current)setMessage('模板读取失败，未更改候选。');}finally{working.current=false;setBusy(false);}}
  async function execute(p:Pending){const api=window.omniEdu;if(!api||working.current)return;const stamp=epoch.current;working.current=true;pending.current=p;setBusy(true);setRetryable(false);setMessage('正在复核来源并提交…');
    try{const r=p.kind==='save'?await api.savePaperTemplateVersion(p.input):p.kind==='apply'?await api.applyPaperTemplates(p.input):await api.arrangePaperTemplateRetained(p.input);
      if(stamp!==epoch.current)return;
      if(!r.ok){setMessage('操作未完成：'+r.error);if(r.error==='unavailable'){setRetryable(true);}else pending.current=undefined;return;}
      const receipt:PaperTemplateReceipt=r.value;setCommittedReceipt(receipt);
      setMessage(receipt.template?`已持久保存版本 ${receipt.template.version}；题篮未应用。`:`已提交题篮修订 ${receipt.basketRevision}。`);
      if(p.kind==='save'&&receipt.template){
        reference.markSaved();
        const read=await api.readPaperTemplate({sessionId:p.input.sessionId,basketId:p.input.basketId,...receipt.template});
        if(stamp!==epoch.current)return;
        if(!read.ok){
          if(read.error==='unavailable'){setMessage(`版本 ${receipt.template.version} 已提交，版本读回暂不可用；沿原 requestId 核实。`);setRetryable(true);}
          else {pending.current=undefined;setRetryable(false);setEditing(undefined);reference.close(true);setMessage(`已保存版本 ${receipt.template.version}（${receipt.template.templateId}）；当前来源不可用：${read.error}。提交事实已保留，可退出并在来源恢复后重新读取。`);}
          return;
        }
        setVersions(old=>[read.value,...old.filter(v=>templateVersionKey(v)!==templateVersionKey(read.value))]);setEditing(read.value);pending.current=undefined;
      }
      else if(!await reload()){setMessage(`已提交修订 ${receipt.basketRevision}，当前读取待核实；沿原 requestId 重试。`);setRetryable(true);return;}
      else pending.current=undefined;
    }catch{if(stamp===epoch.current){setMessage('结果待核实，保留原 requestId；请重试同一请求，不要重复新建。');setRetryable(true);}}
    finally{working.current=false;setBusy(false);}}
  function save(kind:'structure'|'layout',mode:'new'|'version'|'copy') {
    const b=current.current,c=reference.candidate;if(!b||!c||reference.sourceInvalid||retryable)return;
    if(mode!=='new'&&!editing){setMessage('先从模板列表读取确切版本。');return;}
    if(mode==='version'&&editing?.kind!==kind){setMessage('新版本必须与原模板种类相同。');return;}
    const head=editing?Math.max(...versions.filter(v=>v.templateId===editing.templateId).map(v=>v.version),editing.version):0;
    void execute({kind:'save',input:{schemaVersion:PAPER_REFERENCE_SCHEMA,sessionId:b.sessionId,basketId:b.id,basketRevision:b.revision,
      resourceId:c.source.resourceId,version:c.source.version,requestId:'template_'+crypto.randomUUID(),expectedCandidateDigest:editing?.candidateDigest??c.digest,
      expectedHeadVersion:mode==='version'?head:0,...(mode==='version'?{templateId:editing!.templateId}:{}),
      ...(mode==='copy'?{derivedFrom:ref(editing!)}:{}),name,kind,patches:paperTemplatePatches(c)}});
  }
  function apply(kind:'structure'|'layout'|'both'){const b=current.current;if(reference.dirty){setMessage('请先保存或明确放弃参考卷修订，再应用已保存模板。');return;}if(!b||retryable||kind!=='layout'&&!structure||kind!=='structure'&&!layout)return;
    const base={sessionId:b.sessionId,basketId:b.id,expectedRevision:b.revision,requestId:'template_'+crypto.randomUUID()};
    void execute({kind:'apply',input:kind==='layout'?{...base,kind,layout:ref(layout!)}:kind==='structure'?{...base,kind,structure:ref(structure!),mapping}
      :{...base,kind,structure:ref(structure!),layout:ref(layout!),mapping}});}
  function arrange(operation:PaperTemplateArrange['operation']){const b=current.current;if(b&&!retryable)void execute({kind:'arrange',input:{sessionId:b.sessionId,basketId:b.id,requestId:'template_'+crypto.randomUUID(),expectedRevision:b.revision,operation}});}
  function cancel(){const p=pending.current;if(p)void window.omniEdu?.cancelPaperTemplateOperation({sessionId:p.input.sessionId,basketId:p.input.basketId,requestId:p.input.requestId});}
  return {versions,unavailable,busy,message,committedReceipt,name,setName,editing,list,load,save,structure,layout,structureKey,layoutKey,
    setStructureKey:(key:string)=>{setStructureKey(key);setMapping([]);},setLayoutKey,mapping,setMapping,apply,arrange,cancel,retryable,
    retry:()=>{const p=pending.current;if(p)void execute(p);}};
}
