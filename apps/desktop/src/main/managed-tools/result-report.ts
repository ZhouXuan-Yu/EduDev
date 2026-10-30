import {createHash} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {officeRelativePath} from '../../shared/xiaozhi-office-artifacts';
import {computationColumns,computationRecord,computationText,type ComputationCell,type ComputationColumn,type ComputationProof,type ComputationReference,type ComputationReportInput} from '../../shared/xiaozhi-computation';
import type {ComputationResult} from './worker-client';

type Row=Record<string,ComputationCell>;
type Stored={result:ComputationResult;proof:ComputationReference};
export type ComputationReportFile={fileId:string;kind:'text';path:string;content:string}|{fileId:string;kind:'office';path:string;format:'xlsx';sources:[];draft:{schemaVersion:'xiaozhi.office-draft.v1';title:string;sections:{heading:string;paragraphs:string[];table?:{columns:string[];rows:(string|number)[][]}}[]}};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
const textCell=(value:ComputationCell)=>value===null?'':String(value);
function request(value:unknown):ComputationReportInput{
 if(!computationRecord(value)||Object.keys(value).some(k=>!['resultId','title','columns','chart','outputs'].includes(k))
  ||typeof value.resultId!=='string'||!/^xicompute_[a-f0-9]{64}$/.test(value.resultId)||!computationText(value.title)||!computationColumns(value.columns)
  ||!Array.isArray(value.outputs)||!value.outputs.length||value.outputs.length>3)throw Error('invalid_input');
 const paths=new Set<string>();
 for(const item of value.outputs){if(!computationRecord(item)||Object.keys(item).sort().join(',')!=='format,path'||!['csv','html','xlsx'].includes(String(item.format))
  ||!officeRelativePath(item.path)||!item.path.toLowerCase().endsWith('.'+item.format)||paths.has(item.path.toLowerCase()))throw Error('invalid_input');paths.add(item.path.toLowerCase());}
 if(value.chart!==undefined){const chart=value.chart;if(!computationRecord(chart)||Object.keys(chart).sort().join(',')!=='category,value'
  ||!value.columns.some(c=>c.key===chart.category)||!value.columns.some(c=>c.key===chart.value&&c.type==='number'))throw Error('invalid_input');}
 return value as ComputationReportInput;
}
function table(result:unknown,columns:ComputationColumn[]){
 if(!computationRecord(result)||Object.keys(result).some(k=>!['rows','summary'].includes(k))||!Array.isArray(result.rows)||!result.rows.length||result.rows.length>200)throw Error('result_shape');
 const rows=result.rows.map(row=>{if(!computationRecord(row))throw Error('result_shape');
  const selected:Row={};for(const column of columns){const value=row[column.key];if(value===null&&column.nullable)selected[column.key]=null;
   else if(column.type==='text'&&computationText(value,120,true))selected[column.key]=value;
   else if(column.type==='number'&&typeof value==='number'&&Number.isFinite(value))selected[column.key]=value;
   else throw Error('table_type');}return selected;});
 const summary=result.summary??[];if(!Array.isArray(summary)||summary.length>8||!summary.every(s=>computationRecord(s)&&Object.keys(s).sort().join(',')==='label,value'&&computationText(s.label)&&
  (computationText(s.value,120,true)||typeof s.value==='number'&&Number.isFinite(s.value))))throw Error('result_shape');
 return{rows,summary:summary as {label:string;value:string|number}[]};
}
function csvCell(value:ComputationCell,type:'text'|'number'){
 let text=textCell(value);if(type==='text'&&(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text)))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
function chart(rows:Row[],input:ComputationReportInput){
 if(!input.chart)return '';if(rows.length>40)throw Error('table_limit');const {category,value}=input.chart;
 if(rows.some(row=>typeof row[value]!=='number'))throw Error('table_type');
 const maximum=Math.max(...rows.map(row=>Math.abs(row[value] as number)))||1,negative=rows.some(row=>(row[value] as number)<0),origin=negative?500:200,span=negative?280:560;
 const bars=rows.map((row,index)=>{const number=row[value] as number,width=Math.abs(number)/maximum*span,y=48+index*38,x=number<0?origin-width:origin;
  return `<g data-value="${escape(number)}"><text x="12" y="${y+18}">${escape(row[category])}</text><rect x="${x}" y="${y}" width="${width}" height="26" rx="3" fill="#2463b6"><title>${escape(row[category])}：${escape(number)}</title></rect><text x="${number<0?x-8:x+width+8}" y="${y+18}" text-anchor="${number<0?'end':'start'}">${escape(number)}</text></g>`;}).join('');
 const height=rows.length*38+80;return `<svg role="img" aria-label="${escape(input.title)}柱形图" viewBox="0 0 960 ${height}" xmlns="http://www.w3.org/2000/svg"><title>${escape(input.title)}柱形图</title><line x1="${origin}" x2="${origin}" y1="36" y2="${height-22}" stroke="#64748b"/>${bars}</svg>`;
}
function metadata(stored:Stored,input:ComputationReportInput){
 return [`实际本地计算：QuickJS ${stored.result.runtime}`,`结果引用：${stored.proof.resultId}`,`输入摘要：${stored.proof.inputSha256}`,`代码摘要：${stored.proof.codeSha256}`,`结果摘要：${stored.proof.resultSha256}`,
  'CSV采用UTF8、逗号与CRLF；引号内逗号、双引号及换行保留。CSV没有单元格类型，学号请按文本列导入；XLSX已保留文本类型。',
  'CSV文本的公式前缀加单引号保护；XLSX及HTML保留原文字面值。空值不替换为0。',
  ...input.columns.map(c=>`${c.label}：${c.type==='text'?'文本原值':'有限数值'}；${c.nullable?'允许空值':'不允许null'}`),
  ...(stored.proof.policy?[`输入政策：${stored.proof.policy.encoding}；分隔符${stored.proof.policy.delimiter}；小数点.；声明允许时空白为null，必填数值空白报错。`]:[])];
}
function files(stored:Stored,input:ComputationReportInput):ComputationReportFile[]{
 const {rows,summary}=table(stored.result.value,input.columns),notes=metadata(stored,input),cells=rows.map(row=>input.columns.map(c=>row[c.key]===null?'':row[c.key] as string|number));
 const diagram=chart(rows,input),summaries=summary.map(s=>`${s.label}：${s.value}`);
 const result=input.outputs.map((output,index):ComputationReportFile=>{
  const fileId='computed_'+index;
  if(output.format==='xlsx')return{fileId,kind:'office',path:output.path,format:'xlsx',sources:[],draft:{schemaVersion:'xiaozhi.office-draft.v1',title:input.title,sections:[{heading:'计算明细',paragraphs:summaries,table:{columns:input.columns.map(c=>c.label),rows:cells}},{heading:'数据与计算依据',paragraphs:notes}]}};
  if(output.format==='csv')return{fileId,kind:'text',path:output.path,content:'\uFEFF'+[input.columns.map(c=>csvCell(c.label,'text')).join(','),...rows.map(row=>input.columns.map(c=>csvCell(row[c.key],c.type)).join(','))].join('\r\n')+'\r\n'};
  const header=input.columns.map(c=>`<th scope="col">${escape(c.label)}</th>`).join(''),body=cells.map(row=>'<tr>'+row.map(cell=>`<td>${escape(cell)}</td>`).join('')+'</tr>').join('');
  return{fileId,kind:'text',path:output.path,content:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(input.title)}</title><style>body{margin:0;background:#f3f6fa;color:#172b45;font:16px/1.6 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1060px;margin:32px auto;padding:28px;background:white;border-radius:16px}h1{font-size:28px}svg{width:100%;min-width:640px;height:auto}svg text{font-size:20px;fill:#172b45}table{border-collapse:collapse;width:100%;min-width:640px}th,td{padding:10px;border:1px solid #cbd5e1;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#eaf1fa}.table,.chart{overflow-x:auto}details{margin-top:24px;font-size:14px}details p{overflow-wrap:anywhere}@media(max-width:700px){main{margin:12px;padding:16px}}@media print{body{background:white}main{margin:0;padding:0}details{display:block}}</style></head><body><main><h1>${escape(input.title)}</h1>${summaries.map(s=>`<p><strong>${escape(s)}</strong></p>`).join('')}${diagram?`<div class="chart">${diagram}</div>`:''}<div class="table"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div><details><summary>数据与计算依据</summary>${notes.map(n=>`<p>${escape(n)}</p>`).join('')}</details></main></body></html>`};
 });
 if(result.some(file=>file.kind==='text'&&Buffer.byteLength(file.content)>60000))throw Error('output_limit');return result;
}
/** Ephemeral own-run results. Durable file truth remains the original file ledger. */
export function createComputationResults(scope:{sessionId:string;runId:string}){
 const results=new Map<string,Stored>();
 return{
  capture(callId:string,result:ComputationResult,proof:ComputationProof):ComputationReference{
   const resultSha256=hash(result.value),resultId='xicompute_'+hash([scope.sessionId,scope.runId,callId,proof.inputSha256,proof.codeSha256,resultSha256,result.runtime]);
   const reference={...structuredClone(proof),resultId,resultSha256};results.set(resultId,{result:structuredClone(result),proof:reference});
   if(results.size>8)results.delete(results.keys().next().value!);return structuredClone(reference);
  },
  build(value:unknown){const input=request(value),stored=results.get(input.resultId);if(!stored)throw Error('result_unavailable');return files(stored,input);},
  clear(){results.clear();},
 };
}
export function computationReportTools(options:{results?:ReturnType<typeof createComputationResults>;current:()=>boolean;publish:(files:ComputationReportFile[],args:Parameters<ToolDefinition['execute']>)=>ReturnType<ToolDefinition['execute']>}):ToolDefinition[]{
 const column={type:'object',additionalProperties:false,required:['key','label','type'],properties:{key:{type:'string',pattern:'^[a-z][a-zA-Z0-9_]{0,47}$'},label:{type:'string',minLength:1,maxLength:120},type:{type:'string',enum:['text','number']},nullable:{type:'boolean'}}};
 return[{name:'education_create_report',label:'生成计算报告',description:'把本轮education_compute返回的resultId直接交付真实CSV/可编辑XLSX/离线HTML图表，免于模型重抄数值。计算结果必须为{rows:[按key存放文本/数值/null的对象],summary:[{label:"合计",value:240}]}；rows1至200、最多8列、单元格文本120字。columns声明key/label/type及nullable；chart可选category和值列value，静态SVG柱形图在HTML中、最多40行。outputs仅填教师要求的1至3个format(csv/html/xlsx)和新相对path。使用原审阅/整包一次确认，不增加审批。两份以上计划用saved_bundle；单份按saved_text/saved_office，最终仅报告实际回执，教师可修正草稿。结果过期须重新实际计算，不能捏造引用。',
  parameters:{type:'object',additionalProperties:false,required:['resultId','title','columns','outputs'],properties:{resultId:{type:'string',pattern:'^xicompute_[a-f0-9]{64}$'},title:{type:'string',minLength:1,maxLength:120},columns:{type:'array',minItems:1,maxItems:8,items:column},chart:{type:'object',additionalProperties:false,required:['category','value'],properties:{category:{type:'string'},value:{type:'string'}}},outputs:{type:'array',minItems:1,maxItems:3,items:{type:'object',additionalProperties:false,required:['format','path'],properties:{format:{type:'string',enum:['csv','html','xlsx']},path:{type:'string',minLength:1,maxLength:500}}}}}} as ToolDefinition['parameters'],
  execute:async(...args)=>{let generated:ComputationReportFile[];try{args[2]?.throwIfAborted();if(!options.current())throw Error('cancelled');if(!options.results)throw Error('result_unavailable');generated=options.results.build(args[1]);}
   catch(error){if(args[2]?.aborted||!options.current())throw Error('cancelled');const code=error instanceof Error?error.message:'invalid_input';return{content:[{type:'text',text:JSON.stringify({success:false,error:code,message:code==='result_unavailable'?'当前运行的计算结果引用已失效，请重新实际计算后再生成报告。':code==='table_type'?'结果中的列类型或空值不符合声明，请修正实际计算，不要把空数值默认为0。':code==='output_limit'||code==='table_limit'?'报告超过当前行数、图表或文件大小限制；未截断、未提出保存。请明确缩小报告范围或分批。':'计算报告参数或实际结果结构不正确，未提出审阅，也没有保存文件。'})}],details:{success:false},isError:true};}
   return options.publish(generated,args);},
 }];
}
