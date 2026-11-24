import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createInterface} from 'node:readline';
import type sqlite3 from 'sqlite3';
import type {ConversationOutputsBackup, ExternalOutputsBackup} from '../../shared/contracts';
import {validAttachmentPath,validAttachmentSession} from '../../shared/xiaozhi-attachments';
import {withReadOnlyBackup} from './compatibility';

type Entry = {path: string; size: number; sha256: string};
type Row = Record<string,unknown>;
const entriesFor = (db: sqlite3.Database, statement: string) => new Promise<Row[]>((resolve,reject)=>
  db.all<Row>(statement,(error,rows)=>error?reject(error):resolve(rows)));

const safeRelative = (root: string, target: string) => {
  const rel=path.relative(root,target);
  if (!rel || path.isAbsolute(rel) || rel.split(path.sep).includes('..')) return;
  return rel.split(path.sep).join('/');
};

async function nativeHeader(file: string, signal?: AbortSignal) {
  const stream = createReadStream(file,{encoding:'utf8',signal});
  const lines = createInterface({input:stream,crlfDelay:Infinity});
  let id: string | undefined;
  try {
    for await (const line of lines) {
      signal?.throwIfAborted();
      if (!line.trim()) continue;
      const entry: unknown = JSON.parse(line);
      if (!entry || typeof entry!=='object' || !('type' in entry) || typeof entry.type!=='string') throw Error('backup_native_invalid');
      if (!id) {
        if (entry.type!=='session' || !('id' in entry) || typeof entry.id!=='string' || !entry.id) throw Error('backup_native_invalid');
        id=entry.id;
      } else if (entry.type==='session') throw Error('backup_native_invalid');
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  if (!id) throw Error('backup_native_invalid');
  return id;
}

export async function assertBackupDatabaseIntegrity(file: string) {
  await withReadOnlyBackup(file,async db=>{
    const result=await entriesFor(db,'PRAGMA integrity_check');
    if (result.length!==1 || result[0].integrity_check!=='ok') throw Error('backup_database_corrupt');
    if ((await entriesFor(db,'PRAGMA foreign_key_check')).length) throw Error('backup_foreign_keys_invalid');
  });
}

export async function verifyBackupReferences(root: string, entries: Entry[], outputs: ConversationOutputsBackup,
  external: ExternalOutputsBackup, signal?: AbortSignal) {
  const dataRoot=outputs.sourceDataRoot;
  const byName=new Map(entries.map(entry=>[entry.path,entry]));
  const groups=[
    {sourceRoot:dataRoot,prefix:''},
    {sourceRoot:outputs.sourceOutputRoot,prefix:outputs.backupPrefix+'/'},
    ...external.roots.map(group=>({sourceRoot:group.sourceRoot,prefix:external.backupPrefix+'/'+group.prefix+'/'})),
  ];
  function required(file: string, size: unknown, digest: unknown) {
    const absolute=path.isAbsolute(file)?file:path.resolve(dataRoot,file);
    const target=groups.map(group=>{
      const relative=safeRelative(group.sourceRoot,absolute);
      return relative && group.prefix+relative;
    }).find(name=>name && byName.has(name));
    const entry=target ? byName.get(target) : undefined;
    if (!entry) throw Error('backup_reference_missing');
    if (typeof size==='number' && size>0 && entry.size!==size ||
        typeof digest==='string' && /^[a-f\d]{64}$/iu.test(digest) && entry.sha256!==digest.toLowerCase()) {
      throw Error('backup_reference_changed');
    }
    return entry.path;
  }
  return withReadOnlyBackup(path.join(root,'app.db'),async db=>{
    const tables=new Set((await entriesFor(db,"SELECT name FROM sqlite_schema WHERE type='table'")).map(row=>row.name));
    let files=0, sessions=0;
    const sources=[
      ['teacher_resources',"SELECT local_path AS file,file_size AS size,content_hash AS digest FROM teacher_resources WHERE local_path<>''"],
      ['attachments',"SELECT file_path AS file,file_size AS size,content_hash AS digest FROM attachments WHERE file_path<>''"],
      ['mistake_image_analyses',"SELECT local_path AS file FROM mistake_image_analyses WHERE local_path<>''"],
      ['document_artifacts',"SELECT file_path AS file,file_size AS size,content_hash AS digest FROM document_artifacts WHERE file_path<>'' AND status IN ('exported','ready','saved')"],
      ['xiaozhi_pi_office_drafts',"SELECT result_path AS file,length(output_bytes) AS size,output_hash AS digest FROM xiaozhi_pi_office_drafts WHERE state='saved' AND result_path<>''"],
    ] as const;
    for (const [table,query] of sources) {
      if (!tables.has(table)) continue;
      for (const row of await entriesFor(db,query)) {
        signal?.throwIfAborted();
        required(String(row.file),row.size,row.digest);
        files++;
      }
    }
    if(tables.has('xiaozhi_pi_attachment_imports')){
      for(const row of await entriesFor(db,`SELECT conversation_id,relative_path,size,original_sha256
        FROM xiaozhi_pi_attachment_imports WHERE state='ready'`)){
        signal?.throwIfAborted();
        if(!validAttachmentSession(row.conversation_id)||!validAttachmentPath(row.relative_path))throw Error('backup_reference_invalid');
        required(path.join(dataRoot,'xiaozhi-pi','attachments',row.conversation_id,row.relative_path),row.size,row.original_sha256);
        files++;
      }
    }
    if (tables.has('material_ai_image_inputs')) {
      const columns=await entriesFor(db,'PRAGMA table_info(material_ai_image_inputs)');
      if(columns.some(column=>column.name==='storage_version')){
        for (const row of await entriesFor(db,"SELECT DISTINCT image_sha,image_bytes FROM material_ai_image_inputs WHERE storage_version='file.v1'")) {
          signal?.throwIfAborted();
          const sha=String(row.image_sha);
          if (!/^[a-f\d]{64}$/u.test(sha)) throw Error('backup_reference_invalid');
          required(path.join(dataRoot,'material-ai-images','v1',sha.slice(0,2),sha+'.bin'),row.image_bytes,sha);
          files++;
        }
      }
    }
    if (tables.has('xiaozhi_pi_session_bindings')) {
      const bindings=await entriesFor(db,tables.has('xiaozhi_pi_model_state')
        ? 'SELECT b.session_file,b.schema_version,m.native_session_id,m.session_file AS model_file FROM xiaozhi_pi_session_bindings b LEFT JOIN xiaozhi_pi_model_state m USING(conversation_id)'
        : 'SELECT session_file,schema_version FROM xiaozhi_pi_session_bindings');
      const nativeRoot=path.join(dataRoot,'xiaozhi-pi');
      const seen=new Set<string>();
      for (const row of bindings) {
        signal?.throwIfAborted();
        const file=path.resolve(nativeRoot,String(row.session_file));
        if (!safeRelative(nativeRoot,file) || !file.toLowerCase().endsWith('.jsonl') || seen.has(file.toLowerCase()) ||
            ![1,2,3,4,5].includes(Number(row.schema_version))) throw Error('backup_native_invalid');
        seen.add(file.toLowerCase());
        const staged=required(file,null,null);
        const nativeId=await nativeHeader(path.join(root,staged),signal);
        if (row.native_session_id!=null && (row.native_session_id!==nativeId || row.model_file!==row.session_file)) {
          throw Error('backup_native_binding_changed');
        }
        sessions++;
      }
    }
    return {schemaVersion:1 as const,files,sessions};
  });
}
