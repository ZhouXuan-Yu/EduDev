import {useState} from 'react';
import {Button} from '@heroui/react';
import type {WorkbenchQuery} from '../../../../shared/xiaozhi-workbench';
import {useDesktopNavigation} from '../../desktop/DesktopFrame';
import {useWorkbenchSummary} from './useWorkbenchSummary';
import styles from '../../../ui-system/xiaozhi-workbench.module.css';

type Query=Extract<WorkbenchQuery,{kind:'task_artifacts'|'artifact_tasks'}>;

export function TaskArtifactRelations({query,refreshKey}: {query:Query;refreshKey?:number}) {
  const [open,setOpen]=useState(false);
  return <details data-testid={query.kind==='task_artifacts'?'task-artifact-relations':'artifact-task-relations'}
    onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>{query.kind==='task_artifacts'?'关联成果':'关联任务'}</summary>
    {open&&<RelationList query={query} refreshKey={refreshKey}/>}
  </details>;
}

function RelationList({query,refreshKey}:{query:Query;refreshKey?:number}) {
  const navigation=useDesktopNavigation(), {value,loading,error,reload}=useWorkbenchSummary(query,refreshKey);
  const relations=value?.kind==='task_artifacts'||value?.kind==='artifact_tasks'?value:undefined;
  if(loading)return <p role="status">正在读取关联记录…</p>;
  if(error)return <p role="alert">{error} <Button size="sm" variant="ghost" onPress={reload}>重试</Button></p>;
  if(!relations)return null;
  return <div className={styles.root}>
    {relations.partial&&<p role="status">部分关联的版本记录已变化或暂时不可用。</p>}
    {!relations.items.length&&!relations.partial&&<p className={styles.meta}>暂无可核对的关联记录。</p>}
    <ul className={styles.relationList}>
      {relations.kind==='task_artifacts'?relations.items.map(link=><li key={link.relation+':'+link.artifactId}>
        <span>{link.relation==='produced'?'产出':'引用'}{link.restored?' · 历史版本还原':''}</span>
        <Button size="sm" variant="ghost" data-testid="task-related-artifact" data-artifact-id={link.artifactId} isDisabled={!link.currentArtifactId}
          onPress={()=>navigation.navigate({view:'artifacts',artifactId:link.currentArtifactId!,artifactVersionId:link.version===null?undefined:link.artifactId})}>
          {link.title||'未命名成果'}{link.version===null?'':` · 第 ${link.version} 版`}
        </Button>
      </li>):relations.items.map(link=><li key={link.relation+':'+link.taskId}>
        <span>{link.relation==='produced'?'来源任务':'引用任务'}{link.restored&&link.relation==='produced'?' · 还原来源':''}</span>
        <Button size="sm" variant="ghost" data-testid="artifact-related-task" data-task-id={link.taskId}
          onPress={()=>navigation.navigate({view:'my_tasks',sessionId:link.sessionId,taskId:link.taskId})}>{link.title||'未命名任务'}</Button>
      </li>)}
    </ul>
  </div>;
}
