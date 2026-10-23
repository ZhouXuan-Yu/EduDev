import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {WebSource} from './OfficeToolProcess';
import {MaterialSourceLink} from '../product/MaterialSourceNavigation';
import {QuestionSourceLink} from './PiQuestionSource';
import {StudentSourceLink} from '../students/StudentSourceNavigation';
export function replySources(turn?:OfficeProjectedTurn){
  const sources=turn?.items.filter(item=>item.kind==='tool'&&item.status==='completed'&&(item.resultSummary?.scope==='read'||(!item.resultSummary&&/读取|核验/.test(item.label||''))))
    .flatMap(item=>item.sources||[])||[];
  return [...new Map(sources.map(source=>[JSON.stringify(source),source])).values()];
}
export function OfficeReplySources({turn,sessionId}:{turn:OfficeProjectedTurn;sessionId:string}){
  const sources=replySources(turn);
  if(!sources.length)return <p className="office-reply-provenance" data-testid="reply-no-source">本轮没有可展示的已读资料依据；生成内容请核对后使用。</p>;
  return <details className="office-reply-sources" data-testid="reply-sources"><summary>本轮读取的资料（{sources.length}）</summary><p>读取记录不代表答案已经核验正确。</p><ul>{sources.map((source,i)=>source.question?<QuestionSourceLink key={i} source={source}/>:source.student?<StudentSourceLink key={i} source={source}/>:source.material?<MaterialSourceLink key={i} source={source}/>:source.url?<WebSource key={i} source={source} sessionId={sessionId}/>:<li key={i}>{source.title}</li>)}</ul></details>;
}
