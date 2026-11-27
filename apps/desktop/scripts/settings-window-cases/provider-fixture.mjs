// Synthetic credentials used only by the isolated acceptance transport.
export const FIXTURE_KEY='edudev-settings-fixture-valid';
export const REJECTED_KEY='edudev-settings-fixture-rejected';
export const providerFixtureScript=`
globalThis.__settingsProviderRequests=[];
e.net.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url);
 init?.signal?.throwIfAborted();
 if(url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/models'){
  __settingsBlockedNetwork++;throw Error('acceptance_network_disabled');
 }
 const accepted=new Headers(init?.headers).get('authorization')===${JSON.stringify('Bearer '+FIXTURE_KEY)};
 __settingsProviderRequests.push({endpoint:'models',accepted});
 if(accepted&&globalThis.__settingsProviderPauseNext){
  __settingsProviderPauseNext=false;globalThis.__settingsProviderHolding=true;
  await new Promise((resolve,reject)=>{
   const cancel=()=>{globalThis.__settingsProviderHolding=false;reject(Error('cancelled'));};
   init?.signal?.addEventListener('abort',cancel,{once:true});
   globalThis.__settingsProviderRelease=()=>{init?.signal?.removeEventListener('abort',cancel);globalThis.__settingsProviderHolding=false;resolve();};
  });
 }
 return new Response(JSON.stringify(accepted?{object:'list',data:[
  {id:'deepseek-flash',name:'Fixture Flash',context_window:262144,max_output_tokens:8192,input_modalities:['text'],effort:{supported_levels:['low','high','max']}},
  {id:'deepseek-v4-pro',name:'Fixture Pro',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max']}}
 ]}:{error:{type:'authentication_error'}}),{status:accepted?200:401,headers:{'content-type':'application/json'}});
};`;
