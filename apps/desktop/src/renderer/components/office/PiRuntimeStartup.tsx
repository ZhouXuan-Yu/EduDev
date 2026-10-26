import {Button,Spinner} from '@heroui/react';
import {EduShell} from '../../ui-system/EduShell';
/** Startup exposes recovery and teacher navigation, never the retired console. */
export function PiRuntimeStartup({failed,onRetry,onLeave}:{failed:boolean;onRetry:()=>void;onLeave:()=>void}){
 return <EduShell view="ai" testId="pi-runtime-startup"><div className="edu-startup" role={failed?'alert':'status'} data-testid="pi-runtime-status">
  {!failed&&<Spinner aria-label="正在准备小智"/>}<p>{failed?'小智暂时无法启动，请重试。你的本地资料和对话已保留。':'正在准备小智…'}</p>
  {failed&&<Button onPress={onRetry} data-testid="pi-runtime-retry">重试</Button>}
  <Button variant="ghost" onPress={onLeave} data-testid="pi-runtime-leave">返回教师工作台</Button>
 </div></EduShell>;
}
