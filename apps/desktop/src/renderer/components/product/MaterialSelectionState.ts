import type {TeacherResource} from '../../../shared/contracts';
import type {MaterialSourceView} from '../../../shared/materials';
import type {MaterialQueueView} from '../../../shared/material-parse-task';

export type MaterialSelectionSnapshot={resource:TeacherResource|undefined;source:MaterialSourceView|undefined};

/** Freeze resource and citation together: a refreshed list must not rebind a dirty draft. */
export function selectMaterialSnapshot(previous:MaterialSelectionSnapshot,next:MaterialSelectionSnapshot,dirty:boolean):MaterialSelectionSnapshot {
  return dirty?previous:next;
}

/** A successful task for another source revision is not completion evidence for this one. */
export function materialTaskForSelection(queue:MaterialQueueView|undefined,resource:TeacherResource|undefined) {
  return resource?queue?.tasks.find(task=>task.resourceId===resource.id&&task.version===resource.contentHash):undefined;
}
