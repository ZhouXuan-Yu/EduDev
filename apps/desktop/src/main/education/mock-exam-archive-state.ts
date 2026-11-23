import type {Sql} from '../xiaozhi-agent/session-state';
import type {TeachingFileCatalogEntry} from '../../shared/contracts';
import {officeRelativePath} from '../../shared/xiaozhi-office-artifacts';
import {parseOwnedFileStage,type OwnedFileStage} from '../xiaozhi-agent/owned-file-stage';
import {conversationOutputLocation} from '../xiaozhi-agent/conversation-output-path';
import path from 'node:path';

type ArchiveIntent={id:string;sessionId:string;catalogId:string;title:string;fileName:string;fileSize:number;sha256:string;summary:string};

function project(row:Record<string,unknown>,dataRoot:string):TeachingFileCatalogEntry&{type:'zip'}{
  const sessionId=String(row.session_id),fileName=String(row.file_name);
  if(!/^aisession_[a-f0-9-]{36}$/u.test(sessionId)||!officeRelativePath(fileName)||fileName.includes('/')||!fileName.endsWith('.zip'))throw Error('configuration');
  return {id:String(row.id),sessionId,messageId:'',title:String(row.title),type:'zip',fileName,mimeType:'application/zip',
    description:'教师确认的模考原件包',contentMd:String(row.content_md),filePath:path.join(conversationOutputLocation(dataRoot).path,sessionId,fileName),
    fileSize:Number(row.file_size),contentHash:String(row.content_hash),status:'exported',errorMessage:'',
    createdAt:String(row.created_at),updatedAt:String(row.updated_at),mockExamSource:{id:String(row.catalog_id),sessionId}};
}

export function createMockExamArchiveState(sql:Sql){
  return {
    async migrate(){
      await sql.run("CREATE TABLE IF NOT EXISTS mock_exam_archives (id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id),catalog_id TEXT NOT NULL REFERENCES mock_exam_compilations(id),title TEXT NOT NULL,file_name TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,content_md TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','exported')),stage_json TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)");
    },
    async get(id:string){
      return (await sql.all('SELECT * FROM mock_exam_archives WHERE id=?',[id]))[0];
    },
    async artifact(id:string,dataRoot:string){
      const [row]=await sql.all("SELECT * FROM mock_exam_archives WHERE id=? AND status='exported'",[id]);
      return row?project(row,dataRoot):null;
    },
    async list(dataRoot:string,sessionId?:string){
      const rows=await sql.all("SELECT * FROM mock_exam_archives WHERE status='exported'"+(sessionId?' AND session_id=?':'')+' ORDER BY updated_at DESC,id LIMIT 100',sessionId?[sessionId]:[]);
      return rows.map(row=>project(row,dataRoot));
    },
    async reserve(intent:ArchiveIntent){
      const time=new Date().toISOString();
      if(!sql.change||await sql.change("INSERT INTO mock_exam_archives(id,session_id,catalog_id,title,file_name,file_size,content_hash,content_md,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'draft',?,?) ON CONFLICT(id) DO NOTHING",
        [intent.id,intent.sessionId,intent.catalogId,intent.title,intent.fileName,intent.fileSize,intent.sha256,intent.summary,time,time])!==1)throw Error('conflict');
    },
    async stage(id:string){
      const [row]=await sql.all('SELECT stage_json FROM mock_exam_archives WHERE id=?',[id]);
      return parseOwnedFileStage(row?.stage_json);
    },
    async recordStage(id:string,stage:OwnedFileStage|null){
      await sql.run('UPDATE mock_exam_archives SET stage_json=? WHERE id=?',[stage?JSON.stringify(stage):null,id]);
    },
    async finish(id:string,work:Sql){
      if(!work.change||await work.change("UPDATE mock_exam_archives SET status='exported',updated_at=? WHERE id=? AND status='draft'",
        [new Date().toISOString(),id])!==1)throw Error('conflict');
    },
  };
}
