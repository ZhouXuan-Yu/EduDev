import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {WebSource} from './OfficeToolProcess';
import {MaterialSourceLink} from '../product/MaterialSourceNavigation';
import {QuestionSourceLink} from './PiQuestionSource';
import {StudentSourceLink} from '../students/StudentSourceNavigation';
import {validCitationId} from '../../../shared/answer-citations';
export function replySources(turn?:OfficeProjectedTurn){
  const sources=turn?.items.filter(item=>item.kind==='tool'&&item.status==='completed'&&(item.resultSummary?.scope==='read'||(!item.resultSummary&&/读取|核验/.test(item.label||''))))
    .flatMap(item=>item.sources||[])||[];
  return [...new Map(sources.map(source=>[JSON.stringify(source),source])).values()];
}
export function OfficeReplySources({turn,sessionId}:{turn:OfficeProjectedTurn;sessionId:string}){
  const sources=replySources(turn);
  if(!sources.length)return null;
  return <details className="office-reply-sources" data-testid="reply-sources"><summary>本轮读取的资料（{sources.length}）</summary><p>读取记录不代表答案已经核验正确。</p>{sources.map((source,i)=><ul key={i} id={validCitationId(source.citationId)?source.citationId:undefined}>{source.question?<QuestionSourceLink source={source}/>:source.student?<StudentSourceLink source={source}/>:source.material?<MaterialSourceLink source={source}/>:source.url?<WebSource source={source} sessionId={sessionId}/>:<li>{source.title}</li>}</ul>)}</details>;
}
