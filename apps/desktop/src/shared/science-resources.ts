/** Fixed teaching resource recipes. A catalog entry never supplies permission or executable input. */
export const SCIENCE_RESOURCES_REVISION='2026-11-03' as const;
export const SCIENCE_RESOURCES=[
 {id:'anatomy-iso-kit',name:'Anatomy 结构绘图',version:'1482e8469b0a9e0d8cc18ea2740a01423d29ae80',license:'MIT',
  sourceUrl:'https://github.com/wheresryan22/anatomy',licenseUrl:'https://github.com/wheresryan22/anatomy/blob/1482e8469b0a9e0d8cc18ea2740a01423d29ae80/LICENSE',
  status:'available',generator:'office_create_science_figure',scope:'等轴测实体结构与逐部件装配，不是受力、流体或运动仿真。',alternatives:[]},
 {id:'xiaozhi-buoyancy',name:'小智自制浮力探究',version:'xiaozhi.buoyancy-demo.v1',license:'小智原生自制',sourceUrl:null,licenseUrl:null,
  status:'available',generator:'buoyancyDemo',scope:'显式静水正方体条件下的精确浮力/平衡与有界参数探究；不是动力学积分。',alternatives:[]},
 {id:'phet-buoyancy',name:'PhET 浮力仿真',version:null,license:'CC-BY-NC-4.0',
  sourceUrl:'https://phet.colorado.edu',licenseUrl:'https://phet.colorado.edu/en/licensing',
  status:'license_required',generator:null,scope:'官方常规HTML当前非商业许可；本产品未取得商用集成许可，未安装仿真文件，不打包或嵌入。',alternatives:['xiaozhi-buoyancy']}
] as const;
export type ScienceResource=typeof SCIENCE_RESOURCES[number];
export function scienceResource(id:unknown):ScienceResource {
 const found=SCIENCE_RESOURCES.find(r=>r.id===id);if(!found)throw Error('unsupported_science_resource');return found;
}
export function applicableScienceResource(id:unknown,generator:'office_create_science_figure'|'buoyancyDemo'):ScienceResource {
 const r=scienceResource(id);if(r.status==='license_required')throw Error('science_resource_license_required');
 if(r.generator!==generator)throw Error('science_resource_not_applicable');return r;
}
export function scienceResourceChoices(names:readonly string[]){
 const hasText=names.includes('office_create_text'),hasFigure=names.includes('office_create_science_figure');
 return SCIENCE_RESOURCES.filter(r=>r.generator==='buoyancyDemo'?hasText:r.generator==='office_create_science_figure'?hasFigure:hasText||hasFigure)
  .map(r=>({...r,reviewedAt:SCIENCE_RESOURCES_REVISION,installed:r.status==='available'}));
}
export const scienceResourceParameter={type:'string',enum:SCIENCE_RESOURCES.map(r=>r.id),description:'显式科学资源选择。Anatomy仅结构图，xiaozhi-buoyancy仅精确浮力；PhET当前未获产品商用集成许可，宿主拒绝且可选自制替代。来源元数据随实际文件保留。'} as const;
