import {plainStudentInput} from './student-context';

export const VARIATION_LINEAGE_SCHEMA='xiaozhi.variation-lineage.v1' as const;
/** Indices refer to the immutable, actually read sources in the original candidate payload. */
export type VariationLineage={schemaVersion:typeof VARIATION_LINEAGE_SCHEMA;itemParents:number[][]};
export function validVariationLineage(value:unknown,count:number,parentCount:number):value is VariationLineage{
 if(!plainStudentInput(value,['schemaVersion','itemParents'])||Object.keys(value).length!==2||value.schemaVersion!==VARIATION_LINEAGE_SCHEMA||!Array.isArray(value.itemParents)||value.itemParents.length!==count||parentCount<1||parentCount>8)return false;
 return value.itemParents.every(parents=>Array.isArray(parents)&&parents.length>=1&&parents.length<=parentCount&&new Set(parents).size===parents.length&&parents.every(index=>Number.isSafeInteger(index)&&index>=0&&index<parentCount));
}
export function createVariationLineage(count:number,parentCount:number,itemParents?:number[][]):VariationLineage|undefined{
 if(itemParents===undefined&&parentCount!==1)return undefined;
 const value={schemaVersion:VARIATION_LINEAGE_SCHEMA,itemParents:itemParents??Array.from({length:count},()=>[0])};
 if(!validVariationLineage(value,count,parentCount))throw Error('invalid_input');
 return value;
}
