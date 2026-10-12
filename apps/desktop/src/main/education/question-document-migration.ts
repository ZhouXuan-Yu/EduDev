/** Additive migration in the existing SQLite truth; caller owns startup sequencing/transaction. */
export async function ensureQuestionDocumentColumn(sql:{all:(query:string)=>Promise<Record<string,unknown>[]>;run:(query:string)=>Promise<unknown>}):Promise<void>{
 const columns=await sql.all('PRAGMA table_info(question_bank_items)');
 if(!columns.length)throw new Error('question_table_missing');
 const existing=columns.find(c=>c.name==='document_json');
 if(existing){if(String(existing.type).toUpperCase()!=='TEXT'||Number(existing.notnull)!==1||existing.dflt_value!=="''")throw new Error('question_document_schema_invalid');return;}
 await sql.run("ALTER TABLE question_bank_items ADD COLUMN document_json TEXT NOT NULL DEFAULT ''");
}
