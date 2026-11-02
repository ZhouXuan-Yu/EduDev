import type {CheckFinding,DocumentMetrics} from '../../../shared/xiaozhi-delivery-checks';

/** Bounded integers for explicit teacher quantities and visible question identifiers. */
export function smallInteger(raw:string):number|undefined{
 const digits='零一二三四五六七八九';let value:number;
 if(/^\d{1,2}$/.test(raw))value=Number(raw);
 else if(raw==='两')value=2;
 else if(/^[一二三四五六七八九]?十[一二三四五六七八九]?$/.test(raw)){
  const [tens,units]=raw.split('十');value=(tens?digits.indexOf(tens):1)*10+(units?digits.indexOf(units):0);
 }else value=raw.length===1?digits.indexOf(raw):-1;
 return value>=1&&value<=64?value:undefined;
}

/** Count only identifiable body prompts; notes and ambiguous layouts cannot certify quantity. */
export function inspectQuestionCount(metrics:DocumentMetrics,expected:number):CheckFinding{
 const result=(state:CheckFinding['state'],message:string):CheckFinding=>({kind:'content',state,code:'question_count',checkId:'questions',message});
 if(metrics.textUnavailablePages?.length)return result('unchecked','部分页面缺少可靠文字，题项数量未检查。');
 const body=metrics.pages.map(p=>p.text).join('\n');
 const markers=metrics.pages.flatMap(page=>{
  let found=[...page.text.matchAll(/(?:^|[\n\r])\s*(?:(?:问题|题目|理解检查|检查题|思考题|练习题|题)\s*(?:第\s*)?([0-9一二两三四五六七八九十]{1,3})\s*(?:题)?|第\s*([0-9一二两三四五六七八九十]{1,3})\s*题)[：:、.．)）\s]*/gu)];
  const questionSection=/(?:理解检查|课堂练习|随堂检测|思考题|练习题|检查题|知识检测)/.test(page.text.split(/\r?\n/).slice(0,3).join('\n'));
  if(!found.length&&questionSection)found=[...page.text.matchAll(/(?:^|[\n\r])\s*(?:([0-9一二两三四五六七八九十]{1,3})[.．、)）]|([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]))\s*/gu)];
  return found.map((marker,i)=>({id:marker[2]&&'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'.includes(marker[2])?'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'.indexOf(marker[2])+1:smallInteger(marker[1]||marker[2]),text:page.text.slice(marker.index!+marker[0].length,found[i+1]?.index??page.text.length).trim()}));
 });
 if(!markers.length)return result(body.trim()?'unchecked':'failed',body.trim()?'未读取到可可靠计数的题项编号，不能仅凭标题或题目自述认定数量已齐。':'正文中没有可读取的题项。');
 const ids=new Set<number>();
 for(const {id,text} of markers){
  if(id===undefined||ids.has(id)||text.replace(/\s/g,'').length<4)return result('unchecked','题项编号重复、无法辨认或缺少实际题干，题目数量暂不能可靠核定。');
  ids.add(id);
 }
 return result(ids.size===expected?'passed':'failed',`要求${expected}道题，实际读取到${ids.size}个带编号且有正文的题项；数量检查不认证题意、答案或教学质量。`);
}
