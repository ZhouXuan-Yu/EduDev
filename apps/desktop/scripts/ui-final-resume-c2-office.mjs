/** Inert parent integration entry. Deliberately has no Electron launch path. */
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export {copyC2OfficeBaseline,prepareCurrentC2PaperUi,runCurrentC2OfficeUi,assertCurrentC2SourceRefusalUi,c2OfficeBudget,c2OfficeContractHash,c2OfficeDeliveryManifest} from './acceptance/paper-template-office-ui.mjs';
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert(process.argv.slice(2).every(a=>a==='--check'),'Parent must import adapter after its unified frozen launch; this entry never launches');
  await import('./acceptance/paper-template-office-check.mjs');const {c2OfficeDeliveryManifest}=await import('./acceptance/paper-template-office-ui.mjs');console.log(JSON.stringify(c2OfficeDeliveryManifest()));
}
