export const baseBuoyancy={cubeSide:{value:'10',unit:'cm'},blockDensity:{value:'600',unit:'kg/m^3'},liquidDensity:{value:'1000',unit:'kg/m^3'},gravity:{value:'10',unit:'N/kg'},downwardLoad:{value:'0',unit:'N'},placement:'free',conditions:{uniformLiquid:true,rigidCube:true,largeDeepContainer:true,negligibleLoadVolume:true,negligibleAirBuoyancy:true,noOtherForces:true}};
export const buoyancyCase=(changes={})=>({...structuredClone(baseBuoyancy),...changes});
export const buoyancyCases=[
 {id:'fx01-default',input:buoyancyCase(),regime:'floating',values:{volume:'1/1000',area:'1/100',mass:'3/5',weight:'6',buoyancy:'6',displacedVolume:'3/5000',immersedHeight:'3/50',emergedHeight:'1/25',netDownwardForce:'0'}},
 {id:'fx01-load4-neutral',input:buoyancyCase({downwardLoad:{value:'4',unit:'N'}}),regime:'neutral',values:{totalDownwardForce:'10',buoyancy:'10',immersedHeight:'1/10',emergedHeight:'0',netDownwardForce:'0'}},
 {id:'fx01-load5-free',input:buoyancyCase({downwardLoad:{value:'5',unit:'N'}}),regime:'overloaded',values:{totalDownwardForce:'11',buoyancy:'10',downwardMinusBuoyancy:'1',netDownwardForce:'1',supportForce:'0'}},
 {id:'fx01-load5-bottom',input:buoyancyCase({downwardLoad:{value:'5',unit:'N'},placement:'bottom'}),regime:'overloaded',values:{totalDownwardForce:'11',buoyancy:'10',downwardMinusBuoyancy:'1',netDownwardForce:'0',supportForce:'1'}},
 {id:'fx01-liquid800',input:buoyancyCase({liquidDensity:{value:'800',unit:'kg/m^3'}}),regime:'floating',values:{buoyancy:'6',displacedVolume:'3/4000',immersedHeight:'3/40',emergedHeight:'1/40'}},
 {id:'fx01-block500',input:buoyancyCase({blockDensity:{value:'500',unit:'kg/m^3'}}),regime:'floating',values:{mass:'1/2',weight:'5',buoyancy:'5',immersedHeight:'1/20'}},
 {id:'new-gravity9.8-load4',input:buoyancyCase({gravity:{value:'9.8',unit:'N/kg'},downwardLoad:{value:'4',unit:'N'}}),regime:'overloaded',values:{weight:'147/25',maximumBuoyancy:'49/5',criticalLoad:'98/25',netDownwardForce:'2/25'}},
 {id:'new-side12cm',input:buoyancyCase({cubeSide:{value:'12',unit:'cm'}}),regime:'floating',values:{volume:'27/15625',mass:'648/625',weight:'1296/125',immersedHeight:'9/125',emergedHeight:'6/125'}},
 {id:'intrinsically-dense',input:buoyancyCase({blockDensity:{value:'1200',unit:'kg/m^3'}}),regime:'overloaded',values:{weight:'12',criticalLoad:'-2',netDownwardForce:'2'}},
];
