/** Cambios de estado firmados; el navegador nunca ve claves Cloudflare. */
const HOST='https://pedidos.libreriasaber.com.ar';
const GO='GO_COMERCIAL_CONFIRMADO';
const reply=(x,s=200)=>Response.json(x,{status:s,headers:{'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'}});
export async function cambiarEstadoPersonalDocumentosLive(request,env,{authorized=false}={}){
 if(!authorized)return reply({ok:false,error:'PERSONAL_NO_AUTORIZADO'},401);
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
   env?.DOCS_MP_LIVE_GATE!==GO||env?.DOCS_LIVE_STAFF_GATE!==GO||
   env?.DOCS_LIVE_PACKAGE_GATE!==GO||!env?.SABER_CENTRAL?.fetch||
   typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32)
  return reply({ok:false,error:'ESTADO_NO_CONFIGURADO'},503);
 const u=new URL(request.url);
 if(request.method!=='POST'||u.origin!==HOST||u.pathname!=='/personal/api/live-status'||
   u.search||request.headers.get('Origin')!==HOST||
   !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return reply({ok:false,error:'ESTADO_ORIGEN'},403);
 const raw=await request.text();
 if(raw.length>900)return reply({ok:false,error:'ESTADO_TAMANO'},413);
 let p;try{p=JSON.parse(raw)}catch{}
 if(!p||typeof p!=='object'||Array.isArray(p)||
   Object.keys(p).sort().join(',')!=='confirmed,from,operator,orderId,reason,to,version'||
   typeof p.orderId!=='string'||!/^[a-f0-9-]{36}$/i.test(p.orderId)||
   p.confirmed!==true||typeof p.operator!=='string'||
   p.operator.trim().length<2||p.operator.trim().length>60||
   typeof p.reason!=='string'||p.reason.length>180||
   !Number.isSafeInteger(p.version)||p.version<0||p.version>1000)
  return reply({ok:false,error:'ESTADO_DATOS'},422);
 const payload={schema:'saber-central-live-staff-status-v1',...p};
 const body=JSON.stringify(payload),ts=Math.floor(Date.now()/1000),id=crypto.randomUUID();
 try{
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ts+'\n'+id+'\n'+body)));
  const sig=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const response=await env.SABER_CENTRAL.fetch(new Request('https://pagos.libreriasaber.com.ar/internal/central/live/staff-status',{
   method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
    'x-saber-request-id':id,'x-saber-signature':sig},body}));
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.ok!==true)return reply({ok:false,error:result?.error||'ESTADO_CENTRAL',status:response.status},response.status);
  if(result.orderId!==p.orderId||result.to!==p.to||result.version!==p.version+1)
   return reply({ok:false,error:'ESTADO_CENTRAL_INCONSISTENTE'},502);
  return reply({ok:true,orderId:result.orderId,to:result.to,version:result.version,
   ...(p.to==='entregado'?{purge:result.purge||'pending_retry',
    originalsDeleted:result.originalsDeleted===true}:{})});
 }catch{return reply({ok:false,error:'ESTADO_CONEXION_CENTRAL'},503)}
}
