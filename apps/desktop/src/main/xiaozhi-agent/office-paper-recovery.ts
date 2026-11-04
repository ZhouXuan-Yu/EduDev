import type {OmniEduStore} from '../db';
import {assertPaperOffice} from '../education/paper-export';
import {isPaperOfficeDraft} from '../../shared/xiaozhi-office-draft';
import {createOfficeArtifactState} from './office-artifact-state';
import type {createOfficeArtifactService} from './office-artifact-service';
import type {Sql} from './session-state';

/** Idle verification publishes facts on the exact source-confirmation writer. */
export function createOfficePaperRecovery(store:Pick<OmniEduStore,'papers'|'paperTemplateTransaction'>):NonNullable<Parameters<typeof createOfficeArtifactService>[0]['recoverPaperDraft']>{
 return async(id,draft,assertCurrent,action,assertAuthority)=>{
  if(!isPaperOfficeDraft(draft))throw new Error('invalid_input');assertCurrent();
  const result=await store.paperTemplateTransaction(async sql=>{
   assertCurrent();
   const source=async()=>{const paper=await store.papers.reviewInTransaction(sql,id,draft.paperSource.paperId);assertCurrent();assertPaperOffice(paper,draft);};
   await source();assertCurrent();
   // PaperSql's narrow type omits BLOBs; its native run accepts Office SQLite
   // values too. changes() is read on this exclusively owned connection.
   const officeSql:Sql={
    all:async(q,v)=>{assertCurrent();const rows=await sql.all(q,v as Parameters<typeof sql.all>[1]);assertCurrent();return rows;},
    run:async(q,v)=>{assertCurrent();const value=await sql.run(q,v as Parameters<typeof sql.run>[1]);assertCurrent();return value;},
    change:async(q,v)=>{await officeSql.run(q,v);assertCurrent();const rows=await officeSql.all('SELECT changes() AS changed');assertCurrent();return Number(rows[0].changed);}
   };
   const value=await action(createOfficeArtifactState(officeSql));assertCurrent();
   // Late source, lease or authority loss rolls back the saved trigger as well.
   await source();assertCurrent();await assertAuthority();assertCurrent();return value;
  });return result; // COMMIT succeeded: shutdown cannot revoke this durable fact.
 };
}
