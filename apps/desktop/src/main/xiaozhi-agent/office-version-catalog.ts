import type {DocumentArtifactExportResult} from '../../shared/contracts';
import {officeVersionFamilies,type OfficeFamilyRecord} from './office-version-family';

/** Enrich the existing bounded catalog, without merging or rewriting historical facts. */
export async function officeVersionCatalog(rows:DocumentArtifactExportResult[],read:(sessionId:string)=>Promise<OfficeFamilyRecord[]>,lookup?:(id:string)=>Promise<DocumentArtifactExportResult|null>){
 const sessions=new Map<string,ReturnType<typeof officeVersionFamilies>>();
 for(const id of new Set(rows.filter(r=>r.status==='exported'&&['pptx','docx','pdf','xlsx'].includes(r.type)).map(r=>r.sessionId)))if(id)sessions.set(id,officeVersionFamilies(await read(id)));
 const complete=[...rows],ids=new Set(rows.map(row=>row.id));
 // A publication between the bounded catalog read and metadata read must not hide a whole family.
 for(const row of rows){const family=sessions.get(row.sessionId)?.get(row.id);if(!family||ids.has(family.currentArtifactId)||!lookup)continue;
  const current=await lookup(family.currentArtifactId);if(!current||current.sessionId!==row.sessionId||current.status!=='exported')throw Error('configuration');complete.push(current);ids.add(current.id);
 }
 return complete.map(row=>{const family=sessions.get(row.sessionId)?.get(row.id);return family?{...row,officeVersion:{familyId:family.familyId,currentArtifactId:family.currentArtifactId,version:family.version}}:row;});
}
