import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import JSZip from 'jszip';
import {sha256} from './evidence.mjs';

const inside=(root,file)=>{const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);};

/** Read the committed host receipt, never reconstruct a filename from a UI draft. */
export async function readClassroomExport({runRoot,sessionId,draftId,artifactId,classroomId,classroomVersion}){
 const root=fs.realpathSync(runRoot),db=new DatabaseSync(path.join(root,'data','app.db'),{readOnly:true});
 let row;
 try{
  row=db.prepare(`SELECT d.state,d.conversation_id,d.relative_path,d.result_path,d.workspace_hash,d.output_hash,
   length(d.output_bytes) output_size,d.artifact_id,a.status,a.file_path,a.file_size,a.content_hash,
   json_extract(d.draft_json,'$.classroomSource.classroomId') classroom_id,
   json_extract(d.draft_json,'$.classroomSource.version') classroom_version
   FROM xiaozhi_pi_office_drafts d JOIN document_artifacts a ON a.id=d.artifact_id
   WHERE d.id=? AND d.conversation_id=? AND a.session_id=?`).get(draftId,sessionId,sessionId);
 }finally{db.close();}
 assert(row,'Saved export receipt missing');assert.equal(row.state,'saved');assert.equal(row.status,'exported');
 assert.equal(row.artifact_id,artifactId);assert.equal(row.classroom_id,classroomId);assert.equal(row.classroom_version,classroomVersion);
 assert.equal(row.result_path,row.file_path,'Host receipt and artifact path must agree');
 const file=row.result_path;
 assert(typeof file==='string'&&path.isAbsolute(file)&&inside(root,file),'Export must remain within this owned run');
 assert(['data','exports','XiaozhiOutputs'].some(name=>inside(path.join(root,name),file)),'Export outside owned data/output scope');
 const relative=row.relative_path;
 assert(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.split(/[\\/]/).some(part=>!part||part==='.'||part==='..'),'Invalid receipt relative path');
 const workspace=path.resolve(file,...relative.split(/[\\/]/).map(()=>'..'));
 assert.equal(path.join(workspace,relative),file);assert.equal(sha256(fs.realpathSync(workspace)),row.workspace_hash,'Saved workspace authority must match');
 let cursor=root;
 for(const part of path.relative(root,file).split(path.sep)){cursor=path.join(cursor,part);assert(!fs.lstatSync(cursor).isSymbolicLink(),'Export path must not cross links');}
 assert.equal(fs.realpathSync(file),file);
 const stat=fs.lstatSync(file);assert(stat.isFile()&&stat.nlink===1&&stat.size<=16*1024*1024,'Invalid saved export file');
 const bytes=fs.readFileSync(file),hash=sha256(bytes);assert.equal(bytes.length,row.file_size);assert.equal(bytes.length,row.output_size);assert.equal(hash,row.content_hash);assert.equal(hash,row.output_hash);
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:true}),slides=Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
 assert(slides.length>0,'Saved export must contain real PPTX slides');
 return{name:path.basename(file),path:path.relative(root,file),bytes:bytes.length,sha256:hash,zipCRC:true,slides:slides.length};
}
