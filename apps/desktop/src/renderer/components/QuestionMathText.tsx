import {containsOfficeMath,officeMathHtml,officeMathParts} from '../../shared/office-math';
import {marked} from 'marked';
import {Markdown} from '../heroui-pro/components/markdown';
import './question-math-text.css';

/** Display only: strict local MathML, escaped text, no changes to saved question facts. */
export function QuestionMathText({text,testId,className='',as:Element='div'}:{text:string;testId?:string;className?:string;as?:'div'|'h3'}){
 const classes=`question-math-text ${className}`.trim();
 // Preserve TeX before GFM parsing: bars, underscores and stars inside formulas
 // must never split table columns or become Markdown formatting.
 if(text.includes('|')&&text.includes('\n')){
  try{
   let prefix='xiaozhi-local-formula-';while(text.includes(prefix))prefix+='x';
   const formulas=new Map<string,string>();
   const body=officeMathParts(text).map(part=>{if(part.kind==='text')return part.raw;const key=prefix+formulas.size;formulas.set(key,officeMathHtml(part.raw));return '`'+key+'`';}).join('');
   if(marked.lexer(body).some(token=>token.type==='table'))return <div className={classes+' question-math-table'} data-testid={testId}>
    <Markdown components={{
     code:({children})=>{const key=String(children);return formulas.has(key)?<span dangerouslySetInnerHTML={{__html:formulas.get(key)!}}/>:<code>{children}</code>;},
     a:({children})=><span>{children}</span>,
     img:({alt})=><span role="note">[图片未在本地提供：{alt||'待核对'}]</span>
    }}>{body}</Markdown>
   </div>;
  }catch{return <Element className={classes} data-testid={testId}><small role="alert">公式未能排版，以下保留完整原文，请核对公式格式。</small><span>{text}</span></Element>;}
 }
 if(!containsOfficeMath(text))return <Element className={classes} data-testid={testId}>{text}</Element>;
 try{return <Element className={classes} data-testid={testId} dangerouslySetInnerHTML={{__html:officeMathHtml(text)}}/>;}
 catch{return <Element className={classes} data-testid={testId}><small role="alert">公式未能排版，以下保留完整原文，请核对公式格式。</small><span>{text}</span></Element>;}
}
