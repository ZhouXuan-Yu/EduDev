import {useEffect,useState} from 'react';
import {Button,Input} from '@heroui/react';
export function PaperEntryPoints({points,disabled,onSave,onDirty}:{points:number;disabled:boolean;onSave:(points:number)=>Promise<boolean>;onDirty:(dirty:boolean)=>void}){
 const [value,setValue]=useState(String(points));useEffect(()=>{setValue(String(points));onDirty(false);},[points]);
 const number=Number(value),valid=Number.isSafeInteger(number)&&number>=1&&number<=1000;
 return <form className="edu-paper-actions" data-testid="paper-entry-points-form" onSubmit={e=>{e.preventDefault();if(!disabled&&valid&&number!==points)void onSave(number);}}>
  <label>本题分值<Input data-testid="paper-entry-points" type="number" min={1} max={1000} value={value} disabled={disabled} onChange={e=>{setValue(e.target.value);onDirty(Number(e.target.value)!==points);}}/></label>
  <Button variant="secondary" type="submit" data-testid="paper-entry-points-save" isDisabled={disabled||!valid||number===points}>保存分值</Button>
  {number!==points&&<Button variant="ghost" type="button" data-testid="paper-entry-points-discard" isDisabled={disabled} onPress={()=>{setValue(String(points));onDirty(false);}}>放弃分值修改</Button>}
  <span>只修改本卷，总分相应更新。</span>
 </form>;
}
