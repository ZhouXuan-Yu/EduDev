import {Button} from '@heroui/react';
import {mockExamErrors,type MockExamCatalogChange,type MockExamEntry,type MockExamMetadata} from '../../../shared/mock-exam-compilation';
import type {MockExamSelectionIssue} from '../../../shared/mock-exam-selection';
import styles from '../../ui-system/mock-exam-catalog.module.css';

export const mockExamFieldLabels={district:'区',year:'年份',grade:'年级',subject:'学科',round:'轮次'};
export type MockExamFocus={resourceId:string;control:keyof MockExamMetadata|'include'|'permission'};

export function PiMockExamSelectionFeedback({issue,entries,edits,active,onLocate}:{
  issue:MockExamSelectionIssue;entries:MockExamEntry[];edits:MockExamCatalogChange[];active:string;
  onLocate:(target:MockExamFocus)=>void;
}) {
  let message=mockExamErrors[issue.code];
  let targets:MockExamFocus[];
  switch(issue.code){
    case 'no_selection': {
      const eligible=edits.filter(edit=>edit.permission!=='excluded');
      const target=eligible.find(edit=>edit.resourceId===active)??eligible[0];
      if(!target&&edits.length)message='已排除所有试卷。若要收录其中一份，请先核对该试卷的使用许可。';
      targets=target?[{resourceId:target.resourceId,control:'include'}]:edits.slice(0,1).map(edit=>({resourceId:edit.resourceId,control:'permission'}));
      break;
    }
    case 'incomplete': {
      const title=entries.find(entry=>entry.resourceId===issue.resourceId)?.title;
      const fields=issue.fields.map(field=>mockExamFieldLabels[field]).join('、');
      message=`《${title}》的${fields}需要核对。`;
      targets=[{resourceId:issue.resourceId,control:issue.fields[0]}];
      break;
    }
    case 'scope_changed':
      targets=[{resourceId:issue.resourceId,control:'include'}];
      break;
    case 'conflicting_versions':
      targets=issue.resourceIds.map(resourceId=>({resourceId,control:'include'}));
      break;
  }
  return <div data-testid="mock-exam-error" className={styles.validation}>
    <p role="alert">{message}</p>
    {targets.map(target=>{
      const title=entries.find(entry=>entry.resourceId===target.resourceId)?.title;
      return <Button key={target.resourceId} size="sm" variant="ghost" className={styles.locate}
        data-testid="mock-exam-locate-issue" onPress={()=>onLocate(target)}>定位 {title}</Button>;
    })}
  </div>;
}
