import type {DocumentArtifactExportResult,TeachingFileCatalogEntry} from '../../shared/contracts';
import {isPaperOfficeSchema} from '../../shared/paper-export';
import {officeHash} from '../../shared/xiaozhi-office-artifacts';
import {officeVersionFamilies,type OfficeFamilyRecord} from './office-version-family';

/** Optional projection fields keep metadata-only callers compatible. Never load saved output BLOBs here. */
type CatalogRecord=OfficeFamilyRecord&{format?:string;sha256?:string;size?:number};
/** Enrich the existing bounded catalog, without merging or rewriting historical facts. */
export async function officeVersionCatalog(rows:DocumentArtifactExportResult[],read:(sessionId:string)=>Promise<CatalogRecord[]>,lookup?:(id:string)=>Promise<DocumentArtifactExportResult|null>):Promise<TeachingFileCatalogEntry[]>{
 const sessions=new Map<string,ReturnType<typeof officeVersionFamilies>>();
 const saved=new Map<string,Map<string,CatalogRecord|null>>();
 for(const id of new Set(rows.filter(r=>r.status==='exported'&&['pptx','docx','pdf','xlsx'].includes(r.type)).map(r=>r.sessionId)))if(id){
  const records=await read(id),unique=new Map<string,CatalogRecord|null>();
  for(const record of records)unique.set(record.artifactId,unique.has(record.artifactId)?null:record);
  sessions.set(id,officeVersionFamilies(records));saved.set(id,unique);
 }
 const complete=[...rows],ids=new Set(rows.map(row=>row.id));
 // A publication between the bounded catalog read and metadata read must not hide a whole family.
 for(const row of rows){const family=sessions.get(row.sessionId)?.get(row.id);if(!family||ids.has(family.currentArtifactId)||!lookup)continue;
  const current=await lookup(family.currentArtifactId);if(!current||current.sessionId!==row.sessionId||current.status!=='exported')throw Error('configuration');complete.push(current);ids.add(current.id);
 }
 return complete.map(row=>{
  const family=sessions.get(row.sessionId)?.get(row.id),record=saved.get(row.sessionId)?.get(row.id);
  if(family)return {...row,officeVersion:{familyId:family.familyId,currentArtifactId:family.currentArtifactId,version:family.version}};
  // Classification is not read authority. The selected reader independently verifies the saved receipt and file.
  if(row.status==='exported'&&['docx','pdf'].includes(row.type)&&record&&isPaperOfficeSchema(record.draftSchema)
    &&record.path===row.fileName&&record.format===row.type&&officeHash(record.sha256)&&record.sha256===row.contentHash
    &&typeof record.size==='number'&&Number.isSafeInteger(record.size)&&record.size>0&&record.size===row.fileSize)return {...row,savedArtifactKind:'paper'};
  return row;
 });
}
