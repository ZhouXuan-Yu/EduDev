import {baseBuoyancy} from './buoyancy-fixtures.mjs';
export function buoyancyReview({wrong=false,load='0',bottom=false,g='10',missingG=false,kilo=false}={}){
 const model=structuredClone(baseBuoyancy);model.downwardLoad.value=load;model.gravity=missingG?null:{value:g,unit:'N/kg'};model.placement=bottom?'bottom':'free';
 const assumptions='采用均匀静止液体、刚性正方体、容器足够大且深的近似；忽略空气浮力和载荷体积，除重力、浮力、向下载荷及所声明底部支持外无其他外力。';
 const stem=`刚性正方体边长10cm，木块密度600kg/m^3，水密度1000kg/m^3，${missingG?'未给定g':`g=${g}N/kg`}，向下载荷${load}N。${bottom?'已完全浸没、触底静止且底面仍受水作用，不是密封贴底':'未触底；能漂浮时求平衡，超载时讨论完全浸没状态'}。求浮力及相关边界。`;
 let targets;if(missingG)targets=[['buoyancy','6','N','浮力6N']];else if(load==='0')targets=[['buoyancy',wrong?'5':kilo?'0.006':'6',kilo?'kN':'N',`浮力${wrong?'5':kilo?'0.006':'6'}${kilo?'kN':'N'}`],['immersedHeight','6','cm','浸入高度6cm'],['emergedHeight','4','cm','露出高度4cm']];else if(bottom)targets=[['buoyancy','10','N','浮力10N'],['supportForce',wrong?'2':'1','N',`支持力${wrong?'2':'1'}N`],['netDownwardForce','0','N','向下合力0N']];else if(g==='9.8')targets=[['buoyancy','9.8','N','浮力9.8N'],['criticalLoad','3.92','N','临界载荷3.92N'],['netDownwardForce',wrong?'0':'0.08','N',`向下合力${wrong?'0':'0.08'}N`]];else targets=[['buoyancy','10','N','浮力10N'],['criticalLoad','4','N','临界载荷4N'],['netDownwardForce',wrong?'0':load==='5'?'1':'0','N',`向下合力${wrong?'0':load==='5'?'1':'0'}N`]];
 targets=targets.map(([quantity,value,unit,answerText])=>({quantity,value,unit,answerText}));
 const answer=targets.map(t=>t.answerText).join('；')+'。',analysis=assumptions+'按受力平衡/最大排液量和等效平均密度两方法核对；全浸没临界不确定悬浮深度，合力方向不是瞬时速度。';
 return{draft:{title:'正方体浮力审题',reason:'按实际题干数量核对答案，保留声明近似与未证题意边界',subject:'物理',grade:'八年级',knowledgePoint:'浮力与浮沉',items:[{questionType:'short_answer',stem,answer,analysis,options:null,difficulty:'medium'}]},input:{kind:'buoyancy',model,sourceText:stem,assumptionsText:assumptions,targets}};
}
