/** QA contract only. No business implementation or fixture persistence. */
import assert from 'node:assert/strict';
export const budget=Object.freeze({modelTasks:0,composerSends:0,officeWrites:0,imports:2,templateSaves:6,templateApplications:3,arrangements:2,sourceRefusalAttempts:1,electronLaunches:2,automaticRetries:0});
export const matrix=Object.freeze([
  ['source','Real TXT/DOCX import, independent source bytes, exact readonly evidence and teacher decisions'],
  ['versions','Structure and layout each v1/v2/copy; old immutable rows, derivedFrom and no basket mutation'],
  ['structure','Explicit templateSectionId to existing/new; preserve every entry/instance/review/source/point'],
  ['layout','Independent layout leaves structure, members and points unchanged'],
  ['both','One receipt and one revision for both exact references; no double commit'],
  ['retained','All retained definitions including empty; complete organizer/teacher preview members'],
  ['arrange','Explicit release of one empty retained section and adoption of one target point value; unrelated facts preserved'],
  ['cancel','Dirty candidate cancel/keep/discard has no template or basket writes'],
  ['cold','Two launches; exact committed versions, basket domain, members and points restored'],
  ['source_changed','LAST: controlled OWN TXT byte fault; apply refuses, healthy DOCX versions survive with ref/reason-only unavailable TXT entries; exact bytes restored'],
]);
export const notCovered=Object.freeze([
  'Deterministic in-flight cancellation, response-loss same-request retry and stale head/revision CAS need real competing UI windows; not manufactured by API writes or mocked replies.',
  'Cross-owner/privacy rejection stays in C2a/host gates; this runner does not claim its C2b UI coverage.',
  'Explicit member movement, unknown historical sections and hybrid quotas require separate UI-created cases; not silently counted as covered.',
  'Office output, snapshot confirmation, teacher quality and full A28/product acceptance are not accepted here.',
]);
export function parseArgs(argv){
  assert(argv.every(a=>a==='--check'||a==='--run-ui'||a.startsWith('--expect-build=')||a.startsWith('--expect-source=')||a.startsWith('--expect-contract=')||a.startsWith('--from=')),'Unknown template QA flag');
  assert.equal(new Set(argv.map(a=>a.split('=')[0])).size,argv.length,'Duplicate template QA flag');
  const run=argv.includes('--run-ui');assert(!(run&&argv.includes('--check')));
  const get=k=>argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
  const result={run,build:get('expect-build'),source:get('expect-source'),contract:get('expect-contract'),from:get('from')};
  if(run){for(const k of ['build','source','contract'])assert.match(result[k]||'',/^[a-f0-9]{64}$/,'Frozen '+k+' SHA256 required');assert.equal(result.from,'test-results/ui-goal-paper-export-intent-mOHpzM','Use the authorized original baseline');}
  else assert(Object.values(result).slice(1).every(v=>v===undefined),'Pins belong to --run-ui');
  return result;
}
