import {createContext,useContext,useState} from 'react';
import {Button} from '@heroui/react';
import {BookOpen} from 'lucide-react';
import {validStudentContextSource,type StudentContextSource,type StudentContextSourceView} from '../../../shared/student-context';
import type {XiaozhiPublicSource} from '../../../shared/xiaozhi-web';
import {recordTypeLabels} from './record-type-labels';
import {learningSourcePreview} from '../../../shared/learning-source-preview';
export const StudentSourceNavigation=createContext<(source:StudentContextSource)=>Promise<void>>(async()=>{throw new Error('unavailable');});
export function StudentSourceLink({source}:{source:XiaozhiPublicSource}){
 const open=useContext(StudentSourceNavigation),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 if(!validStudentContextSource(source.student))return <li>{source.title}</li>;
 return <li><Button variant="ghost" className="pi-material-source" data-testid="pi-student-source-open" isPending={busy} isDisabled={busy} onPress={async()=>{
  setBusy(true);setNotice('');try{await open(source.student!);}catch{setNotice('学生或记录已变化，无法打开旧引用，请让小智重新读取。');}finally{setBusy(false);}
 }}><BookOpen size={16}/><span>{source.title}</span></Button>{notice&&<p role="alert" data-testid="pi-student-source-error">{notice}</p>}</li>;
}
export function StudentEvidencePanel({view,onClose}:{view:Pick<StudentContextSourceView,'student'|'record'>;onClose:()=>void}){
 return <section className="work-panel" data-testid="student-pi-evidence"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><strong>{view.record?.title||'档案引用'} · {view.student.displayName}</strong><Button size="sm" variant="ghost" onPress={onClose}>关闭引用</Button></div><p>打开引用时已核对本地保存版本，内容只在本机显示。</p>{view.record&&<><p>{recordTypeLabels[view.record.recordType]||'学习记录'} · {view.record.subject} · {new Date(view.record.occurredAt).toLocaleString('zh-CN')}</p><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{learningSourcePreview(view.record.content)}</p>{view.record.summary&&<p>{view.record.summary}</p>}</>}</section>;
}
