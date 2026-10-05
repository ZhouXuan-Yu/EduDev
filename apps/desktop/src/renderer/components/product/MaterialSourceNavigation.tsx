import {createContext,useContext,useState} from 'react';
import {Button} from '@heroui/react';
import {BookOpen} from 'lucide-react';
import type {XiaozhiPublicSource} from '../../../shared/xiaozhi-web';
import {validMaterialSource,type MaterialSource} from '../../../shared/materials';
import './material-source.css';

export const MaterialSourceNavigation=createContext<(source:MaterialSource)=>Promise<void>>(async()=>{throw new Error('unavailable');});
/** Only structured host sources create a local navigation control. */
export function MaterialSourceLink({source}:{source:XiaozhiPublicSource}){
 const open=useContext(MaterialSourceNavigation),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 if(!validMaterialSource(source.material))return <li>{source.title}</li>;
 return <li><Button variant="ghost" className="pi-material-source" data-testid="pi-material-source-open" isPending={busy} isDisabled={busy} onPress={async()=>{
  setBusy(true);setNotice('');try{await open(source.material!);}catch{setNotice('来源内容已变化或暂不可读取，请让小智重新查找后再打开。');}finally{setBusy(false);}
 }}><BookOpen size={16}/><span>{source.title}</span></Button>{notice&&<p role="alert" data-testid="pi-material-source-error">{notice}</p>}</li>;
}
