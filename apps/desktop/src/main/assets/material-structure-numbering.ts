import type {ParagraphRole,StructureLine,StructureParagraph} from '../../shared/material-document-structure';

type Role={role:ParagraphRole;marker?:StructureParagraph['marker']};
type Row={line:StructureLine;column:number};
type Prefix={number:number;text:string};
type Candidate=Prefix&{index:number;row:Row;section:boolean;previous?:Candidate;next?:Candidate;scoredNext:boolean;evidence:boolean};

const digit='[1-9１-９][0-9０-９]{0,2}';
const looseNumber=new RegExp(`^(${digit})(?:[ \\t\\u3000]+(\\S.*))?$`,'u');
const scoredStart=new RegExp(`^(${digit})[ \t\u3000]*([（(])(?:本题|本小题)[ \t]*(?:满分|共|计)[ \t]*[0-9０-９]{1,3}[ \t]*分`,'u');
export const questionSection=/^(?:(?:第[一二三四五六七八九十百\d]+[部分章]|[一二三四五六七八九十百]+[、．.]|[ⅠⅡⅢⅣⅤ]+[、．.]?)[ \t]*)?(单项选择题|多项选择题|不定项选择题|选择题|填空题|解答题|计算题|实验题|综合题|证明题|判断题|简答题|阅读理解)(?=$|[ \t（(:：])/u;
const blank=/▲|_{2,}|[（(][ \t]*[）)]/u;
const option=/^[、，。]?\s*(?:[（(][A-H][）)]|[A-H][.．、])/u;
const units=/^(?:%|％|℃|°|千米|厘米|毫米|千克|毫克|公里|分钟|小时|万元|元[，。]|岁[，。]|[kcm]?m(?:\/s)?\b|kg\b|g\b|Hz\b|V\b|N\b)/u;

function scoredPrefix(text:string){
  const match=scoredStart.exec(text);
  if(!match)return;
  let depth=1;
  for(let at=match[0].length;at<Math.min(text.length,match[0].length+96);at++){
    const char=text[at];
    if(char==='\n')return;
    if(char==='（'||char==='(')depth++;
    if((char==='）'||char===')')&&--depth===0)return {number:match[1].normalize('NFKC'),length:at+1};
  }
}

export function scoredAssessmentNumber(text:string){
  return scoredPrefix(text)?.number;
}

export function stripAssessmentNumber(stem:string,first:StructureParagraph,number:string){
  const raw=first.rawText.split('\n',1)[0].trim();
  const score=scoredPrefix(raw);
  if(score?.number===number&&stem.startsWith(raw.slice(0,score.length)))return stem.slice(score.length).trimStart();
  const prefix=looseNumber.exec(raw);
  if(prefix?.[1].normalize('NFKC')===number&&stem.startsWith(prefix[1]))return stem.slice(prefix[1].length).trimStart();
  return stem;
}

function centered(line:StructureLine){return (line.box[1]+line.box[3])/2;}

function prefix(row:Row,siblings:Row[],index:number,roles:Map<string,Role>,height:number):Prefix|undefined{
  const {line}=row,role=roles.get(line.id)!;
  if(row.column<0||role.marker||!(role.role==='body'||role.role==='heading')||line.box[1]<0.045||line.box[1]>0.925)return;
  const match=looseNumber.exec(line.text.trim());
  if(!match)return;
  const number=Number(match[1].normalize('NFKC'));
  let text=match[2];
  if(!text&&line.box[2]-line.box[0]<=Math.max(0.025,height*1.9)){
    const adjacent=siblings.slice(Math.max(0,index-3),index+5).filter(({line:other})=>
      other.box[0]>line.box[2]-0.004&&other.box[0]-line.box[2]<Math.min(0.10,height*5.5)&&
      Math.abs(centered(other)-centered(line))<=height*0.45&&roles.get(other.id)?.role==='body');
    text=adjacent.sort((a,b)=>a.line.box[0]-b.line.box[0])[0]?.line.text.trim();
  }
  if(!text||units.test(text)||option.test(text)||!/[\p{L}]/u.test(text))return;
  return {number,text};
}

function aligned(a:Candidate,b:Candidate,height:number){
  return Math.abs(a.row.line.box[0]-b.row.line.box[0])<=Math.min(0.022,Math.max(0.010,height*1.2));
}

/** Numeric prefixes without punctuation require same-column numbering and worksheet evidence.
 * A separate digit box is paired only with a nearby, same-row text box. Original text is untouched. */
export function applyAssessmentNumbers(rows:Row[],roles:Map<string,Role>,height:number,questionCue:RegExp){
  const columns=new Map<number,Row[]>();
  for(const row of rows){
    const own=columns.get(row.column);
    if(own)own.push(row);else columns.set(row.column,[row]);
  }
  const spanning=columns.get(-1)||[];
  for(const [column,local] of columns){
    if(column<0)continue;
    const ordered=spanning.length?[...local,...spanning].sort((a,b)=>a.line.box[1]-b.line.box[1]):local;
    const candidates:Candidate[]=[];
    let section:StructureLine|undefined;
    for(const [index,row] of ordered.entries()){
      const role=roles.get(row.line.id)!;
      if(role.role==='heading'&&!looseNumber.test(row.line.text.trim())){
        section=questionSection.test(row.line.text.trim())?row.line:undefined;
      }
      const parsed=prefix(row,ordered,index,roles,height);
      if(!parsed)continue;
      candidates.push({...parsed,index,row,section:!!section&&
        (row.line.box[0]>=section.box[0]-0.03&&Math.abs(row.line.box[0]-section.box[0])<0.09),
        scoredNext:false,evidence:false});
    }
    const at=new Map(candidates.map(candidate=>[candidate.index,candidate]));
    for(const [index,candidate] of candidates.entries()){
      const prior=candidates[index-1],next=candidates[index+1];
      if(prior&&prior.number+1===candidate.number&&aligned(prior,candidate,height))candidate.previous=prior;
      if(next&&candidate.number+1===next.number&&aligned(candidate,next,height))candidate.next=next;
      // An explicit scored heading also closes a run at a section boundary.
      if(!candidate.next){
        const boundary=ordered.slice(candidate.index+1,candidate.index+15).find(({line})=>roles.get(line.id)?.marker?.kind==='parent');
        candidate.scoredNext=!!boundary&&
          Number(scoredAssessmentNumber(boundary.line.text.trim()))===candidate.number+1&&
          Math.abs(boundary.line.box[0]-candidate.row.line.box[0])<=Math.min(0.022,Math.max(0.010,height*1.2));
      }
      const observed=new Set<string>();
      let body=candidate.text;
      for(let i=candidate.index+1;i<Math.min(ordered.length,candidate.index+42);i++){
        const {line}=ordered[i],role=roles.get(line.id)!,other=at.get(i);
        if((other&&aligned(candidate,other,height))||role.marker?.kind==='parent'||role.role==='heading')break;
        if(role.marker?.kind==='option')observed.add(role.marker.label);
        if(body.length<1800&&role.role==='body'&&line.box[0]>=candidate.row.line.box[0]-0.006&&
           line.box[0]-candidate.row.line.box[0]<0.11)body+=' '+line.text;
      }
      const independent=(observed.has('A')&&observed.has('B'))||blank.test(body);
      const sequence=!!(candidate.previous||candidate.next);
      candidate.evidence=independent&&(candidate.section||sequence)||
        candidate.section&&sequence&&questionCue.test(candidate.text);
    }
    for(const candidate of candidates){
      const bounded=candidate.previous?.evidence&&(candidate.next?.evidence||candidate.scoredNext);
      if(candidate.evidence||bounded){
        roles.set(candidate.row.line.id,{role:'question',marker:{kind:'parent',label:String(candidate.number)}});
      }
    }
  }
}

const mathematicalFragment=(text:string)=>text.trim().length<=42&&
  /[+\-−×÷=＝≠<>±√^]/u.test(text)&&!/[\p{Script=Han}]/u.test(text);

/** Keep vertically stacked equation fragments with the equation that opens the next question. */
export function restoreAssessmentFormulaOrder(rows:Row[],roles:Map<string,Role>,height:number){
  const uncertain=new Set<string>(),moved=new Set<string>(),insertions=new Map<string,Row[]>();
  for(let i=1;i<rows.length-2;i++){
    const parent=rows[i],upper=rows[i-1],role=roles.get(parent.line.id);
    if(parent.column<0||upper.column!==parent.column||role?.marker?.kind!=='parent'||
       !mathematicalFragment(upper.line.text)||!['body','formula'].includes(roles.get(upper.line.id)!.role))continue;
    const preceding=rows.slice(Math.max(0,i-13),i-1);
    const options=preceding.filter(row=>row.column===parent.column&&roles.get(row.line.id)?.marker?.kind==='option').slice(-4);
    if(options.map(row=>roles.get(row.line.id)!.marker!.label).join('')!=='ABCD'||
       options.some(row=>row.line.box[3]>=upper.line.box[1]-0.001))continue;
    const nearby:Row[]=[];
    for(let following=i+1;following<Math.min(rows.length,i+13);following++){
      const row=rows[following],nextRole=roles.get(row.line.id)!;
      if(row.column!==parent.column||nextRole.role==='heading'||nextRole.marker?.kind==='parent')break;
      nearby.push(row);
      if(nextRole.marker?.kind==='option'||nextRole.role==='subquestion')break;
    }
    const start=[parent,...nearby].find(({line})=>{
      const overlapY=Math.min(line.box[3],upper.line.box[3])-Math.max(line.box[1],upper.line.box[1]);
      return /[=＝≡]\s*$/u.test(line.text)&&overlapY>=Math.min(line.box[3]-line.box[1],height)*0.25&&
        Math.abs(upper.line.box[0]-line.box[2])<=Math.min(0.026,height*1.5);
    });
    if(!start)continue;
    uncertain.add(upper.line.id);
    uncertain.add(parent.line.id);
    const option=nearby.at(-1);
    const lower=nearby.find(row=>row!==start&&mathematicalFragment(row.line.text)&&
      Math.abs(row.line.box[0]-upper.line.box[0])<0.014&&row.line.box[1]>upper.line.box[1]+height*0.5&&
      row.line.box[1]<upper.line.box[1]+height*2.2);
    if(!lower||!option||roles.get(option.line.id)?.marker?.label!=='A')continue;
    insertions.set(option.line.id,[upper,lower]);
    for(const fragment of [upper,lower]){
      moved.add(fragment.line.id);
      roles.set(fragment.line.id,{role:'formula'});
    }
  }
  const ordered=rows.flatMap(row=>moved.has(row.line.id)?[]:[...(insertions.get(row.line.id)||[]),row]);
  return {rows:ordered,uncertain};
}
