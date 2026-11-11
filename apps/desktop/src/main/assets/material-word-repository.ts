import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {readMaterialOriginal} from './material-original';
import type {TeacherResource} from '../../shared/contracts';
import {WORD_SCHEMA,isWordParser,validWordDocument,type WordDocument,type WordPayload,type WordQuery,type WordPage,type WordImageQuery,type WordImageView} from '../../shared/material-word';
import {WORD_QUESTION_SCHEMA,validWordQuestionQuery,type WordQuestionQuery,type WordQuestionPage} from '../../shared/material-word-question';
import {indexWordQuestions} from './word-question-source';
import {WordQuestionProofRepository} from './word-question-proof-repository';
type Value=string|number|null;type Row=Record<string,unknown>;
type Host={root:()=>string;all:(sql:string,values?:Value[])=>Promise<Row[]>;run:(sql:string,values?:Value[])=>Promise<void>;resource:(id:string)=>Promise<TeacherResource>;
 verify:(id:string,version:string,signal:AbortSignal)=>Promise<void>;stamp:(id:string,version:string)=>Promise<string>;writer:<T>(action:(target:MaterialWordRepository)=>Promise<T>,beforeCommit?:()=>void)=>Promise<T>};
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
/** Rebuildable Word representation; resource/chunk facts use the existing writer. */
export class MaterialWordRepository{
 private questionCache?:{resourceId:string;version:string;index:ReturnType<typeof indexWordQuestions>};
 readonly proofs:WordQuestionProofRepository;
 constructor(private host:Host){this.proofs=new WordQuestionProofRepository({root:host.root,all:host.all,run:host.run,
  source:async base=>{const page=await this.questions({schemaVersion:WORD_QUESTION_SCHEMA,resourceId:base.resourceId,version:base.version,ordinal:base.ordinal,offset:base.ordinal-1});if(!page?.source)throw Error('source_incomplete');return page.source;},
  verify:(base,signal)=>host.verify(base.resourceId,base.version,signal),stamp:base=>host.stamp(base.resourceId,base.version),image:(base,assetId)=>this.image({schemaVersion:WORD_SCHEMA,resourceId:base.resourceId,version:base.version,assetId}),writer:(action,beforeCommit)=>host.writer(target=>action(target.proofs),beforeCommit)
 });}
 async migrate(){await this.host.run('CREATE TABLE IF NOT EXISTS material_word_documents(resource_id TEXT PRIMARY KEY,version TEXT NOT NULL,parser TEXT NOT NULL,digest TEXT NOT NULL,document_json TEXT NOT NULL)');await this.proofs.migrate();}
 private async folder(){const folder=path.resolve(this.host.root(),'word-assets');await fs.mkdir(folder,{recursive:true});if((await fs.realpath(folder)).toLowerCase()!==folder.toLowerCase())throw Error('source_changed');return folder;}
 async prepare(payload:WordPayload,signal:AbortSignal){
  if(!validWordDocument(payload.document)||payload.images.length!==payload.document.assets.length)throw Error('parse_failed');const root=await this.folder();
  for(const asset of payload.document.assets){signal.throwIfAborted();const image=payload.images.find(i=>i.id===asset.id);if(!image||image.data.length!==asset.bytes||sha(image.data)!==asset.sha256)throw Error('parse_failed');
   const target=path.join(root,asset.sha256),temporary=path.join(root,asset.sha256+'.'+randomUUID()+'.tmp');let handle;
   try{handle=await fs.open(temporary,'wx',0o600);await handle.writeFile(image.data);await handle.sync();await handle.close();handle=undefined;signal.throwIfAborted();await fs.rename(temporary,target);}
   finally{await handle?.close();await fs.unlink(temporary).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});}
   if((await readMaterialOriginal(root,target,asset.sha256,signal,asset.bytes)).length!==asset.bytes)throw Error('source_changed');
  }return payload.document;
 }
 async commit(resourceId:string,version:string,document:WordDocument){
  if(!validWordDocument(document))throw Error('parse_failed');const text=JSON.stringify(document);if(Buffer.byteLength(text)>16*1024*1024)throw Error('too_large');
  await this.host.run('INSERT INTO material_word_documents(resource_id,version,parser,digest,document_json) VALUES(?,?,?,?,?) ON CONFLICT(resource_id) DO UPDATE SET version=excluded.version,parser=excluded.parser,digest=excluded.digest,document_json=excluded.document_json',[resourceId,version,document.parser,sha(text),text]);
 }
 async document(resourceId:string,version:string){
  const resource=await this.host.resource(resourceId);if(resource.contentHash!==version||!['ready','partial','parsed','chunked','indexed','graph_extracted'].includes(resource.parseStatus))throw Error('source_changed');
  const row=(await this.host.all('SELECT * FROM material_word_documents WHERE resource_id=?',[resourceId]))[0];if(!row)return undefined;
  if(row.version!==version||!isWordParser(row.parser)||typeof row.document_json!=='string'||Buffer.byteLength(row.document_json)>16*1024*1024||sha(row.document_json)!==row.digest)throw Error('source_changed');
  const document:unknown=JSON.parse(row.document_json);if(!validWordDocument(document)||document.parser!==row.parser)throw Error('source_changed');return document;
 }
 async page(query:WordQuery):Promise<WordPage|undefined>{
  const document=await this.document(query.resourceId,query.version);if(!document)return undefined;const after=await this.host.resource(query.resourceId);if(after.contentHash!==query.version)throw Error('source_changed');
  return {schemaVersion:WORD_SCHEMA,resourceId:query.resourceId,version:query.version,parser:document.parser,offset:query.offset,total:document.blocks.length,hasMore:query.offset+5<document.blocks.length,blocks:document.blocks.slice(query.offset,query.offset+5),assets:document.assets,warnings:document.warnings};
 }
 async questions(query:WordQuestionQuery):Promise<WordQuestionPage|undefined>{
  if(!validWordQuestionQuery(query))throw Error('invalid_input');
  const document=await this.document(query.resourceId,query.version);if(!document)return undefined;
  const digest=sha(JSON.stringify(document)),cached=this.questionCache;
  const index=cached&&cached.resourceId===query.resourceId&&cached.version===query.version&&cached.index.documentSha===digest?cached.index:indexWordQuestions(document);
  this.questionCache={resourceId:query.resourceId,version:query.version,index};
  const entries=index.summaries(query.offset),source=query.ordinal===undefined?undefined:index.read(query.ordinal);
  const after=await this.document(query.resourceId,query.version);if(!after||sha(JSON.stringify(after))!==digest)throw Error('source_changed');
  return {schemaVersion:WORD_QUESTION_SCHEMA,resourceId:query.resourceId,version:query.version,documentSha:digest,offset:query.offset,total:index.total,hasMore:query.offset+entries.length<index.total,entries,...(source?{source}:{})};
 }
 async image(query:WordImageQuery):Promise<WordImageView>{
  const document=await this.document(query.resourceId,query.version),asset=document?.assets.find(a=>a.id===query.assetId);if(!asset)throw Error('source_changed');
  const root=await this.folder(),file=path.join(root,asset.sha256),data=await readMaterialOriginal(root,file,asset.sha256,new AbortController().signal,asset.bytes);if(data.length!==asset.bytes)throw Error('source_changed');const fresh=await this.document(query.resourceId,query.version);if(!fresh||sha(JSON.stringify(fresh))!==sha(JSON.stringify(document)))throw Error('source_changed');return {asset,dataUrl:'data:'+asset.mime+';base64,'+data.toString('base64')};
 }
}
