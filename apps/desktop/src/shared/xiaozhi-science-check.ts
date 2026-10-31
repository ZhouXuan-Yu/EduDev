/** Independent static equilibrium model. It does not simulate velocity or depth below the surface. */
export type CubeBuoyancyCheck={kind:'cube_buoyancy';sideCm:number;objectDensity:number;liquidDensity:number;gravity:number;loadN:number;
 quantity:'weight_n'|'buoyancy_n'|'immersed_cm'|'exposed_cm'|'displaced_cm3'|'downward_net_n'};
const units={weight_n:'N',buoyancy_n:'N',immersed_cm:'cm',exposed_cm:'cm',displaced_cm3:'cm³',downward_net_n:'N'} as const;
export function validScienceCheck(v:unknown):v is CubeBuoyancyCheck{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const r=v as Record<string,unknown>;
 return Object.keys(r).length===7&&r.kind==='cube_buoyancy'&&Object.keys(r).every(k=>['kind','sideCm','objectDensity','liquidDensity','gravity','loadN','quantity'].includes(k))
  &&['sideCm','objectDensity','liquidDensity','gravity'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k])&&r[k]>0&&r[k]<=100000)
  &&typeof r.loadN==='number'&&Number.isFinite(r.loadN)&&r.loadN>=0&&r.loadN<=1e9&&typeof r.quantity==='string'&&Object.hasOwn(units,r.quantity);
}
export function scienceExpected(rule:CubeBuoyancyCheck){
 if(!validScienceCheck(rule))throw Error('invalid_input');
 const side=rule.sideCm/100,volume=side**3,weight=rule.objectDensity*volume*rule.gravity,total=weight+rule.loadN;
 const force=Math.min(total,rule.liquidDensity*volume*rule.gravity),displaced=force/(rule.liquidDensity*rule.gravity),height=Math.min(rule.sideCm,displaced/(side*side)*100);
 const values={weight_n:weight,buoyancy_n:force,immersed_cm:height,exposed_cm:Math.max(0,rule.sideCm-height),displaced_cm3:displaced*1e6,downward_net_n:Math.max(0,total-force)};
 const value=values[rule.quantity];if(!Number.isFinite(value))throw Error('invalid_number');return{value,unit:units[rule.quantity]};
}
