import {validDeliveryCatalog,type DeliveryCatalogResult} from '../../shared/xiaozhi-delivery';
import type {createDeliveryState} from './delivery-state';
import type {createDeliveryCoordinator} from './delivery-coordinator';

/** Read-only projection of the original bundle and child ledgers, hydrated only on selection. */
export function createDeliveryCatalog(options:{state:ReturnType<typeof createDeliveryState>;coordinator:Pick<ReturnType<typeof createDeliveryCoordinator>,'read'>;
 authorize:(sessionId:string)=>Promise<unknown>;running:(sessionId:string)=>boolean}){
 return async(input:unknown):Promise<DeliveryCatalogResult>=>{
  if(!validDeliveryCatalog(input))return{ok:false,error:'invalid_input'};
  try{
   if(input.action==='list')return{ok:true,kind:'list',...await options.state.catalog(input.offset??0)};
   try{await options.authorize(input.sessionId);}catch{return{ok:false,error:'permission_denied'};}
   const row=await options.state.get(input.bundleId);if(!row)return{ok:false,error:'not_found'};
   if(row.sessionId!==input.sessionId)return{ok:false,error:'permission_denied'};
   return{ok:true,kind:'get',delivery:await options.coordinator.read(input.sessionId,input.bundleId),running:options.running(input.sessionId)};
  }catch{return{ok:false,error:'unavailable'};}
 };
}
