import type {PaperTemplateListResult,PaperTemplateRef} from '../../shared/paper-template';
import type {PaperSql} from './paper-sql';
import type {TemplateMaterials} from './paper-template-source';
import {readTemplateVersion,verifyTemplateVersion} from './paper-template-read';

/** Fail each source independently; denied rows expose no candidate or evidence. */
export async function listTemplateVersions(sql:PaperSql,materials:TemplateMaterials,studentId:string,signal:AbortSignal):Promise<PaperTemplateListResult> {
  const rows=await sql.all(`SELECT v.template_id,v.version,v.digest FROM paper_template_versions v JOIN paper_template_heads h ON h.template_id=v.template_id
    WHERE h.student_id='' OR h.student_id=? ORDER BY v.created_at DESC,v.template_id,v.version DESC LIMIT 201`,[studentId]);
  if(rows.length>200)throw Error('too_large');
  const result:PaperTemplateListResult={versions:[],unavailable:[]};
  for(const row of rows){
    signal.throwIfAborted();
    const template:PaperTemplateRef={templateId:String(row.template_id),version:Number(row.version),digest:String(row.digest)};
    try{
      const version=await readTemplateVersion(sql,template,studentId);
      await verifyTemplateVersion(sql,materials,version,signal);
      result.versions.push(version);
    }catch(error){
      signal.throwIfAborted();
      const message=error instanceof Error?error.message:'';
      if(message==='cancelled')throw error;
      const reason=message==='permission_denied'||message==='source_changed'?message:'unavailable';
      result.unavailable.push({template,reason});
    }
  }
  signal.throwIfAborted();return result;
}
