import {PiRecoveryOverview} from '../office/workbench/PiRecoveryOverview';
import {Button} from '@heroui/react';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {useWorkbenchState} from '../../ui-system/WorkbenchState';
import styles from '../../ui-system/task-workspace.module.css';

export function TeachingTaskWorkspace({personal = false}: {personal?: boolean}) {
  const navigation = useDesktopNavigation();
  const {data} = useWorkbenchState();
  const title = personal ? '我的任务' : '教学任务';
  const {taskId,sessionId}=navigation.target;
  const taskScope=personal&&taskId&&sessionId?{taskId,sessionId}:undefined;
  return <section aria-label={title} className={styles.workspace} data-testid={personal ? 'my-tasks-workspace' : 'teaching-tasks-workspace'}>
    <h2 className={styles.title}>{title}</h2>
    {taskScope&&<Button size="sm" variant="ghost" onPress={()=>navigation.navigate({view:'my_tasks'})}>查看全部任务</Button>}
    <PiRecoveryOverview key={taskScope?.taskId||'list'} activeSessionId={data?.activeSessionId || ''} page taskScope={taskScope} initialFilter={personal?'unfinished':'overview'}
      onOpenSession={async sessionId=>navigation.navigate({view:'ai',sessionId})} />
  </section>;
}
