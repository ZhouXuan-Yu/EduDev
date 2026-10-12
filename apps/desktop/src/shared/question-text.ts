import type {QuestionDraft} from './question-draft';

/** Preserve the approved draft; collapse only an exact complete terminal options block. */
export function questionChoiceText(q:Pick<QuestionDraft,'questionType'|'stem'|'options'>){
 if(q.questionType!=='choice'||!q.options)return{text:q.stem,conflict:false};
 const entries=['A','B','C','D'].map(k=>[k,q.options![k]] as const);
 const block=entries.map(([k,v])=>`${k}. ${v}`).join('\n');
 const tail=q.stem.match(/(?:^|\n)A[.．、)]\s*([^]*?)\nB[.．、)]\s*([^]*?)\nC[.．、)]\s*([^]*?)\nD[.．、)]\s*([^]*?)\s*$/);
 const complete=entries.every(([,v])=>typeof v==='string'&&v.trim());
 const identical=!!tail&&complete&&entries.every(([,v],i)=>tail[i+1].trim()===v.trim());
 return{text:identical?q.stem:q.stem+'\n\n'+block,conflict:!!tail&&complete&&!identical};
}
