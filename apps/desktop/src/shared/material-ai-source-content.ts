import type {AiPagePrompt,AiPageResponse} from './material-ai-page';
import {publicationPrefix,validSourceParts,type SourcePart} from './question-source-content';
import {questionNumberPrefix} from './material-ai-image';
export const SOURCE_CONTENT_ROLES='source-content-roles.v1' as const;
export const SOURCE_CONTENT_RESPONSE='xiaozhi.material-ai-page-readings.v2' as const;
export const sourceContentEnabled=(p?:AiPagePrompt)=>p?.policy==='page-fragments.v3'&&p.sourceContentPolicy===SOURCE_CONTENT_ROLES;
export const hasSourceReadings=(r:AiPageResponse):r is Extract<AiPageResponse,{readings:unknown}>=>r.schemaVersion==='xiaozhi.material-ai-page-readings.v1'||r.schemaVersion===SOURCE_CONTENT_RESPONSE;
export function sourceContentPrompt(p:AiPagePrompt|undefined,enabled:boolean):AiPagePrompt|undefined{return enabled&&p?.policy==='page-fragments.v3'&&p.sourceReadingPolicy==='crop-source-reading.v1'?{...p,sourceContentPolicy:SOURCE_CONTENT_ROLES}:p;}
/** Only a first-crop closed bibliography can be excluded from problem text.
 * Publication-looking words later in an option or diagram cannot acquire that role. */
export function contentPartRoles(parts:SourcePart[]|undefined,text:string,number:string,firstBody:boolean,figure:boolean){
 if(!parts||!validSourceParts(parts,text))return false;
 if(figure)return parts.every(p=>p.role==='figure');
 let body=false,marker=false,publication=false;
 for(const p of parts){
  if(p.role==='figure')return false;
  if(p.role==='body'){body=true;continue;}
  if(p.role==='marker'){if(!firstBody||body||marker||publication||questionNumberPrefix(p.text.trim(),number)?.[0]!==p.text.trim())return false;marker=true;continue;}
  if(!firstBody||body||publication||!publicationPrefix(p.text))return false;publication=true;
 }
 return body;
}
export function sourceContentInstruction(){return `\n[来源内容分区 ${SOURCE_CONTENT_ROLES}]
schemaVersion必须为${SOURCE_CONTENT_RESPONSE}，根字段仍为schemaVersion/outcome/questions/pageText/pageIssues/fragments/readings。每个readings.crops元素在sha256/ocrSha256/text/assessment/issues之外必须增加parts。
parts为按原文顺序的数组，元素严格role/text且text非空；把各part.text无任何分隔地拼接，必须逐字等于该crop.text，连空白也不能增删。只有原图确实没有可读文字且text为空的独立diagram可用空parts；仍保留原图和figures provided，不可变成纯文字题。role仅marker/body/figure/publication。
marker仅为首正文组开头的父题号（如1.或第1题）；body为全部题面、条件、公式、选项、表格和小问。独立diagram或独立图注组只用figure，图中全部数字/单位/方向保留。混合正文/图像组仍保留body且标疑点，不能自由忽略图像。
publication仅可在首正文组题面之前，用于闭合括号中以四位年份开头的考试/教材出处；例如「2025某省中考，★☆☆」。其他格式或无法确定的文字一律保留body，不要猜元数据。徽标、核心素养等自由文字若无独立版式证明仍保留body。题内括号、条件、小问、选项、单位、否定词绝不可标为publication，不能把任意前缀删掉。
例如原图为「1. 学习提示【2025某市中考】水的温度升高。」且“学习提示”无独立版式证明时，不能把它删掉或猜成出版元数据；parts应保留marker「1. 」和body「学习提示【2025某市中考】水的温度升高。」；stem及statement必须同样保留整个body。text与parts中的空格、换行都照原图转录，不为整齐重排。独立图的文字只放figure，不能再把整幅图概述混入正文组parts。
stem与statement只包含按原顺序连接的body原文，不含marker/publication或独立figure。publication全部原文必须保存在parts和整页pageText，不把有疑点的出处/星级宣称已核实。页眉页脚保留pageText，不能编进本题不拥有的裁图或stem。两次来源读数的题面和图义仍须完整一致；出版元数据差异保留两份原文单独待核，不能因此改变物理条件或推导结论。`;}
