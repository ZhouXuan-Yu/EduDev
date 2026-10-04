import '../office-agent/register-source.mjs';
import { fetchOfficePublicUrl } from '../../src/main/office-agent/office-network.ts';
import { searchAnySearch } from '../../src/main/office-agent/vendor/hana/lib/tools/anysearch.ts';
const query='教育部 义务教育课程方案 2022';
for(const dnsMode of ['system','alidns','cloudflare']) {
  for(const target of ['anysearch','bing','moe']) {
    const start=Date.now(), signal=AbortSignal.timeout(15000);
    try {
      const fetchImpl=(url,options={})=>fetchOfficePublicUrl(url,{...options,signal,dnsMode});
      if(target==='anysearch') {
        const result=await searchAnySearch(query,3,'','anysearch_free',{fetchImpl,signal});
        console.log(JSON.stringify({dnsMode,target,elapsedMs:Date.now()-start,results:result.results.map(r=>({title:r.title,url:r.url}))}));
      } else {
        const url=target==='bing'?`https://cn.bing.com/search?q=${encodeURIComponent(query)}`:'https://www.moe.gov.cn/';
        const response=await fetchImpl(url),text=await response.text();
        console.log(JSON.stringify({dnsMode,target,status:response.status,elapsedMs:Date.now()-start,type:response.headers.get('content-type'),length:text.length,title:text.match(/<title[^>]*>(.*?)<\/title>/s)?.[1],location:response.headers.get('location')}));
      }
    } catch(error) { console.log(JSON.stringify({dnsMode,target,elapsedMs:Date.now()-start,error:error.message?.slice(0,160),cause:error.cause?.code})); }
  }
}
