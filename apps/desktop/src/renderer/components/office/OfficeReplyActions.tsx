import {useEffect,useRef,useState} from 'react';
import {Button,Input,Modal,TextArea} from '@heroui/react';
import {Copy,FileDown,Pencil} from 'lucide-react';
import {ChatMessage} from '../../heroui-pro/components/chat-message';
import type {OfficeProjectedItem,OfficeProjectedTurn} from '../../../shared/office-agent';
import {useOfficeComposerState} from './OfficeComposerState';
import {OfficeMarkdown} from './OfficeMarkdown';
import {useNativeHeroUITheme} from './useNativeHeroUITheme';
export function OfficeReplyActions({item,turn,sessionId}:{item:OfficeProjectedItem;turn:OfficeProjectedTurn;sessionId:string}){
 const nativeTheme=useNativeHeroUITheme();
 const composer=useOfficeComposerState(),[mode,setMode]=useState<'edit'|'save'>(),[notice,setNotice]=useState(''),[instruction,setInstruction]=useState(''),[title,setTitle]=useState('教学安排'),[busy,setBusy]=useState(false);
 const selection=useRef(''),lock=useRef(false),requestId=useRef('reply_'+crypto.randomUUID());
 useEffect(()=>{const remember=()=>{const chosen=window.getSelection();const host=document.querySelector(`[data-item-id="${CSS.escape(item.id)}"]`);if(chosen?.rangeCount&&host?.contains(chosen.getRangeAt(0).commonAncestorContainer))selection.current=chosen.toString().slice(0,4000);};document.addEventListener('selectionchange',remember);return()=>document.removeEventListener('selectionchange',remember);},[item.id]);
 function prepare(){
  if(composer.draftRef.current.trim()){setNotice('输入框中已有草稿，已保留。请先发送或清空，再准备修改。');return;}
  composer.setDraft(`请修改本会话这段回复${selection.current?`中的以下部分：\n「${selection.current}」`:'的教学内容'}。\n修改要求：${instruction.trim()}\n保留未涉及的内容；写文件仍须我重新确认。`);
  setMode(undefined);setNotice('修改要求已放入输入框，确认后发送。');document.querySelector<HTMLTextAreaElement>('[data-testid="office-prompt-input"]')?.focus();
 }
 async function save(){
  if(lock.current||!item.text)return;lock.current=true;setBusy(true);setNotice('');
  try{
   const api=window.omniEdu;if(!api)throw Error('unavailable');
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(item.text));
   const contentHash=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
   const result=await api.exportXiaozhiReply({version:1,sessionId,runId:turn.id,itemId:item.id,requestId:requestId.current,contentHash,title:title.trim()});
   if(result.ok){setMode(undefined);setNotice('已保存为本地 Markdown，可在“教学内容 → 教学文件”再次打开。');}
   else setNotice(result.error==='cancelled'?'已取消，未保存。':result.error==='changed'?'回复已变化，请重新打开保存预览。':'未能保存，请检查目标文件夹后重试。');
  }catch{setNotice('保存结果未确认，请到教学文件核对后重试。');}finally{lock.current=false;setBusy(false);}
 }
 return <><ChatMessage.Actions className="office-reply-actions" data-testid="reply-actions">
  <ChatMessage.Action aria-label="复制回复" tooltip="复制正文" data-testid="reply-copy" onPress={()=>void navigator.clipboard.writeText(item.text||'').then(()=>setNotice('已复制正文。')).catch(()=>setNotice('复制失败，请选中正文复制。'))}><Copy size={16}/><span>复制</span></ChatMessage.Action>
  <ChatMessage.Action aria-label="修改回复" tooltip="修改全部或选中部分" data-testid="reply-edit" onPress={()=>{setMode('edit');setNotice('');}}><Pencil size={16}/><span>修改</span></ChatMessage.Action>
  <ChatMessage.Action aria-label="保存教学内容" tooltip="预览并保存教学内容" data-testid="reply-save" onPress={()=>{requestId.current='reply_'+crypto.randomUUID();setMode('save');setNotice('');}}><FileDown size={16}/><span>保存</span></ChatMessage.Action>
 </ChatMessage.Actions>{notice&&<p className="office-action-notice" role="status" data-testid="reply-action-notice">{notice}</p>}
 {mode&&<Modal.Backdrop className="default" data-heroui-native="" data-theme={nativeTheme} isOpen isDismissable={!busy} onOpenChange={open=>{if(!open&&!busy)setMode(undefined);}}><Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-themed-surface office-reply-dialog" data-testid="reply-dialog">
  <Modal.Header><Modal.Heading>{mode==='edit'?'修改教学内容':'确认保存教学内容'}</Modal.Heading></Modal.Header>
  <Modal.Body>{mode==='edit'?<>{selection.current&&<blockquote>{selection.current}</blockquote>}<label htmlFor="reply-edit-request">希望怎样修改</label><TextArea id="reply-edit-request" data-testid="reply-edit-request" value={instruction} maxLength={2000} rows={3} onChange={e=>setInstruction(e.target.value)}/><p>修改要求先放入输入框，由你确认后发送。</p></>:<><label htmlFor="reply-save-title">标题</label><Input id="reply-save-title" data-testid="reply-save-title" value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} disabled={busy}/><p>{turn.status==='completed'?'请核对正文与答案后保存。':'这是尚未完成的部分回复，请确认是否保存。'}保存为 Markdown，保留原文与公式；保存后可在教学文件查看。</p><div className="office-save-preview"><OfficeMarkdown>{item.text||''}</OfficeMarkdown></div></>}{notice&&<p role="status">{notice}</p>}</Modal.Body>
  <Modal.Footer><Button variant="secondary" isDisabled={busy} onPress={()=>setMode(undefined)}>取消</Button>{mode==='edit'?<Button data-testid="reply-edit-prepare" isDisabled={!instruction.trim()} onPress={prepare}>放入输入框</Button>:<Button data-testid="reply-save-confirm" isDisabled={busy||!title.trim()} onPress={()=>void save()}>{busy?'正在保存…':'确认并选择保存位置'}</Button>}</Modal.Footer>
 </Modal.Dialog></Modal.Container></Modal.Backdrop>}
 </>;
}
