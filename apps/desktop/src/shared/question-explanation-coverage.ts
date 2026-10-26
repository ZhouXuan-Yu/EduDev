/** Source questions may use (1)①② / (2)①②③. Check actual reviewed subquestions, not only the stem. */
function sections(text:string){
 const clean=text.replace(/```[^]*?```/g,'').replace(/~~~[^]*?~~~/g,'');
 const matches=Array.from(clean.matchAll(/(?:^|[\n；;。])\s*[（(]([1-9]|1[0-9]|20)[）)]\s*/g));
 return matches.map((m,i)=>({id:m[1],body:clean.slice(m.index!+m[0].length,matches[i+1]?.index??clean.length).trim()}));
}
function parts(text:string){
 return sections(text).flatMap(({id,body})=>{
  const children=Array.from(body.matchAll(/[①②③④⑤⑥⑦⑧⑨⑩]/g));
  return children.length?children.map((m,i)=>({id:id+'.'+('①②③④⑤⑥⑦⑧⑨⑩'.indexOf(m[0])+1),body:body.slice(m.index!+1,children[i+1]?.index??body.length).trim()})):[{id,body}];
 });
}
export function questionExplanationCoverage(requiredText:string,answer:string,analysis:string){
 const required=[...new Set(parts(requiredText).filter(p=>p.body.length>0).map(p=>p.id))];
 const missing=(text:string)=>{const actual=parts(text);return required.filter(id=>actual.filter(p=>p.id===id&&p.body.replace(/^[\s:：,，;；。]+/,'').length>0).length!==1);};
 return{required,answerMissing:missing(answer),analysisMissing:missing(analysis)};
}
