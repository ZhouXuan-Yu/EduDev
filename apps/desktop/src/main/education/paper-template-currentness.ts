import type {PaperSql} from './paper-sql';
import type {StoredBasket} from './paper-basket-state';
import type {TemplateMaterials} from './paper-template-source';
import {readTemplateVersion,verifyTemplateVersion} from './paper-template-read';
export async function verifyBasketTemplates(sql:PaperSql,b:StoredBasket,materials:TemplateMaterials,signal:AbortSignal) {
  for(const ref of [b.data.c2?.structureTemplate,b.data.c2?.layoutTemplate])if(ref){
    const value=await readTemplateVersion(sql,ref,b.studentId);await verifyTemplateVersion(sql,materials,value,signal);
  }
}
