import {n,x,e,equationCases} from './math-equation-fixtures.mjs';
const linear=equationCases[0].input,radical=equationCases[3].input,hole=equationCases[1].input;
const step=(left,right,relation='equivalent')=>({left,right,relation});
const input=(source,steps,roots=source.roots)=>({...source,kind:'solution',roots,steps});
const expanded=step(e('subtract',e('multiply',n(3),x),n(6)),e('add',e('multiply',n(2),x),n(5))),finish=step(x,n(11));
const square=relation=>step(e('add',x,n(2)),e('power',x,n(2)),relation),filter=step(x,n(2),'original_filter');
const two={kind:'equation',left:e('power',x,n(2)),right:n(1),domain:'real',roots:[n(-1),n(1)]};
export const solutionCases=[
 {id:'fx04-valid-chain',input:input(linear,[expanded,finish]),state:'matched',first:null,solutions:['11']},
 {id:'wrong-expansion-correct-last-answer',input:input(linear,[step(e('subtract',e('multiply',n(3),x),n(2)),linear.right),finish]),state:'mismatch',first:1,removed:['11'],added:['7']},
 {id:'divide-by-x-loses-zero',input:input({kind:'equation',left:e('multiply',x,e('subtract',x,n(1))),right:n(0),domain:'real',roots:[n(0),n(1)]},[step(e('subtract',x,n(1)),n(0))]),state:'mismatch',first:1,removed:['0']},
 {id:'squaring-not-equivalent',input:input(radical,[square('equivalent'),filter]),state:'mismatch',first:1,added:['-1']},
 {id:'explicit-expansion-and-original-filter',input:input(radical,[square('candidate_expansion'),filter]),state:'matched',first:null,added:['-1'],lastRemoved:['-1']},
 {id:'expansion-without-required-filter',input:input(radical,[square('candidate_expansion')]),state:'mismatch',first:null,answer:'mismatch'},
 {id:'filter-cannot-remove-original-root',input:input(two,[step(x,n(1),'original_filter')]),state:'mismatch',first:1,removed:['-1']},
 {id:'cancel-hole-keeps-original-domain',input:input(hole,[step(e('add',x,n(1)),n(2))]),state:'matched',first:null,restriction:'x - 1 != 0'},
 {id:'new-denominator-cannot-delete-original-root',input:input({kind:'equation',left:x,right:n(0),domain:'real',roots:[n(0)]},[step(e('divide',x,x),n(0))]),state:'mismatch',first:1,removed:['0']},
 {id:'positive-domain-retained',input:input(equationCases[7].input,[step(x,n(3))]),state:'matched',first:null,solutions:['3']},
 {id:'nonfinite-original-unknown',input:input(equationCases[10].input,[step(x,n(1))]),state:'unsupported',first:null,count:0},
 {id:'unsupported-middle-not-hidden-by-correct-last-step',input:input(linear,[step(e('power',x,n(8)),n(1)),finish]),state:'unsupported',first:null},
 {id:'wrong-final-claimed-answer',input:input(linear,[expanded,finish],[n(9)]),state:'mismatch',first:null,answer:'mismatch'},
 {id:'new-original-condition-recomputed',input:input({...linear,right:e('add',e('multiply',n(2),x),n(9)),roots:[n(15)]},[step(e('subtract',e('multiply',n(3),x),n(6)),e('add',e('multiply',n(2),x),n(9))),step(x,n(15))]),state:'matched',first:null,solutions:['15']},
 {id:'expansion-cannot-lose-current-candidate',input:input(two,[step(x,n(1),'candidate_expansion')]),state:'mismatch',first:1,removed:['-1']},
 {id:'nonfinite-intermediate-unknown',input:input(linear,[step(x,x),finish]),state:'unsupported',first:null},
];
