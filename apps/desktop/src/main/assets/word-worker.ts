import {parseWord} from './word-parser';
import {WORD_SCHEMA,validWordRequest,type WordResult} from '../../shared/material-word';
const parent=(process as unknown as {parentPort?:{on:(event:string,fn:(event:{data:unknown})=>void)=>void;postMessage:(v:unknown)=>void}}).parentPort;
let started=false;
async function receive(raw:unknown){if(started)return;started=true;const id=typeof (raw as {requestId?:unknown})?.requestId==='string'?String((raw as {requestId:string}).requestId):'';const reply=(v:WordResult)=>parent?parent.postMessage(v):process.send?.(v);
 if(!validWordRequest(raw)){reply({schemaVersion:WORD_SCHEMA,requestId:id,ok:false,error:'invalid_input'});return;}
 try{reply({schemaVersion:WORD_SCHEMA,requestId:id,ok:true,payload:await parseWord(raw.bytes)});}catch(error){reply({schemaVersion:WORD_SCHEMA,requestId:id,ok:false,error:(error as Error).message==='too_large'?'too_large':'parse_failed'});}
}
if(parent)parent.on('message',event=>void receive(event.data));else process.on('message',raw=>void receive(raw));
