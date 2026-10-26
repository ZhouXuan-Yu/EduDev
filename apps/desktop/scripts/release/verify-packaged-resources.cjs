const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
/** electron-builder omits .gitkeep even in extraResources. Preserve the locked manifest exactly. */
module.exports=async function verifyPackagedResources(context){
 const desktop=path.resolve(__dirname,'../..');
 for(const [manifestFile,sourceFolder,targetFolder] of [
  ['src/main/xiaozhi-agent/ocr-runtime-manifest.json','.local-ocr/file-v3-dist/omni-edu-ocr','ocr-runtime'],
  ['src/main/education/runtime-manifest.json','.local-education/dist/omni-edu-education','education-runtime'],
  ['src/main/retrieval/runtime-manifest.json','.local-retrieval/dist/omni-edu-retrieval','retrieval-runtime'],
  ['src/main/retrieval/reranker-runtime-manifest.json','.local-reranker/dist/omni-edu-reranker','reranker-runtime'],
 ]){
  const manifest=JSON.parse(fs.readFileSync(path.join(desktop,manifestFile))),root=path.resolve(context.appOutDir,'resources',targetFolder);
  if(fs.realpathSync(root).toLowerCase()!==root.toLowerCase())throw new Error('Linked packaged runtime');
  for(const item of manifest.files){
   const file=path.resolve(root,item.path),relative=path.relative(root,file);
   if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Invalid packaged manifest path');
   if(!fs.existsSync(file)&&path.basename(file)==='.gitkeep')fs.copyFileSync(path.resolve(desktop,sourceFolder,item.path),file,fs.constants.COPYFILE_EXCL);
   const stat=fs.lstatSync(file),hash=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
   if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==item.size||hash!==item.sha256||fs.realpathSync(file).toLowerCase()!==file.toLowerCase())throw new Error('Packaged runtime integrity failed: '+item.path);
  }
  console.log(JSON.stringify({packagedRuntime:targetFolder,files:manifest.files.length,verified:true}));
 }
};
