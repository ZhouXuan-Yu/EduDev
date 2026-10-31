import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {WebSource} from './OfficeToolProcess';
import {MaterialSourceLink} from '../product/MaterialSourceNavigation';
import {QuestionSourceLink} from './PiQuestionSource';
import {StudentSourceLink} from '../students/StudentSourceNavigation';
import {validCitationId} from '../../../shared/answer-citations';
import {validLocalAnswerSource} from '../../../shared/local-answer-source';
import {LocalAnswerSourceLink} from './LocalAnswerSourceLink';
export const REPLY_SOURCE_REVEAL='edudev:reveal-reply-source';
export function replySources(turn?:OfficeProjectedTurn){
  const sources=turn?.items.filter(item=>item.kind==='tool'&&item.status==='completed'&&(item.resultSummary?.scope==='read'||(!item.resultSummary&&/读取|核验/.test(item.label||''))))
    .flatMap(item=>item.sources||[])||[];
  return [...new Map(sources.map(source=>[JSON.stringify(source),source])).values()];
}
export function OfficeReplySources({turn,sessionId}:{turn:OfficeProjectedTurn;sessionId:string}){
  const sources=replySources(turn);
  const root=useRef<HTMLDivElement>(null),[expanded,setExpanded]=useState(false);
  const [location,setLocation]=useState<{id:string}>();
  const citationIds=JSON.stringify(sources.map(source=>source.citationId).filter(validCitationId));
  useLayoutEffect(()=>{
    const node=root.current;if(!node)return;
    const reveal=(event:Event)=>{
      const id=(event as CustomEvent<unknown>).detail;
      if(!validCitationId(id)||!(JSON.parse(citationIds) as string[]).includes(id))return;
      setExpanded(true);setLocation({id});
    };
    node.addEventListener(REPLY_SOURCE_REVEAL,reveal);
    return()=>node.removeEventListener(REPLY_SOURCE_REVEAL,reveal);
  },[citationIds]);
  useLayoutEffect(()=>{
    if(!expanded||!location)return;
    const target=Array.from(root.current?.querySelectorAll<HTMLElement>('[id]')||[]).find(node=>node.id===location.id);
    target?.scrollIntoView?.({block:'nearest'});
    (target?.querySelector<HTMLElement>('button,a[href]')||target)?.focus({preventScroll:true});
  },[expanded,location]);
  if(!sources.length)return null;
  return <ChatSources ref={root} data-testid="reply-sources" isExpanded={expanded} onExpandedChange={setExpanded}>
    <ChatSources.Trigger>本轮读取的资料（{sources.length}）</ChatSources.Trigger>
    <ChatSources.Content><p>读取记录不代表答案已经核验正确。</p><ChatSources.List>
      {sources.map((source,i)=><ul key={i} tabIndex={-1} id={validCitationId(source.citationId)?source.citationId:undefined}>{source.question?<QuestionSourceLink source={source}/>:source.student?<StudentSourceLink source={source}/>:source.material?<MaterialSourceLink source={source}/>:validLocalAnswerSource(source.local)?<LocalAnswerSourceLink source={source.local} title={source.title} sessionId={sessionId}/>:source.url?<WebSource source={source} sessionId={sessionId}/>:<li>{source.title}</li>}</ul>)}
    </ChatSources.List></ChatSources.Content>
  </ChatSources>;
}
import {useLayoutEffect,useRef,useState} from 'react';
import {ChatSources} from '../../heroui-pro/components/chat-source';
