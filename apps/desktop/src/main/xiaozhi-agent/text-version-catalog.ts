import path from 'node:path';
import type {TeachingFileCatalogEntry} from '../../shared/contracts';
import type {createTextChangeState} from './text-change-state';
import {textVersionFamilies} from './text-version-family';

/** Bounded metadata projection of the original ledger, never a second artifact fact. */
export async function textVersionCatalog(state:ReturnType<typeof createTextChangeState>,sessionId?:string):Promise<TeachingFileCatalogEntry[]> {
  const seeds=await state.catalogSeeds(sessionId),rows:TeachingFileCatalogEntry[]=[],seen=new Set<string>();
  for(const id of new Set(seeds.map(row=>row.sessionId))) {
    const families=textVersionFamilies(await state.versionRecords(id));
    for(const seed of seeds.filter(row=>row.sessionId===id)) {
      const family=families.get(seed.id);if(!family?.currentId||seen.has(family.familyId))continue;
      const current=family.versions.find(row=>row.id===family.currentId);if(!current?.htmlArtifact)continue;
      seen.add(family.familyId);
      rows.push({id:current.id,sessionId:id,messageId:'',title:path.posix.basename(current.path),type:'html',fileName:current.path,
        mimeType:'text/html',description:'HTML教学文件；历史来自原修改记录',contentMd:'',filePath:'',fileSize:current.size,contentHash:current.afterSha256,
        status:'exported',errorMessage:'',createdAt:current.proposedAt,updatedAt:current.savedAt||current.verifiedAt||current.proposedAt,
        officeVersion:{familyId:family.familyId,currentArtifactId:current.id,version:family.versions.indexOf(current)+1},
        htmlVersion:{savedAt:current.savedAt,verifiedAt:current.verifiedAt}});
    }
  }
  return rows;
}
