/** Derived only from saved ledger metadata, in publication order. No new mutable pointer. */
export type OfficeFamilyRecord={artifactId:string;parentArtifactId:string|null;workspaceHash:string;draftSchema:string;path:string};
export type OfficeFamily={familyId:string;currentArtifactId:string;path:string;version:number};
export function officeVersionFamilies<T extends OfficeFamilyRecord>(rows:T[]){
 const ordinary=rows.filter(r=>['xiaozhi.office-draft.v1','xiaozhi.presentation-draft.v1'].includes(r.draftSchema));
 const byId=new Map(ordinary.map(r=>[r.artifactId,r]));if(byId.size!==ordinary.length)throw Error('configuration');
 const groups=new Map<string,T[]>(),roots=new Map<string,string>();
 for(const item of ordinary){let row=item;const seen=new Set<string>();
  while(row.parentArtifactId&&byId.has(row.parentArtifactId)){
   if(seen.has(row.artifactId))throw Error('configuration');seen.add(row.artifactId);
   const parent=byId.get(row.parentArtifactId)!;if(parent.workspaceHash!==item.workspaceHash)break;row=parent;
  }
  roots.set(item.artifactId,row.artifactId);const group=groups.get(row.artifactId)||[];group.push(item);groups.set(row.artifactId,group);
 }
 const result=new Map<string,OfficeFamily>();for(const row of ordinary){const familyId=roots.get(row.artifactId)!,group=groups.get(familyId)!,latest=group.at(-1)!;result.set(row.artifactId,{familyId,currentArtifactId:latest.artifactId,path:latest.path,version:group.length});}return result;
}
export function officePathIsCurrent(rows:OfficeFamilyRecord[],relative:string){
 const saved=rows.filter(r=>r.path===relative).at(-1);if(!saved)return true;const family=officeVersionFamilies(rows).get(saved.artifactId);return !family||family.currentArtifactId===saved.artifactId;
}
