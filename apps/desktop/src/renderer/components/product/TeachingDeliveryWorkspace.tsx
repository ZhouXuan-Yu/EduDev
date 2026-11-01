import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {DELIVERY_CATALOG_SCHEMA,type DeliveryCatalogEntry,type DeliverySummary} from '../../../shared/xiaozhi-delivery';
import {ResourceTable} from '../../ui-system/ResourceTable';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {PiDeliveryBundleCard,deliveryLabels} from '../office/PiDeliveryBundleCard';
import {PiWorkspaceFiles} from '../office/PiWorkspaceFiles';
import {LibraryEmpty} from './LibraryEmpty';
import {libraryDate} from './material-library';

/** Explicit reads only; neither model streaming nor catalog browsing dispatches a task. */
export function TeachingDeliveryWorkspace(){
 const navigation=useDesktopNavigation(),[items,setItems]=useState<DeliveryCatalogEntry[]>([]),[total,setTotal]=useState(0),[next,setNext]=useState<number>();
 const [selected,setSelected]=useState<{id:string;sessionId:string}>(),[detail,setDetail]=useState<{delivery:DeliverySummary;running:boolean}>();
 const [loading,setLoading]=useState(false),[reading,setReading]=useState(false),[error,setError]=useState(''),[detailError,setDetailError]=useState('');
 const [reveal,setReveal]=useState<{id:string;path:string}>(),listEpoch=useRef(0),detailEpoch=useRef(0),listLock=useRef(false);
 async function load(offset=0){
  if(listLock.current)return;listLock.current=true;const stamp=++listEpoch.current;setLoading(true);setError('');
  if(offset===0){++detailEpoch.current;setSelected(undefined);setDetail(undefined);setDetailError('');setReading(false);setReveal(undefined);}
  try{const value=await window.omniEdu?.deliveryCatalog({schemaVersion:DELIVERY_CATALOG_SCHEMA,action:'list',offset});if(stamp!==listEpoch.current)return;
   if(!value?.ok||value.kind!=='list')throw Error();setItems(old=>offset===0?value.items:[...new Map([...old,...value.items].map(item=>[item.id,item])).values()]);setTotal(value.total);setNext(value.nextOffset);
  }catch{if(stamp===listEpoch.current)setError('无法读取整包任务，已保存文件保留，请重试。');}finally{listLock.current=false;if(stamp===listEpoch.current)setLoading(false);}
 }
 async function open(entry:{id:string;sessionId:string}){
  const stamp=++detailEpoch.current;setSelected(entry);setDetail(undefined);setDetailError('');setReading(true);setReveal(undefined);
  try{const value=await window.omniEdu?.deliveryCatalog({schemaVersion:DELIVERY_CATALOG_SCHEMA,action:'get',sessionId:entry.sessionId,bundleId:entry.id});if(stamp!==detailEpoch.current)return;
   if(!value?.ok||value.kind!=='get'){setDetailError(value&&!value.ok&&value.error==='permission_denied'?'原对话已归档或不可用，整包记录保留。':'整包详情暂时无法读取，请刷新后重试。');return;}setDetail(value);
   setItems(old=>old.map(item=>item.id===entry.id?{...item,state:value.delivery.state}:item));
  }catch{if(stamp===detailEpoch.current)setDetailError('整包详情暂时无法读取，请刷新后重试。');}finally{if(stamp===detailEpoch.current)setReading(false);}
 }
 useEffect(()=>{void load();return()=>{++listEpoch.current;++detailEpoch.current;};},[]);
 return <section className="teacher-library" data-edu-domain="" data-testid="teaching-deliveries-workspace" aria-label="整包任务">
  <header className="teacher-library-heading"><div><h1>整包任务</h1><p>查看每份文件的交付状态，继续未完成的部分。</p></div><Button variant="secondary" isDisabled={loading} onPress={()=>void load()} data-testid="deliveries-refresh">刷新任务</Button></header>
  {error&&<p role="alert">{error}</p>}<p className="teacher-library-count">{loading&&!items.length?'正在读取整包任务…':`已列出 ${items.length} / ${total} 个整包任务 · 不含归档对话 · 状态以读取时为准`}</p>
  <div className="teacher-library-grid">
   <div><ResourceTable label="整包任务列表" rows={items.map(item=>({id:item.id,title:item.paths.join('、'),description:libraryDate(item.createdAt)+' · '+item.title,type:`${item.paths.length}份文件`,state:deliveryLabels[item.state]}))} selected={selected?.id} onSelect={id=>{const entry=items.find(item=>item.id===id);if(entry)void open(entry);}} testPrefix="delivery" empty={loading?<p role="status">正在读取整包任务…</p>:<LibraryEmpty title="还没有整包任务" description="请小智同时制作两份以上教学文件，整包审阅和交付记录会显示在这里。"/>}/>
   {next!==undefined&&<Button variant="ghost" isDisabled={loading} onPress={()=>void load(next)} data-testid="deliveries-more">{loading?'正在读取…':'加载更多任务'}</Button>}</div>
   <section className="teacher-library-detail pi-themed-surface" aria-label="整包任务内容" data-testid="delivery-detail">
    {selected&&<div className="teacher-library-detail-actions"><Button variant="ghost" onPress={()=>navigation.navigate({view:'ai',sessionId:selected.sessionId})} data-testid="delivery-conversation">打开对话</Button><Button variant="ghost" isDisabled={reading} onPress={()=>void open(selected)} data-testid="delivery-detail-refresh">刷新整包状态</Button></div>}
    {reading&&<p role="status">正在读取逐项交付记录…</p>}{detailError&&<p role="alert">{detailError}</p>}
    {selected&&detail&&<PiDeliveryBundleCard key={detail.delivery.id} reviewInConversation sessionId={selected.sessionId} delivery={detail.delivery} running={detail.running} onRefresh={()=>open(selected)} onOpen={path=>setReveal({id:crypto.randomUUID(),path})} onResumeStarted={()=>navigation.navigate({view:'ai',sessionId:selected.sessionId})} onFollow={id=>void open({id,sessionId:selected.sessionId})}/>}
    {selected&&reveal&&<PiWorkspaceFiles key={selected.sessionId+':'+selected.id} sessionId={selected.sessionId} reveal={reveal} onClose={()=>setReveal(undefined)}/>}
    {!selected&&<LibraryEmpty title="选择一个整包任务" description="已保存文件可单独查看；部分完成、失败或中断的整包可继续未完成文件。"/>}
   </section>
  </div>
 </section>;
}
