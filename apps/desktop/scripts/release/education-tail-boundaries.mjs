import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='electron')return {url:'data:text/javascript,export const utilityProcess={};',shortCircuit:true};return next(specifier,context);}});
const output=fs.mkdtempSync(path.join(tmpdir(),'omni-edu-education-tail-')),checks=[];
const report={success:false,scope:'Remaining existing domain boundary modules after the paper gates; isolated synthetic facts and injected OCR, no model requests',checks};
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
try{
 for(const [file,name] of [
  ['mistake-ocr','mistakeOcrBoundaries'],['mistake-similar','mistakeSimilarBoundaries'],
  ['mistake-similar-provider','mistakeSimilarProviderBoundaries'],['material-pdf','materialPdfBoundaries'],
  ['material-preview','materialPreviewBoundaries'],['material-layout','materialLayoutBoundaries'],
  ['original-question','originalQuestionBoundaries'],['material-queue','materialQueueBoundaries'],
 ]){const module=await import('../education/'+file+'-boundaries.mjs');await module[name](check,output);}
 report.success=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,output}));}
