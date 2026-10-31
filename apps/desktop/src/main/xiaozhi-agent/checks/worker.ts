import {STRUCTURE_SCHEMA,validStructureRequest,type StructureResult} from '../../../shared/xiaozhi-delivery-checks';
import {inspectDocumentStructure} from './structure';
const port=(process as unknown as {parentPort?:{on:(name:string,fn:(event:{data:unknown})=>void)=>void;postMessage:(value:unknown)=>void}}).parentPort;
const reply=(result:StructureResult)=>port?port.postMessage(result):process.send?.(result);
let started=false;
async function receive(input:unknown){
 if(started)return;started=true;const requestId=typeof(input as {requestId?:unknown})?.requestId==='string'?String((input as {requestId:string}).requestId):'';
 const fail=(error:string)=>reply({schemaVersion:STRUCTURE_SCHEMA,requestId,ok:false,error});
 if(!validStructureRequest(input)){fail('unsupported');return;}
 try{const data=await inspectDocumentStructure(input.name,Buffer.from(input.bytes));if(JSON.stringify(data).length>2000000)throw Error('too_large');reply({schemaVersion:STRUCTURE_SCHEMA,requestId,ok:true,data});}
 catch(error){const code=error instanceof Error?error.message:'';fail(['unsupported','too_large','empty','unavailable'].includes(code)?code:'parse_failed');}
}
if(port)port.on('message',event=>void receive(event.data));else process.on('message',input=>void receive(input));
