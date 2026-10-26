import '../office-agent/register-source.mjs';
import fs from'node:fs';import path from'node:path';import{registerHooks}from'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='electron')return{url:'data:text/javascript,export const utilityProcess={};export const app=new Proxy({},{get(){throw Error("Electron app unavailable in source-only boundary lane");}});',shortCircuit:true};return next(specifier,context);},load(url,context,next){if(url.endsWith('/xiaozhi-agent/ocr-runtime-manifest.json'))return{format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8')+';',shortCircuit:true};return next(url,context);}});
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/inline-domain-boundaries-')),report={success:false,checks:[],scope:'Existing domain boundary fixtures against source repositories; no formal UI, real OCR or model claim'};
const check=async(name,fn)=>{await fn();report.checks.push({name,pass:true});console.log('PASS '+name);};
try{
 const{learningReviewBoundaries}=await import('../education/learning-review-boundaries.mjs');await learningReviewBoundaries(check,output);
 const{questionCollectionBoundaries}=await import('../education/question-collection-boundaries.mjs');await questionCollectionBoundaries(check,output);
 const{originalQuestionBoundaries}=await import('../education/original-question-boundaries.mjs');await originalQuestionBoundaries(check,output);
 report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{fs.writeFileSync(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,output}));}
