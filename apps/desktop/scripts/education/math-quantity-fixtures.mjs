export const r=(a,b=1)=>({numerator:String(a),denominator:String(b)});
export const q=(a,unit='1',b=1)=>({op:'quantity',value:r(a,b),unit});
export const op=(name,...args)=>({op:name,args});
export const power=(value,exponent)=>({op:'power',args:[value],exponent});
export const input=(expression,targetUnit,expected=null)=>({kind:'quantity',expression,targetUnit,expected});
export const pressure=expected=>input(op('divide',q(100,'N'),q(200,'cm^2')),'Pa',expected);
export const gravity=(gNumerator=10,gDenominator=1)=>input(op('multiply',q(6,'kg',10),q(gNumerator,'N/kg',gDenominator)),'N',gDenominator===1?r(6):r(147,25));
export const quantityCases=[
 {id:'si-prefix-frequency',input:input(q(2,'kHz'),'Hz',r(2000)),state:'matched',exact:'2000'},
 {id:'si-prefix-millimole',input:input(q(10,'mmol'),'mol',r(1,100)),state:'matched',exact:'1/100'},
 {id:'si-prefix-decameter',input:input(q(2,'dam'),'m',r(20)),state:'matched',exact:'20'},
 {id:'fx04-pressure-original-m2',input:input(op('divide',q(100,'N'),q(2,'m^2',100)),'Pa',r(5000)),state:'matched',exact:'5000'},
 {id:'fx04-pressure-original-cm2',input:pressure(r(5000)),state:'matched',exact:'5000'},
 {id:'wrong-area-scale-not-silently-matched',input:pressure(r(1,2)),state:'mismatch',exact:'5000'},
 {id:'fx04-speed',input:input(q(1,'m/s'),'km/h',r(18,5)),state:'matched',exact:'18/5'},
 {id:'area-square',input:input(q(100,'cm^2'),'m^2',r(1,100)),state:'matched',exact:'1/100'},
 {id:'volume-cube',input:input(q(1000,'cm^3'),'m^3',r(1,1000)),state:'matched',exact:'1/1000'},
 {id:'density',input:input(q(1,'g/cm^3'),'kg/m^3',r(1000)),state:'matched',exact:'1000'},
 {id:'mixed-add',input:input(op('add',q(200,'cm'),q(1,'m')),'m',r(3)),state:'matched',exact:'3'},
 {id:'mixed-subtract',input:input(op('subtract',q(2,'m'),q(50,'cm')),'cm',r(150)),state:'matched',exact:'150'},
 {id:'mass-is-not-weight',input:input(q(6,'kg',10),'N',r(6)),state:'dimension_mismatch',reason:'incompatible_target'},
 {id:'weight-with-explicit-g',input:gravity(),state:'matched',exact:'6'},
 {id:'changed-g-fresh-result',input:gravity(98,10),state:'matched',exact:'147/25'},
 {id:'fx01-buoyancy-dimensions',input:input(op('multiply',op('multiply',q(1000,'kg/m^3'),q(10,'m/s^2')),q(2,'m^3',1000)),'N',r(20)),state:'matched',exact:'20'},
 {id:'electrical-ohm-law',input:input(op('divide',q(12,'V'),q(3,'ohm')),'A',r(4)),state:'matched',exact:'4'},
 {id:'milliliter-liter',input:input(q(1000,'mL'),'L',r(1)),state:'matched',exact:'1'},
 {id:'unit-power',input:input(power(q(10,'cm'),2),'m^2',r(1,100)),state:'matched',exact:'1/100'},
 {id:'square-root-area',input:input(op('sqrt',q(25,'cm^2')),'cm',r(5)),state:'matched',exact:'5'},
 {id:'reciprocal-unit',input:input(power(q(2,'s'),-1),'Hz',r(1,2)),state:'matched',exact:'1/2'},
 {id:'calculated-without-claim',input:input(op('sqrt',q(2,'m^2')),'m'),state:'calculated',exact:'sqrt(2)'},
 {id:'dimension-error-add',input:input(op('add',q(1,'m'),q(1,'s')),'m'),state:'dimension_mismatch',reason:'incompatible_addition'},
 {id:'zero-retains-target-dimension',input:input(q(0,'kg'),'N',r(0)),state:'dimension_mismatch',reason:'incompatible_target'},
 {id:'zero-retains-add-dimension',input:input(op('add',q(0,'m'),q(0,'s')),'m',r(0)),state:'dimension_mismatch',reason:'incompatible_addition'},
 {id:'later-power-zero-does-not-hide-error',input:input(power(op('add',q(0,'m'),q(0,'s')),0),'1',r(1)),state:'dimension_mismatch',reason:'incompatible_addition'},
 {id:'division-zero',input:input(op('divide',q(2,'N'),q(0,'m^2')),'Pa'),state:'unsupported',reason:'undefined'},
 {id:'negative-square-root',input:input(op('sqrt',q(-1,'m^2')),'m'),state:'unsupported',reason:'undefined'},
 {id:'zero-negative-power',input:input(power(q(0,'s'),-1),'Hz'),state:'unsupported',reason:'undefined'},
 {id:'unsupported-affine-temperature',input:input(q(20,'degC'),'K'),state:'unsupported',reason:'unsupported_unit'},
 {id:'unsupported-symbol',input:input(q(1,'meters'),'m'),state:'unsupported',reason:'unsupported_unit'},
 {id:'unit-cancellation-dimensionless',input:input(op('divide',q(1,'km'),q(1000,'m')),'1',r(1)),state:'matched',exact:'1'},
];
