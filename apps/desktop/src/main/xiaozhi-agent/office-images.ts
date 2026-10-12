import {createHash} from 'node:crypto';
import {isRichPaperOfficeSchema,type PaperOfficeFigure} from '../../shared/paper-export';
import type {OfficeDraft} from '../../shared/xiaozhi-office-draft';
export function officeFigureSize(figure:PaperOfficeFigure){
 const width=Math.min(640,figure.width),height=width*figure.height/figure.width;
 if(height>880)throw new Error('too_large');return{width,height};
}
/** Only verified, copied PNG bytes enter a generator. No filesystem or resource URL resolution here. */
export function officeImageSnapshot(draft:OfficeDraft,input?:ReadonlyMap<string,Buffer>):Map<string,Buffer>{
 const result=new Map<string,Buffer>(),figures=draft.sections.flatMap(s=>s.figures||[]);let total=0;
 if(figures.length&&!isRichPaperOfficeSchema(draft.schemaVersion))throw new Error('invalid_input');
 for(const f of figures){
  officeFigureSize(f);const bytes=input?.get(f.assetId);if(!bytes)throw new Error('configuration');
  const value=Buffer.from(bytes);
  if(value.length<57||value.length>4*1048576||!value.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||value.readUInt32BE(16)!==f.width||value.readUInt32BE(20)!==f.height||createHash('sha256').update(value).digest('hex')!==f.sha256)throw new Error('conflict');
  if(!result.has(f.assetId)){total+=value.length;if(total>16*1048576)throw new Error('too_large');result.set(f.assetId,value);}
 }
 return result;
}
