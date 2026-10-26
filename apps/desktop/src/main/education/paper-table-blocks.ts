import {marked,type Tokens} from 'marked';
import type {OfficeTable} from '../../shared/xiaozhi-office-draft';
import {officeMathParts} from '../../shared/office-math';
export type PaperTextBlock={text:string;table?:never}|{table:OfficeTable;text?:never};
/** Existing GFM lexer, never HTML rendering; formulas cannot split a table column. */
export function paperTextBlocks(text:string):PaperTextBlock[]{
 if(!text.includes('|')||!text.includes('\n'))return [{text}];
 let prefix='XiaozhiOfficeFormula';while(text.includes(prefix))prefix+='X';
 const formulas:string[]=[];
 const prepared=officeMathParts(text).map(p=>p.kind==='text'?p.raw:prefix+(formulas.push(p.raw)-1)+'End').join('');
 const restore=(value:string)=>value.replace(new RegExp(prefix+'([0-9]+)End','g'),(_m,i)=>formulas[Number(i)]);
 // GFM accepts prose without pipes as another table row. In teaching material,
 // a following numbered question must retain its full-width paragraph layout.
 // Bound only tables the existing lexer identified, leaving code and prose alone.
 const initial=marked.lexer(prepared,{gfm:true});
 const bounded=initial.map(token=>{
  if(token.type!=='table')return token.raw;
  const lines=token.raw.split('\n');
  const end=lines.findIndex((line,index)=>index>=2&&!!line.trim()&&!/(?<!\\)\|/.test(line));
  if(end>=0)lines.splice(end,0,'');
  return lines.join('\n');
 }).join('');
 const tokens=marked.lexer(bounded,{gfm:true});
 if(!tokens.some(t=>t.type==='table'))return [{text}];
 const blocks:PaperTextBlock[]=[];let pending='';
 for(const token of tokens){
  if(token.type!=='table'){pending+=restore(token.raw);continue;}
  if(pending.trim())blocks.push({text:pending});pending='';
  const table=token as Tokens.Table;
  blocks.push({table:{columns:table.header.map(c=>restore(c.text).replace(/\\\|/g,'|')),rows:table.rows.map(row=>row.map(c=>restore(c.text).replace(/\\\|/g,'|')))}});
 }
 if(pending.trim())blocks.push({text:pending});return blocks;
}
