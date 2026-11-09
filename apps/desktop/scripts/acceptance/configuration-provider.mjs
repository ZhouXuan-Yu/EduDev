/** Owned metadata transport only. No chat generation or external forwarding. */
export function installConfigurationProvider(electron){
 const state=globalThis.__configurationProvider={catalogues:0,invalidCredentials:0,failNext:false,externalAttempts:0,modelAttempts:0};
 electron.net.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.origin!=='https://api.deepseek.com'){state.externalAttempts++;throw Error('CONFIG_EXTERNAL_DENIED');}
  if(url.pathname.replace(/^\/v1(?=\/)/,'')!=='/models'){state.modelAttempts++;throw Error('CONFIG_GENERATION_DENIED');}
  if(++state.catalogues>18)throw Error('CONFIG_CATALOGUE_BUDGET');
  const headers=new Headers(init?.headers??input.headers),token=headers.get('authorization')||'';
  if(!token.startsWith('Bearer owned-config-valid-')){state.invalidCredentials++;return new Response('{}',{status:401});}
  if(state.failNext){state.failNext=false;return new Response('{}',{status:503});}
  return new Response(JSON.stringify({object:'list',data:['deepseek-flash','deepseek-v4-pro'].map(id=>({id,name:id,context_window:1048576,max_output_tokens:393216,effort:{supported_levels:['low','high','max'],default_level:'high'}}))}));
 };
}
export const readConfigurationProvider=()=>({...globalThis.__configurationProvider});
