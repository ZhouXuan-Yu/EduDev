import assert from 'node:assert/strict';
/** The existing licensed row needs spacing and text hierarchy, not geometry alone. */
export function skillRowVisualContract(value){
 const values={rowGap:parseFloat(value.row.gap),paddingTop:parseFloat(value.row.padding),nameWeight:Number(value.name.fontWeight),nameSize:parseFloat(value.name.fontSize),descriptionSize:parseFloat(value.description.fontSize)};
 const checks={separateTextAndActions:values.rowGap>=12,rowPadding:values.paddingTop>=5,clearNameWeight:values.nameWeight>=600,smallerDescription:values.nameSize>values.descriptionSize,mutedDescription:value.name.color!==value.description.color};
 return {values,checks,pass:Object.values(checks).every(Boolean)};
}
export function assertSkillRowVisual(value){const result=skillRowVisualContract(value);assert(result.pass,'Licensed row spacing/typography missing: '+JSON.stringify(result));return result;}
