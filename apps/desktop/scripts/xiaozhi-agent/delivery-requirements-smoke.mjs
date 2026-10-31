import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {deliveryRequirements,validateRequirementBindings,requirementCoverage} from '../../src/main/xiaozhi-agent/checks/requirements.ts';
import {validFileCheckRules,validRequirementEvidence} from '../../src/shared/xiaozhi-delivery-checks.ts';
import {evaluateFileRules,evaluateConsistency} from '../../src/main/xiaozhi-agent/checks/evaluate.ts';
const hash=x=>createHash('sha256').update(x).digest('hex'),checks=[],check=x=>{checks.push(x);console.log('PASS '+x);};
const task={id:'xitask_'+hash('task1'),requirementsVersion:1,criteria:[{id:'teacher_request',version:1,text:'讲义包含质量守恒和课堂讨论',sourceId:'message1',sourceVersion:hash('teacher1')},{id:'second',version:1,text:'科学解释清晰',sourceId:'message1',sourceVersion:hash('teacher1')}]};
const context=deliveryRequirements(task),binding={taskId:task.id,criterionId:'teacher_request',criterionVersion:1,checks:['contains:0','contains:1']},rules={contains:[{text:'质量守恒'},{text:'课堂讨论'}],bindings:[binding]};
assert(validFileCheckRules(rules));assert(validFileCheckRules({contains:[{text:'旧规则'}]}));
for(const bad of [{...binding,taskId:'other'},{...binding,checks:['pages']},{...binding,checks:['contains:0','contains:0']},{...binding,criterionVersion:0},{...binding,checks:['contains:2']}])assert(!validFileCheckRules({...rules,bindings:[bad]}));
check('Old rules retained; real task identity, distinct references and declared-rule bounds validated');
const input={files:[{path:'讲义.txt',rules}]};validateRequirementBindings(input,context);
for(const changed of [{...context,taskId:'xitask_'+hash('task2')},{...context,criteria:[{...task.criteria[0],version:2}]},null])assert.throws(()=>validateRequirementBindings(input,changed),/changed/);
assert.notEqual(deliveryRequirements({...task,id:'xitask_'+hash('task2')}).digest,context.digest);assert.notEqual(deliveryRequirements({...task,criteria:[{...task.criteria[0],sourceVersion:hash('changed')}]}).digest,context.digest);assert.equal(deliveryRequirements({...task,revision:3,planRevision:4}).digest,context.digest);check('Same numeric version cannot rebind another task/source; transient plan revisions do not invalidate identical requirements');
for(const[body,state]of[['质量守恒','checks_failed'],['质量守恒与课堂讨论','checks_passed']]){
 const evaluation=evaluateFileRules({format:'txt',engine:'synthetic parsed text',pages:[{index:1,text:body,notes:''}]},rules),file={path:'讲义.txt',checks:evaluation.checks,numbers:[],renderedPages:[],state:'partial'},report={requirements:context,files:[file]};
 const coverage=requirementCoverage(report,input);assert.equal(coverage[0].state,state);assert.equal(coverage[1].state,'unmapped');assert(coverage.every(c=>c.semantics==='unchecked'));assert.equal(coverage[0].evidence.length,2);
}
check('Actual read text distinguishes a missing required phrase from repaired content; untouched criteria remain unmapped and semantics never self-certified');
const report={requirements:context,files:[{path:'讲义.txt',checks:[{kind:'structure',state:'failed',code:'parse_failed'}]}]};assert.equal(requirementCoverage(report,input)[0].state,'unchecked');check('A structural failure with no rule execution cannot manufacture passing requirement evidence');
const numeric={path:'a',numbers:[{id:'depth',value:6,unit:'cm'}],checks:[]},other={path:'b',numbers:[{id:'depth',value:7,unit:'cm'}],checks:[]};evaluateConsistency([numeric,other]);const c=requirementCoverage({requirements:context,files:[numeric,other]},{files:[{path:'a',rules:{bindings:[{...binding,checks:['numbers:depth']}]}}]});assert.equal(c[0].state,'checks_failed');check('Cross-file disagreement remains part of linked numeric evidence');
assert(validRequirementEvidence({}));assert(validRequirementEvidence({requirements:context,requirementCoverage:[]}));assert(!validRequirementEvidence({requirements:{...context,digest:'bad'}}));assert(!validRequirementEvidence({requirements:context,requirementCoverage:[{criterionId:'teacher_request',criterionVersion:1,state:'checks_passed',semantics:'passed',evidence:[]}]}));check('Legacy receipts stay readable and malformed requirement evidence or self-certified semantics is rejected');
console.log(JSON.stringify({ok:true,passed:checks.length,checks},null,2));
