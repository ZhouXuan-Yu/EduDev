import {CHECK_UNITS,type CheckFinding,type CheckedNumber,type DocumentMetrics,type FileCheckReport,type FileCheckRules,type NumberCheck} from '../../../shared/xiaozhi-delivery-checks';
import {scienceExpected} from '../../../shared/xiaozhi-science-check';
import {inspectQuestionCount} from './question-count';

const compact=(text:string)=>text.replace(/\s+/g,'');
const textUnavailable=(metrics:DocumentMetrics,page?:number)=>page!==undefined&&metrics.format==='docx'&&metrics.pageCount===undefined
 ||(metrics.textUnavailablePages||[]).some(index=>page===undefined||index===page);
const numberPattern=/^[\s:：=≈]*([+\-−]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+\-]?\d+)?)(.*)$/s;
function readNumber(raw:unknown){
 if(typeof raw==='number'){if(!Number.isFinite(raw))throw Error('invalid_number');return{value:raw};}
 if(typeof raw!=='string')throw Error('invalid_number');const match=numberPattern.exec(raw);if(!match)throw Error('invalid_number');
 const value=Number(match[1].replace('−','-'));if(!Number.isFinite(value))throw Error('invalid_number');
 const suffix=match[2].trim(),unit=Object.keys(CHECK_UNITS).sort((a,b)=>b.length-a.length).find(u=>suffix.startsWith(u)&&!/[A-Za-z]/.test(suffix[u.length]||''));
 if(/^[,.]\d/.test(suffix))throw Error('ambiguous_decimal');return{value,...(unit?{unit}:{})};
}
function actualNumber(rule:NumberCheck,metrics:DocumentMetrics,observations:Record<string,string[]>){
 const source=rule.source;let values:unknown[];
 if(source.kind==='selector'){
  if(!Object.hasOwn(observations,rule.id))throw Error('not_observed');values=observations[rule.id];
  if(source.aggregate!=='sum'&&values.length!==1)throw Error('ambiguous_value');
 }else if(source.kind==='label'){
  if(textUnavailable(metrics,source.page))throw Error('page_text_unavailable');
  const page=source.page?metrics.pages.find(p=>p.index===source.page):undefined,text=page?.text??(source.page?'':metrics.pages.map(p=>p.text).join('\n'));
  const at=text.indexOf(source.label);if(at<0)throw Error('missing_label');if(text.indexOf(source.label,at+source.label.length)>=0)throw Error('ambiguous_value');values=[text.slice(at+source.label.length,at+source.label.length+160)];
 }else{
  const sheet=metrics.sheets?.find(s=>s.index===(source.sheet??1));if(!sheet)throw Error('missing_sheet');
  const header=source.headerRow??1,column=typeof source.column==='number'?source.column:sheet.cells.find(c=>c.row===header&&c.value===source.column)?.column;
  if(!column)throw Error('missing_column');const end=source.endRow??Math.max(...sheet.cells.map(c=>c.row)),start=source.startRow??header+1;
  if(end-start>10000||end<start)throw Error('invalid_rows');values=[];
  for(let row=start;row<=end;row++){
   const cell=sheet.cells.find(c=>c.row===row&&c.column===column);if(cell?.formula)throw Error('formula_unverified');
   if(!cell||cell.value===''){if(source.empty==='ignore')continue;throw Error('missing_number');}values.push(cell.value);
  }
 }
 if(!values.length)throw Error('missing_number');const numbers=values.map(readNumber);let total=0;
 for(const n of numbers){
  if(n.unit&&rule.unit&&CHECK_UNITS[n.unit].dimension!==CHECK_UNITS[rule.unit].dimension)throw Error('unit_mismatch');
  const value=n.unit&&rule.unit?n.value*CHECK_UNITS[n.unit].factor/CHECK_UNITS[rule.unit].factor:n.value;total+=value;
 }
 if(!Number.isFinite(total))throw Error('invalid_number');return{value:total,...(rule.unit?{unit:rule.unit}:numbers[0].unit?{unit:numbers[0].unit}:{})};
}
export function evaluateFileRules(metrics:DocumentMetrics,rules:FileCheckRules={},observations:Record<string,string[]>={}):{checks:CheckFinding[];numbers:CheckedNumber[];facts:{id:string;value:string}[]}{
 const checks:CheckFinding[]=[{kind:'structure',state:'passed',code:'parsed',message:`实际解析完成（${metrics.engine}）${metrics.pageCount===undefined?'':`，共${metrics.pageCount}页`}。`}],numbers:CheckedNumber[]=[],facts:{id:string;value:string}[]=[];
 if(rules.pages!==undefined)checks.push(metrics.pageCount===undefined?{kind:'content',state:'unchecked',code:'page_count_unknown',checkId:'pages',message:'当前解析器不能确定实际物理页数。'}:
  {kind:'content',state:metrics.pageCount===rules.pages?'passed':'failed',code:'page_count',checkId:'pages',message:`要求${rules.pages}页，实际${metrics.pageCount}页。`});
 if(rules.notes){
  if(metrics.format!=='pptx')checks.push({kind:'content',state:'unchecked',code:'notes_format',checkId:'notes',message:'当前格式未提供逐页讲者备注读取。'});
  else for(const page of metrics.pages)checks.push({kind:'content',state:compact(page.notes).replace(/[0-9]/g,'').length>=4?'passed':'failed',code:'speaker_notes',checkId:'notes',page:page.index,message:compact(page.notes).replace(/[0-9]/g,'').length>=4?'本页有实际讲者备注。':'本页缺少有意义的讲者备注。'});
 }
 if(rules.questions!==undefined)checks.push(inspectQuestionCount(metrics,rules.questions));
 for(const kind of ['contains','excludes'] as const)for(const [index,rule] of (rules[kind]||[]).entries()){
  if(textUnavailable(metrics,rule.page)){checks.push({kind:'content',state:'unchecked',code:'page_text_unavailable',checkId:kind+':'+index,...(rule.page?{page:rule.page}:{}),message:'相应页面没有可靠文本层或尚无实际分页；未把空文字或OOXML全文当作该页内容。'});continue;}
  const pages=rule.page?metrics.pages.filter(p=>p.index===rule.page):metrics.pages,text=pages.map(p=>rule.scope==='notes'?p.notes:p.text).join('\n'),found=compact(text).includes(compact(rule.text)),pass=pages.length>0&&(kind==='contains'?found:!found);
  checks.push({kind:'content',state:pass?'passed':'failed',code:kind,checkId:kind+':'+index,...(rule.page?{page:rule.page}:{}),message:`${rule.scope==='notes'?'备注':'正文'}${kind==='contains'?'应包含':'不应出现'}“${rule.text}”：${pass?'符合':'不符合'}。`});
 }
 if(!checks.some(c=>c.kind==='content'))checks.push({kind:'content',state:'unchecked',code:'content_contract',message:'尚未提供页数、备注或内容要求，未判定要求已齐全。'});
 for(const rule of rules.numbers||[]){
  try{const reference=rule.expectedFrom?scienceExpected(rule.expectedFrom):{value:rule.expected,unit:rule.unit},normalized={...rule,unit:rule.unit||reference.unit},actual=actualNumber(normalized,metrics,observations),pass=Math.abs(actual.value-reference.value)<=(rule.tolerance??1e-9);numbers.push({id:rule.id,...actual});checks.push({kind:'numbers',state:pass?'passed':'failed',code:rule.expectedFrom?'science_recalculation':'numeric_comparison',ruleId:rule.id,checkId:'numbers:'+rule.id,message:`${rule.expectedFrom?'根据声明的立方体静力平衡条件独立计算':'按声明核对'}：期望${reference.value}${reference.unit||''}，实际${actual.value}${actual.unit||''}。`});}
  catch(error){const code=error instanceof Error?error.message:'invalid_number',unverified=['not_observed','formula_unverified','page_text_unavailable'].includes(code);checks.push({kind:'numbers',state:unverified?'unchecked':'failed',code,ruleId:rule.id,checkId:'numbers:'+rule.id,message:code==='page_text_unavailable'?'相应页面没有可靠文本层或尚无实际分页，数值未检查。':code==='formula_unverified'?'所选单元格含公式；缓存值未作为重新计算的证明。':code==='not_observed'?'当前未取得该控件的实际观察值。':'数值来源缺失、空白、歧义或单位不符合声明，未按0处理。'});}
 }
 if(!rules.numbers?.length)checks.push({kind:'numbers',state:'unchecked',code:'numeric_contract',message:'尚未提供数值或合计的核验约定。'});
 for(const fact of rules.facts||[]){
  if(fact.source.kind==='label'&&textUnavailable(metrics,fact.source.page)){checks.push({kind:'content',state:'unchecked',code:'page_text_unavailable',ruleId:fact.id,checkId:'facts:'+fact.id,message:'对照事实所属页面没有可靠文本层或实际分页，未用模型摘要替代。'});continue;}
  try{let value:string;if(fact.source.kind==='selector'){const observed=observations['fact:'+fact.id];if(!observed||observed.length!==1)throw Error('missing_fact');value=observed[0];}
   else{const source=fact.source,text=metrics.pages.filter(p=>source.page===undefined||p.index===source.page).map(p=>p.text).join('\n'),at=text.indexOf(source.label);if(at<0||text.indexOf(source.label,at+source.label.length)>=0)throw Error('missing_fact');value=text.slice(at+source.label.length).split(/\r?\n/)[0].replace(/^[\s:：]+/,'');}
   if(!value.trim()||value.length>300)throw Error('missing_fact');facts.push({id:fact.id,value:compact(value)});checks.push({kind:'content',state:'passed',code:'fact_read',ruleId:fact.id,checkId:'facts:'+fact.id,message:`已从当前文件读取对照事实${fact.id}；是否一致另列。`});
  }catch{checks.push({kind:'content',state:'failed',code:'fact_unavailable',ruleId:fact.id,checkId:'facts:'+fact.id,message:`对照事实${fact.id}缺失、过长或存在歧义，未用模型摘要替代。`});}
 }
 if(metrics.format!=='html'){
  for(const issue of metrics.geometry||[])checks.push({kind:'visual',state:'failed',code:issue.code,page:issue.page,message:'实际文件中的对象超出页面边界。'});
  checks.push({kind:'visual',state:'unchecked',code:'render_not_run',message:'尚未实际渲染此文件；结构、几何和提取文字不能证明视觉全通过。'});
  checks.push({kind:'interaction',state:metrics.externalLinks?'unchecked':'not_applicable',code:'document_interaction',message:metrics.externalLinks?'文件含外部关系；未打开链接或测试交互。':'本次非HTML文件没有约定的交互动作检查。'});
 }
 return{checks,numbers,facts};
}
export function evaluateConsistency(files:FileCheckReport[]){
 for(const file of files){
  if(files.length<2){file.checks.push({kind:'consistency',state:'not_applicable',code:'single_file',message:'当前仅检查一份文件。'});continue;}
  const shared=file.numbers.filter(n=>files.some(other=>other!==file&&other.numbers.some(v=>v.id===n.id)));
  const textFacts=(file.facts||[]).filter(n=>files.some(other=>other!==file&&other.facts?.some(v=>v.id===n.id)));
  if(!shared.length&&!textFacts.length){file.checks.push({kind:'consistency',state:'unchecked',code:'shared_facts_missing',message:'尚未取得可对照的同名事实，未判定整包一致。'});continue;}
  for(const n of textFacts)for(const other of files.filter(f=>f!==file)){const value=other.facts?.find(v=>v.id===n.id);if(!value)continue;const same=n.value===value.value;file.checks.push({kind:'consistency',state:same?'passed':'failed',code:'cross_file_fact',ruleId:n.id,message:`事实${n.id}与${other.path}${same?'一致':'不一致'}（按当前文件实际读取，非模型摘要）。`});}
  for(const n of shared)for(const other of files.filter(f=>f!==file)){
   const value=other.numbers.find(v=>v.id===n.id);if(!value)continue;
   const a=n.unit?CHECK_UNITS[n.unit]:undefined,b=value.unit?CHECK_UNITS[value.unit]:undefined,dimensions=a?.dimension===b?.dimension;
   const same=dimensions&&Math.abs(n.value*(a?.factor??1)-value.value*(b?.factor??1))<=1e-8*Math.max(1,Math.abs(n.value*(a?.factor??1)),Math.abs(value.value*(b?.factor??1)));
   file.checks.push({kind:'consistency',state:same?'passed':'failed',code:'cross_file_value',ruleId:n.id,message:`同名事实${n.id}与${other.path}：${n.value}${n.unit||''} / ${value.value}${value.unit||''}，${same?'一致':'不一致'}。`});
  }
 }
}
export function fileCheckState(checks:CheckFinding[]):FileCheckReport['state']{return checks.some(c=>c.state==='failed')?'failed':checks.some(c=>c.state==='unchecked')?'partial':'passed';}
