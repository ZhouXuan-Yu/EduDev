import http from 'node:http';
import net from 'node:net';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {officeWebUrl,resolveOfficePublicAddresses,type OfficeDnsMode} from '../office-agent/office-network';

/** Private browser-session transport. DNS validation and connection use the same IP.
 * No global proxy/DNS changes; Chromium still verifies the destination TLS certificate. */
export async function createPublicBrowserProxy(dnsMode:OfficeDnsMode) {
  const username=randomBytes(24).toString('hex'),password=randomBytes(32).toString('hex');
  const auth=Buffer.from('Basic '+Buffer.from(username+':'+password).toString('base64'));
  const sockets=new Set<net.Socket>();let closed=false,modeRevision=0;
  const failures=new Map<string,string>();
  const tracked=new WeakSet<net.Socket>();
  const track=(socket:net.Socket)=>{if(tracked.has(socket))return socket;tracked.add(socket);sockets.add(socket);socket.on('error',()=>{});socket.once('close',()=>sockets.delete(socket));socket.setTimeout(30000,()=>socket.destroy());return socket;};
  const authenticated=(value:unknown)=>{const actual=Buffer.from(typeof value==='string'?value:'');return actual.length===auth.length&&timingSafeEqual(actual,auth);};
  const destination=async(raw:string)=>{if(closed)throw new Error('cancelled');const url=officeWebUrl(raw),revision=modeRevision;try{const addresses=await resolveOfficePublicAddresses(url.hostname.replace(/^\[|\]$/g,''),AbortSignal.timeout(15000),dnsMode);if(closed||revision!==modeRevision)throw new Error('cancelled');failures.delete(url.hostname);return {url,address:addresses[0]};}catch(error){if(!closed&&revision===modeRevision){const code=(error as Error).message;if(failures.size>=256)failures.delete(failures.keys().next().value!);failures.set(url.hostname,['permission_denied','dns_blocked','cancelled'].includes(code)?code:(error as Error).name==='TimeoutError'?'timeout':'network');}throw error;}};
  const server=http.createServer(async(req,res)=>{
    if(!authenticated(req.headers['proxy-authorization'])){res.writeHead(407,{'Proxy-Authenticate':'Basic realm="XiaozhiBrowser"'});res.end();return;}
    try{
      const {url,address}=await destination(req.url||'');
      if(url.protocol!=='http:')throw new Error('permission_denied');
      const headers:http.OutgoingHttpHeaders={...req.headers,host:url.host};delete headers['proxy-authorization'];delete headers['proxy-connection'];
      const outbound=http.request({hostname:address.address,family:address.family,port:Number(url.port||80),method:req.method,path:url.pathname+url.search,headers,timeout:30000},response=>{res.writeHead(response.statusCode||502,response.headers);response.pipe(res);});
      outbound.on('socket',track);outbound.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});outbound.on('timeout',()=>outbound.destroy());req.pipe(outbound);
      req.once('aborted',()=>outbound.destroy());res.once('close',()=>outbound.destroy());
    }catch{res.writeHead(403);res.end();}
  });
  server.on('connection',track);
  server.on('connect',(req,client,head)=>{void(async()=>{
    const socket=client as net.Socket;
    if(!authenticated(req.headers['proxy-authorization'])){socket.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="XiaozhiBrowser"\r\nContent-Length: 0\r\n\r\n');return;}
    try{
      const target=new URL('https://'+(req.url||''));if(target.pathname!=='/'||target.search||target.hash||target.port&&target.port!=='443')throw new Error('permission_denied');
      const {address}=await destination(target.href);if(socket.destroyed||closed)return;
      const upstream=track(net.connect({host:address.address,family:address.family,port:443}));
      upstream.once('connect',()=>{if(socket.destroyed||closed){upstream.destroy();return;}socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);upstream.pipe(socket);socket.pipe(upstream);});
      upstream.once('error',()=>socket.destroy());socket.once('close',()=>upstream.destroy());
    }catch{socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');}
  })();});
  server.on('clientError',(_error,socket)=>socket.destroy());
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
  const address=server.address();if(!address||typeof address==='string')throw new Error('configuration');
  return {port:address.port,username,password,
    setDnsMode(mode:OfficeDnsMode){if(mode===dnsMode)return false;dnsMode=mode;modeRevision++;failures.clear();for(const socket of sockets)socket.destroy();return true;},
    failureFor(raw:string){try{return failures.get(new URL(raw).hostname);}catch{return undefined;}},
    stopConnections(){modeRevision++;for(const socket of sockets)socket.destroy();},async close(){closed=true;modeRevision++;for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
