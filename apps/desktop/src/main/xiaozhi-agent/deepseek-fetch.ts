/** Pi's provider-scoped FetchFunction hook, backed by the existing desktop network.
 * No global fetch/proxy/TLS mutation, no cookies, no credential-bearing redirects.
 */
export async function createDeepSeekFetch():Promise<typeof globalThis.fetch>{
 if(!process.versions.electron||process.type!=='browser')return globalThis.fetch;
 const {net}=await import('electron');
 return(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.protocol!=='https:'||url.hostname!=='api.deepseek.com'||url.port||url.username||url.password)throw Error('configuration');
  return net.fetch(input instanceof URL?input.href:input,{...init,credentials:'omit',redirect:'error'});
 };
}
