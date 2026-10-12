import fs from 'node:fs/promises';
import path from 'node:path';
import type {KnowledgeImportResult} from '../../shared/contracts';
import type {MaterialFolderProgress,MaterialFolderResult} from '../../shared/materials';
type Host={getDataRoot:()=>string;getKnowledgeOverview:()=>Promise<KnowledgeImportResult['overview']>;importKnowledgeResources:(paths:string[],signal:AbortSignal,background:boolean)=>Promise<KnowledgeImportResult>};
const supported=/\.(pdf|docx|pptx|xlsx|jpg|jpeg|png|webp|bmp|md|txt)$/i;
/** Native-selected root only; bounded async traversal feeding the existing importer/queue. */
export async function importMaterialFolder(host:Host,selected:string,signal:AbortSignal,progress:(state:MaterialFolderProgress)=>void):Promise<MaterialFolderResult>{
 const root=path.resolve(selected),managed=await fs.realpath(host.getDataRoot()),counts:MaterialFolderProgress={scanned:0,imported:0,reused:0,failed:0,skipped:0};
 const inside=(base:string,target:string)=>{const rel=path.relative(base,target);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
 const equal=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
 const rootStat=await fs.lstat(root);if(!rootStat.isDirectory()||rootStat.isSymbolicLink()||!equal(await fs.realpath(root),root)||inside(managed,root))throw new Error('invalid_input');
 const result:MaterialFolderResult={schemaVersion:'xiaozhi.material-folder.v1',status:'succeeded',resources:[],items:[],overview:await host.getKnowledgeOverview(),summary:counts};let batch:string[]=[];
 const emit=()=>progress({...counts});
 const issue=(file:string,error:string)=>{counts.failed++;if(result.items.length<50)result.items.push({sourcePath:'',fileName:path.relative(root,file),fileSize:0,ok:false,errorMessage:error});emit();};
 async function flush(){if(!batch.length||signal.aborted)return;const selectedBatch=batch;batch=[];const paths:string[]=[];
  for(const file of selectedBatch){if(signal.aborted)return;try{const stat=await fs.lstat(file),real=await fs.realpath(file);if(!stat.isFile()||stat.isSymbolicLink()||!equal(real,file)||!inside(root,real)||inside(managed,real)){counts.skipped++;continue;}paths.push(file);}catch{issue(file,'文件不存在或无法读取');}}
  if(!paths.length)return;const saved=await host.importKnowledgeResources(paths,signal,true);result.overview=saved.overview;
  for(const item of saved.items){if(item.ok){if(item.reused)counts.reused++;else counts.imported++;}else counts.failed++;}
  // Failure examples get space even for a large batch; full counts never truncate.
  result.items.push(...saved.items.filter(i=>!i.ok).slice(0,50-result.items.length));
  result.resources.push(...saved.resources.slice(0,50-result.resources.length));emit();
 }
 async function walk(dir:string,depth:number):Promise<void>{
  if(signal.aborted)return;
  if(depth>32){counts.skipped++;emit();return;}
  try{const stat=await fs.lstat(dir),real=await fs.realpath(dir);if(!stat.isDirectory()||stat.isSymbolicLink()||!equal(real,dir)||!inside(root,real)||inside(managed,real)){counts.skipped++;emit();return;}
   const entries=await fs.opendir(dir);for await(const entry of entries){if(signal.aborted)break;const file=path.join(dir,entry.name);
    if(entry.isSymbolicLink()){counts.skipped++;emit();continue;}
    if(entry.isDirectory()){await walk(file,depth+1);continue;}
    counts.scanned++;if(!entry.isFile()||!supported.test(entry.name)){counts.skipped++;emit();continue;}
    batch.push(file);if(batch.length===20)await flush();emit();
   }
  }catch(error){if(!signal.aborted)issue(dir,error instanceof Error?'无法读取这个目录':'目录读取失败');}
 }
 emit();await walk(root,0);await flush();emit();result.summary={...counts};result.status=signal.aborted?'canceled':counts.failed||counts.skipped?'partial':'succeeded';return result;
}
