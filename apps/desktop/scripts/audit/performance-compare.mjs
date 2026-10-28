import fs from 'node:fs';
import {compareReports} from './performance-contract.mjs';
const [baseline,current]=process.argv.slice(2);
let result={ok:false};
try {
  if(!baseline||!current)throw Error('Usage: node scripts/audit/performance-compare.mjs <baseline.json> <current.json>');
  result=compareReports(JSON.parse(fs.readFileSync(baseline)),JSON.parse(fs.readFileSync(current)));
  if(!result.ok)process.exitCode=1;
}catch(error){result={ok:false,error:String(error)};process.exitCode=1;}
console.log(JSON.stringify(result,null,2));
