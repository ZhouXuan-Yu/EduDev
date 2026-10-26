import {build} from 'esbuild';
export async function buildClassroomPreview(){
const result=await build({entryPoints:['src/renderer/src/classroom-preview.tsx'],bundle:true,platform:'browser',format:'iife',minify:true,write:false,outdir:'preview',external:['echarts','shiki'],define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'dataurl','.woff':'dataurl','.ttf':'dataurl'},logLevel:'warning'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
return {script:js,css};
}
