/** Default is read-only preparation; --run-ui is parent-only after final freeze. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {budget,matrix,notCovered,parseArgs} from './acceptance/paper-template-contract.mjs';
import {contractHash,runTemplates} from './acceptance/paper-template-run.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const options=parseArgs(process.argv.slice(2));
if(options.run)await runTemplates(desktop,options);
else console.log(JSON.stringify({preparedOnly:true,execution:false,productAcceptance:false,budget,matrix,notCovered,contractSha256:contractHash(desktop),command:'node scripts/ui-final-paper-template.mjs --run-ui --expect-build=<full-build-fingerprint> --expect-source=<src-fingerprint> --expect-contract=<typed-selector-sha256> --from=test-results/ui-goal-paper-export-intent-mOHpzM'}));
