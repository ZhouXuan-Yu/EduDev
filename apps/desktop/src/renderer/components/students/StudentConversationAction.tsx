import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import {MessageSquare} from 'lucide-react';
import type {Student} from '../../../shared/contracts';
import {STUDENT_CONTEXT_SCHEMA} from '../../../shared/student-context';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
export function StudentConversationAction({student}:{student?:Student}){
 const navigation=useDesktopNavigation(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>setNotice(''),[student?.id]);
 if(!student)return null;
 return <div><Button size="sm" variant="secondary" data-testid="student-ask-xiaozhi" isPending={busy} isDisabled={busy||student.status!=='active'} onPress={async()=>{
  if(!window.omniEdu||busy)return;setBusy(true);setNotice('');
  try{const detail=await window.omniEdu.createStudentConversation({schemaVersion:STUDENT_CONTEXT_SCHEMA,studentId:student.id});navigation.navigate({view:'ai',sessionId:detail.session.id});}
  catch{setNotice('未能发起学习对话，请确认学生仍在读后重试。');}finally{setBusy(false);}
 }}><MessageSquare size={16}/>问小智</Button>{notice&&<p role="alert">{notice}</p>}</div>;
}
