import {createHash} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {XiaozhiPublicSource} from '../../shared/xiaozhi-web';
import {validMaterialSource} from '../../shared/materials';
import {validQuestionContextSource} from '../../shared/question-context';
import {normalizeAnswerCitations} from '../../shared/answer-citations';

const READS=new Set(['office_read_material','education_verify_material_quote','education_read_question','office_web_fetch']);
/** Per-run registry of already-sanitized, located reads. Search/list results are not evidence. */
export function createAnswerEvidence(runId:string) {
  const prefix=createHash('sha256').update(runId).digest('hex').slice(0,16),entries=new Map<string,XiaozhiPublicSource>();
  return {
    attach(tool:string,result:Awaited<ReturnType<ToolDefinition['execute']>>) {
      if(result.isError||!READS.has(tool))return result;
      const details=result.details as {data?:{sources?:XiaozhiPublicSource[]}}|undefined;
      if(!Array.isArray(details?.data?.sources))return result;
      const added:XiaozhiPublicSource[]=[];
      const sources=details.data.sources.map(source=>{
        if(!source||typeof source.title!=='string'||source.title.length>200)return source;
        const located=tool==='education_read_question'?validQuestionContextSource(source.question)
          :tool==='office_web_fetch'?typeof source.url==='string'&&/^https?:\/\//.test(source.url)&&source.url.length<=2048
          :validMaterialSource(source.material);
        if(!located)return source;
        const key=JSON.stringify([source.title,source.material,source.question,source.url,source.observedAt]);
        let entry=entries.get(key);
        if(!entry&&entries.size<128){entry={...source,citationId:`xz-cite-${prefix}-${entries.size+1}`};entries.set(key,entry);}
        if(entry)added.push(entry);
        return entry||source;
      });
      if(!added.length)return result;
      return {...result,details:{...details,data:{...details.data,sources}},content:[...result.content,{type:'text' as const,
        text:'本轮实际读取的引用登记（只证明来源已读取，不证明结论正确）。相关结论可用以下 Markdown 链接引用；未覆盖内容须明确说明：\n'+added.map(s=>`[${s.title.replace(/[\[\]\r\n]/g,' ')}](#${s.citationId})`).join('\n')}]};
    },
    normalize:(text:string)=>normalizeAnswerCitations(text,[...entries.values()]),
    sources:()=>[...entries.values()],
  };
}
