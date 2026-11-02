export const n=(a,b=1)=>({op:'number',numerator:String(a),denominator:String(b)});
export const x={op:'variable'};
export const e=(op,...args)=>({op,args});
const input=(left,right,roots,domain='real')=>({kind:'equation',left,right,domain,roots});
const rational=e('divide',e('subtract',e('power',x,n(2)),n(1)),e('subtract',x,n(1)));
const radical=e('sqrt',e('add',x,n(2)));
export const equationCases=[
 {id:'fx04-linear',input:input(e('multiply',n(3),e('subtract',x,n(2))),e('add',e('multiply',n(2),x),n(5)),[n(11)]),state:'matched',solutions:['11']},
 {id:'fx04-original-denominator',input:input(rational,n(2),[]),state:'matched',solutions:[],restriction:'x - 1 != 0'},
 {id:'fx04-cancelled-hole',input:input(rational,n(2),[n(1)]),state:'mismatch',solutions:[],admissible:[false],satisfies:[false]},
 {id:'fx04-radical-original',input:input(radical,x,[n(2)]),state:'matched',solutions:['2'],restriction:'x + 2 >= 0'},
 {id:'fx04-squaring-extraneous',input:input(radical,x,[n(-1),n(2)]),state:'mismatch',solutions:['2'],admissible:[true,true],satisfies:[false,true]},
 {id:'missing-root',input:input(e('power',x,n(2)),n(9),[n(3)]),state:'mismatch',solutions:['-3','3']},
 {id:'exact-irrational-roots',input:input(e('power',x,n(2)),n(2),[e('multiply',n(-1),e('sqrt',n(2))),e('sqrt',n(2))]),state:'matched',solutions:['-sqrt(2)','sqrt(2)']},
 {id:'positive-domain',input:input(e('power',x,n(2)),n(9),[n(3)],'positive'),state:'matched',solutions:['3']},
 {id:'wrong-domain-root',input:input(e('power',x,n(2)),n(9),[n(-3)],'positive'),state:'mismatch',solutions:['3'],admissible:[false]},
 {id:'negative-power-domain',input:input(e('power',x,n(-1)),n(1),[n(1)]),state:'matched',solutions:['1'],restriction:'x != 0'},
 {id:'nonfinite-identity-hole',input:input(e('divide',x,x),n(1),[n(0)]),state:'unsupported',status:'non_finite',admissible:[false]},
 {id:'zero-power-retains-hole',input:input(e('power',e('divide',n(1),x),n(0)),n(1),[n(0)]),state:'unsupported',status:'non_finite',admissible:[false]},
 {id:'zero-power-retains-radical',input:input(e('power',e('sqrt',x),n(0)),n(1),[n(-1)]),state:'unsupported',status:'non_finite',admissible:[false]},
 {id:'no-real-solution',input:input(e('sqrt',x),n(-1),[]),state:'matched',solutions:[]},
 {id:'two-radicals',input:input(e('add',e('sqrt',x),e('sqrt',e('add',x,n(1)))),n(1),[n(0)]),state:'matched',solutions:['0']},
 {id:'constant-inconsistent',input:input(n(1),n(2),[]),state:'matched',solutions:[]},
 {id:'undefined-candidate',input:input(x,n(0),[e('divide',n(1),n(0))]),state:'unsupported',status:'undetermined'},
 {id:'degree-outside',input:input(e('power',x,n(8)),n(1),[n(1)]),state:'unsupported',status:'undetermined'},
];
