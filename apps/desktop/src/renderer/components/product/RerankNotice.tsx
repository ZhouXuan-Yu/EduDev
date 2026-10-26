import type {RerankCoverage} from '../../../shared/reranker';
export function RerankNotice({value}:{value?:RerankCoverage}){
 if(!value||value.reason==='not_needed')return null;
 return <p role="note" data-testid="retrieval-rerank-notice">{value.available?'已用本地模型进一步比较题意。':'本地题意比较暂未完成，当前保留原检索排序。'}{value.available&&value.reason==='partial_context'?'长内容按命中片段比较，请打开完整题面核对。':value.available&&value.reason==='candidate_limit'?'本次优先比较前列内容，其余结果仍可继续查看。':''}</p>;
}
