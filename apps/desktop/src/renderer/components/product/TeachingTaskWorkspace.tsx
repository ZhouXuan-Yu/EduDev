import {PiRecoveryOverview} from '../office/workbench/PiRecoveryOverview';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {useWorkbenchState} from '../../ui-system/WorkbenchState';
import styles from '../../ui-system/task-workspace.module.css';

export function TeachingTaskWorkspace({personal = false}: {personal?: boolean}) {
  const navigation = useDesktopNavigation();
  const {data} = useWorkbenchState();
  const title = personal ? '我的任务' : '教学任务';
  return <section aria-label={title} className={styles.workspace} data-testid={personal ? 'my-tasks-workspace' : 'teaching-tasks-workspace'}>
    <h2 className={styles.title}>{title}</h2>
    <PiRecoveryOverview activeSessionId={data?.activeSessionId || ''} page initialFilter={personal?'unfinished':'overview'}
      onOpenSession={async sessionId=>navigation.navigate({view:'ai',sessionId})} />
  </section>;
}
