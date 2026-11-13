/** Ruta staff Basic->HMAC para recuperar SOLO cobros LIVE aprobados en MP.
 * El navegador no recibe credenciales de Mercado Pago ni IDs de pago.
 */
const HOST='https://pedidos.libreriasaber.com.ar';
const GO='GO_COMERCIAL_CONFIRMADO';
const respond=(v,s=200)=>Response.json(v,{status:s,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'}});
export async function rescatePersonalMPLive(request,env,{authorized=false}={}){
 if(!authorized)return respond({ok:false,error:'PERSONAL_NO_AUTORIZADO'},401);
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.DOCS_MP_LIVE_GATE!==GO||env?.DOCS_LIVE_STAFF_GATE!==GO||
  !env?.SABER_CENTRAL?.fetch||
  typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32)
  return respond({ok:false,error:'RESCATE_NO_CONFIGURADO'},503);
 const u=new URL(request.url);
 if(u.origin!==HOST||u.pathname!=='/personal/api/live-reconcile'||u.search||u.hash)
  return respond({ok:false,error:'RESCATE_RUTA_INVALIDA'},404);
 if(request.method!=='POST'||request.headers.get('Origin')!==HOST||
  !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return respond({ok:false,error:'RESCATE_METODO_ORIGEN'},403);
 const raw=await request.text();
 if(raw.length>32||raw.trim()!=='{}')
  return respond({ok:false,error:'RESCATE_PARAMETROS'},422);
 const body=JSON.stringify({schema:'saber-central-live-staff-reconcile-v1',
  purpose:'revisar-cobros-pendientes'});
 const ts=Math.floor(Date.now()/1000),id=crypto.randomUUID();
 try{
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',key,
   new TextEncoder().encode(ts+'\n'+id+'\n'+body));
  const signature=Array.from(new Uint8Array(signed),x=>x.toString(16).padStart(2,'0')).join('');
  const response=await env.SABER_CENTRAL.fetch(new Request(
   'https://pagos.libreriasaber.com.ar/internal/central/live/staff-reconcile',{
    method:'POST',
    headers:{'Content-Type':'application/json',
      'x-saber-ts':String(ts),'x-saber-request-id':id,'x-saber-signature':signature},
    body
   }));
  const out=await response.json().catch(()=>null);
  if(!response.ok||out?.ok!==true)
   return respond({ok:false,error:out?.error||'RESCATE_CENTRAL_NO_DISPONIBLE'},response.status);
  return respond({ok:true,
   revisados:out.revisados,recuperados:out.recuperados,
   pendientes:out.pendientes,enRevision:out.enRevision,errores:out.errores,
   yaConciliados:out.yaConciliados});
 }catch{return respond({ok:false,error:'RESCATE_CONEXION_CENTRAL'},503)}
}
