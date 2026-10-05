import type {XiaozhiStartInput} from './xiaozhi-agent';
import {validMessagePresentation} from './xiaozhi-message-presentation';
import {MAX_XIAOZHI_ATTACHMENTS,validAttachmentSession,validAttachmentSelection} from './xiaozhi-attachments';

/** Validate descriptors before reading values: accessors/symbols never run at admission. */
export function validXiaozhiStart(value:unknown):value is XiaozhiStartInput{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);
 if(keys.some(k=>typeof k!=='string'||!['sessionId','commandId','prompt','attachments','presentation'].includes(k))
  ||!['sessionId','commandId','prompt'].every(k=>Object.prototype.hasOwnProperty.call(descriptors,k))
  ||Object.values(descriptors).some(d=>!('value'in d)))return false;
 const session=descriptors.sessionId.value,command=descriptors.commandId.value,prompt=descriptors.prompt.value;
 if(!validAttachmentSession(session)||typeof command!=='string'||!/^xicmd_[a-f0-9-]{36}$/i.test(command)
  ||typeof prompt!=='string'||prompt.length>32768||prompt.includes('\0'))return false;
 if(descriptors.presentation&&!validMessagePresentation(prompt,descriptors.presentation.value))return false;
 if(!descriptors.attachments)return Boolean(prompt.trim());
 const items=descriptors.attachments.value;
 if(!Array.isArray(items)||!items.length||items.length>MAX_XIAOZHI_ATTACHMENTS)return false;
 const entries=Object.getOwnPropertyDescriptors(items);
 if(Reflect.ownKeys(items).length!==items.length+1||Object.values(entries).some(d=>!('value'in d)))return false;
 for(let index=0;index<items.length;index++)if(!entries[index]||!validAttachmentSelection(entries[index].value))return false;
 return new Set(items.map(item=>item.id)).size===items.length;
}

export const ATTACHMENT_ONLY_PROMPT='已添加本地附件，请先确认我需要如何处理这些附件。';
