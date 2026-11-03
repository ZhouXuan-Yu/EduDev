import type {PaperTemplateRef, PaperTemplateVersion} from '../../shared/paper-template';
import {PAPER_TEMPLATE_SCHEMA} from '../../shared/paper-template';
import {templateHash} from './paper-template-repository';
import type {PaperSql} from './paper-sql';
import {extractTemplateSource, type TemplateMaterials} from './paper-template-source';

export async function readTemplateVersion(sql:PaperSql, ref:PaperTemplateRef, studentId:string) {
  const row=(await sql.all(`SELECT v.*,h.student_id FROM paper_template_versions v JOIN paper_template_heads h ON h.template_id=v.template_id
    WHERE v.template_id=? AND v.version=?`,[ref.templateId,ref.version]))[0];
  if(!row || row.student_id!==''&&row.student_id!==studentId) throw Error('permission_denied');
  if(row.digest!==ref.digest) throw Error('source_changed');
  const value=JSON.parse(String(row.data_json)) as PaperTemplateVersion;
  const {digest,...base}=value;
  if(value.schemaVersion!==PAPER_TEMPLATE_SCHEMA || value.studentId!==row.student_id || value.templateId!==ref.templateId
    || value.version!==ref.version || digest!==ref.digest || templateHash(base)!==digest || value.name!==row.name) throw Error('unavailable');
  return value;
}
export async function verifyTemplateVersion(sql:PaperSql,materials:TemplateMaterials,value:PaperTemplateVersion,signal:AbortSignal,trace?:(stage:string)=>void) {
  const source=await extractTemplateSource(sql,materials,value.candidate.source.resourceId,value.candidate.source.version,signal,trace);
  if(source.digest!==value.candidateDigest) throw Error('source_changed');
}
