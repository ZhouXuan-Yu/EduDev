import { HindsightClient, HindsightError, createClient, sdk } from '@vectorize-io/hindsight-client';
import { historyHash } from './state';

export function configuredHistoryIndex(dataRoot: string) {
  // A production service must be provisioned and attested by its managed launcher.
  // The current engineering route may use an explicitly isolated local fixture profile.
  if (process.env.OMNI_EDU_E2E_DIALOG_MODE!=='1' || !process.env.OMNI_EDU_DATA_ROOT) return;
  const endpoint=process.env.OMNI_EDU_HISTORY_LOOPBACK, credential=process.env.OMNI_EDU_HISTORY_TOKEN;
  if (!endpoint || !credential || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{1,4}$/.test(endpoint)) return;
  const url=new URL(endpoint);
  const client = new HindsightClient({baseUrl:url.origin,apiKey:credential,maxAttempts:1,userAgent:'edudev-history-r1/1'});
  const transport = createClient({baseUrl:url.origin,headers:{Authorization:'Bearer '+credential}});
  const bank = 'xz-history-'+historyHash(dataRoot.replaceAll('\\','/').toLowerCase()).slice(0,24);
  let checkedUntil=0;

  async function ready(signal:AbortSignal) {
    if(Date.now()<checkedUntil)return;
    const version = await client.getVersion({signal});
    if(version.api_version!=='1.3.0'||version.features.observations!==false) throw Error('history_service_version');
    let current;
    try {current=await client.getBankConfig(bank,{signal});}
    catch (error) {
      if (!(error instanceof HindsightError)||error.statusCode!==404)throw error;
      await client.createBank(bank,{signal,retainExtractionMode:'chunks',enableObservations:false,enableTemporalRetrieval:false});
      current=await client.getBankConfig(bank,{signal});
    }
    const {config}=current;
    if(config.retain_extraction_mode!=='chunks'||config.enable_observations!==false||
      config.enable_auto_consolidation!==false)throw Error('history_service_config');
    checkedUntil=Date.now()+30_000;
  }

  return {
    async status(operationId:string,signal:AbortSignal) {
      await ready(signal);
      const result=await sdk.getOperationStatus({client:transport,path:{bank_id:bank,operation_id:operationId},signal});
      if(result.response?.status===404)return 'not_found';
      if(!result.data)throw Error('history_operation_status');
      return result.data.status;
    },
    async write(documentId:string,text:string,operationId:string,signal:AbortSignal) {
      await ready(signal);
      const result=await client.retainBatch(bank,[{document_id:documentId,content:text,tags:[documentId],resolve_entities:false}],{async:true,operationId,signal});
      if(!result.success||!result.async||result.operation_id!==operationId)throw Error('history_write_unconfirmed');
    },
    async verify(documentId:string,hash:string,signal:AbortSignal) {
      await ready(signal);
      const doc=await client.getDocument(bank,documentId,{signal});
      return doc!==null && doc.id===documentId && doc.bank_id===bank && (doc.tags??[]).length===1 &&
        doc.tags?.[0]===documentId && doc.memory_unit_count>0 && typeof doc.original_text==='string' &&
        historyHash(doc.original_text)===hash;
    },
    async remove(documentId:string,signal:AbortSignal) {
      await ready(signal);
      if (await client.getDocument(bank,documentId,{signal})) await client.deleteDocument(bank,documentId,{signal});
      return await client.getDocument(bank,documentId,{signal})===null;
    },
    async search(query:string,documents:string[],signal:AbortSignal) {
      if(!documents.length)return [];
      await ready(signal);
      const allowed = new Set(documents);
      const reply = await client.recall(bank,query,{signal,types:['world','experience'],budget:'low',maxTokens:1600,
        includeEntities:false,includeChunks:false,includeSourceFacts:false,preferObservations:false,
        tagGroups:[{tags:documents,match:'any_strict',resolve:'exact'}]});
      return [...new Set(reply.results.filter(item=>item.document_id && allowed.has(item.document_id) &&
        (item.tags??[]).length===1 && item.tags?.[0]===item.document_id).map(item=>item.document_id!))].slice(0,12);
    },
  };
}
