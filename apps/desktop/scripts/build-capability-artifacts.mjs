import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

export async function buildNativeStatArtifact(options = {}) {
  const desktop = options.sourceRoot || path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const destination = options.destination || path.join(desktop,'src/main/xiaozhi-agent/capabilities/generated');
  const result = await build({absWorkingDir:desktop,entryPoints:['src/main/xiaozhi-agent/capabilities/native-stat-artifact-entry.ts'],bundle:true,platform:'node',target:'node22',format:'cjs',packages:'external',write:false,metafile:true,legalComments:'inline',logLevel:'silent'});
  const bytes = result.outputFiles[0].contents;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const file = 'native-stat-'+sha256+'.cjs';
  const sources = Object.keys(result.metafile.inputs).sort().map(reference => ({reference,sha256:createHash('sha256').update(fs.readFileSync(path.resolve(desktop,reference))).digest('hex')}));
  const manifest = {schemaVersion:1,file,sha256,version:'1.0.0+'+sha256.slice(0,12),sources};
  fs.mkdirSync(destination,{recursive:true});
  const target = path.join(destination,file);
  if (!fs.existsSync(target)) fs.writeFileSync(target,bytes,{flag:'wx'});
  fs.writeFileSync(path.join(destination,'native-stat-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return {manifest,path:target};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildNativeStatArtifact();
  console.log(JSON.stringify({file:result.manifest.file,sha256:result.manifest.sha256,sources:result.manifest.sources.length}));
}
