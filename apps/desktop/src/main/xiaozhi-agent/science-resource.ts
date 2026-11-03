import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {applicableScienceResource,SCIENCE_RESOURCES_REVISION} from '../../shared/science-resources';
import {buoyancyDemoParameters} from '../../shared/buoyancy-demo';
import {scienceResourceParameter} from '../../shared/science-resources';
// Additive host parameter only: the frozen browser model/schema and old HTML bytes stay unchanged.
export const buoyancyDemoResourceParameters={...buoyancyDemoParameters,properties:{...buoyancyDemoParameters.properties,resourceId:scienceResourceParameter}} as const;
/** Called only for an explicit resource selection, before the original proposal hash/approval. */
export function selectedScienceResource(id:unknown,generator:'office_create_science_figure'|'buoyancyDemo'){
 const r=applicableScienceResource(id,generator);let notice:string|undefined;
 if(r.id==='anatomy-iso-kit'){
  const manifest=JSON.parse(fs.readFileSync(new URL('./vendor/anatomy/source-manifest.json',import.meta.url),'utf8'));
  // Git's Windows checkout may use CRLF; pin the same upstream UTF8 text with LF.
  const bytes=Buffer.from(fs.readFileSync(new URL('./vendor/anatomy/LICENSE',import.meta.url),'utf8').replace(/\r\n/g,'\n'));
  if(manifest.repo!==r.sourceUrl||manifest.commit!==r.version||manifest.license!=='MIT'||bytes.length!==1061||createHash('sha256').update(bytes).digest('hex')!=='87c078ab9d90a3044f359e6b563d4e6afea7aa060897cf4f21618687b3856796')throw Error('configuration');
  notice=bytes.toString('utf8');
 }
 return{schemaVersion:'xiaozhi.science-resource.v1',reviewedAt:SCIENCE_RESOURCES_REVISION,...r,...(notice?{notice}:{})};
}
export function scienceResourceMetadata(r:ReturnType<typeof selectedScienceResource>){return Buffer.from(JSON.stringify(r)).toString('base64');}
