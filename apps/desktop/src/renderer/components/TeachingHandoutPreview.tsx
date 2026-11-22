import {memo,useMemo} from 'react';
import Markdown from 'react-markdown';
import {officeMathHtml,officeMathParts} from '../../shared/office-math';
import './question-math-text.css';

export const TeachingHandoutPreview=memo(function TeachingHandoutPreview({markdown}:{markdown:string}) {
  const {body,formulas}=useMemo(()=>{
    let prefix='edu-handout-math-';
    while (markdown.includes(prefix)) prefix+='x';
    const formulas=new Map<string,string>();
    const body=officeMathParts(markdown).map(part=>{
      if(part.kind==='text')return part.raw;
      const key=prefix+formulas.size;
      formulas.set(key,part.raw);
      return '`'+key+'`';
    }).join('');
    return {body,formulas};
  },[markdown]);
  return <Markdown components={{
    code:({children})=>{
      const formula=formulas.get(String(children));
      if(!formula)return <code>{children}</code>;
      try{return <span className="question-math-text" dangerouslySetInnerHTML={{__html:officeMathHtml(formula)}}/>;}
      catch{return <span title="公式格式待核对">{formula}</span>;}
    },
    a:({children})=><span>{children}</span>,
    img:({alt})=><span>{alt}</span>,
  }}>{body}</Markdown>;
});
