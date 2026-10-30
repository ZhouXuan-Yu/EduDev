import {TABLE_INPUT_SCHEMA,computationRecord,computationColumns,type ComputationColumn,type ComputationTablePolicy} from '../../shared/xiaozhi-computation';

export class ComputationDataError extends Error{
 readonly row?:number;readonly column?:number;
 constructor(code:string,row?:number,column?:number){super(code);this.row=row;this.column=column;}
}
/** Strict bounded CSV: quoted separators, escaped quotes and quoted CR/LF are data. */
export function parseComputationCsv(text:string,delimiter= ','):string[][]{
 if(Buffer.byteLength(text)>65536||/[\u0000\ud800-\udfff]/u.test(text))throw new ComputationDataError('csv_invalid');
 const source=text.replace(/^\uFEFF/,''),rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false,ended=false;
 const cell=()=>{row.push(field);field='';closed=false;if(row.length>8)throw new ComputationDataError('csv_invalid');};
 const line=()=>{cell();rows.push(row);row=[];if(rows.length>201)throw new ComputationDataError('table_limit');};
 for(let i=0;i<source.length;i++){
  const ch=source[i];ended=false;
  if(quoted){if(ch==='"'){if(source[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
  if(ch===delimiter){cell();continue;}
  if(ch==='\r'||ch==='\n'){line();if(ch==='\r'&&source[i+1]==='\n')i++;ended=true;continue;}
  if(closed)throw new ComputationDataError('csv_invalid',rows.length+1,row.length+1);
  if(ch==='"'){if(field)throw new ComputationDataError('csv_invalid',rows.length+1,row.length+1);quoted=true;}else field+=ch;
 }
 if(quoted)throw new ComputationDataError('csv_invalid');
 if(!ended&&(source.length||field||row.length))line();
 if(!rows.length)throw new ComputationDataError('csv_invalid');return rows;
}
function typedCell(raw:string,column:ComputationColumn,row:number,index:number){
 if(raw===' '||raw===''){
  if(raw===''&&column.nullable)return null;
  if(raw===''&&column.type==='text')return '';
 }
 if(column.type==='text')return raw;
 const value=raw.trim();if(!value){if(column.nullable)return null;throw new ComputationDataError('missing_numeric',row,index);}
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)||!Number.isFinite(Number(value)))throw new ComputationDataError('table_type',row,index);
 return Number(value);
}
export function normalizeComputationInput(input:unknown):{value:unknown;policy?:ComputationTablePolicy}{
 if(!computationRecord(input)||input.schemaVersion!==TABLE_INPUT_SCHEMA)return{value:input};
 if(Object.keys(input).some(k=>!['schemaVersion','csv','columns','delimiter'].includes(k))||typeof input.csv!=='string'||!computationColumns(input.columns)
  ||input.delimiter!==undefined&&![';',','].includes(String(input.delimiter)))throw new ComputationDataError('csv_invalid');
 const delimiter=(input.delimiter||',') as ','|';',columns=input.columns.map(c=>({...c})),parsed=parseComputationCsv(input.csv,delimiter);
 if(parsed[0].length!==columns.length||parsed[0].some((v,i)=>v!==columns[i].label)||parsed.length<2)throw new ComputationDataError('csv_invalid');
 const rows=parsed.slice(1).map((row,index)=>{if(row.length!==columns.length)throw new ComputationDataError('csv_invalid',index+2);return Object.fromEntries(row.map((v,i)=>[columns[i].key,typedCell(v,columns[i],index+2,i+1)]));});
 const policy:ComputationTablePolicy={schemaVersion:TABLE_INPUT_SCHEMA,encoding:'UTF-8',delimiter,decimal:'.',empty:'explicit_nullable',text:'preserve',quotedNewlines:true,columns};
 const value={columns,rows,policy};if(Buffer.byteLength(JSON.stringify(value))>65536)throw new ComputationDataError('table_limit');return{value,policy};
}
