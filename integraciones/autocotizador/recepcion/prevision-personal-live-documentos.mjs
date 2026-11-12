/** Pasarela privada de previsión. Reutiliza Basic del personal y HMAC de Central. */
const HOST='https://pedidos.libreriasaber.com.ar';
const GO='GO_COMERCIAL_CONFIRMADO';
const respond=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'}});
const allowed=['por_confirmar','hoy','hoy_tarde','proximo_dia'];
export async function previsionPersonalDocumentosLive(request,env,{authorized=false}={}){
 if(!authorized)return respond({ok:false,error:'PERSONAL_NO_AUTORIZADO'},401);
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    env?.DOCS_MP_LIVE_GATE!==GO||env?.DOCS_LIVE_STAFF_GATE!==GO||
    env?.DOCS_LIVE_PACKAGE_GATE!==GO||!env?.SABER_CENTRAL?.fetch||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32)
  return respond({ok:false,error:'PREVISION_NO_CONFIGURADA'},503);
 const u=new URL(request.url);
 if(u.origin!==HOST||u.pathname!=='/personal/api/live-forecast'||u.search)
  return respond({ok:false,error:'PREVISION_RUTA'},404);
 const p={action:'read',mode:null,orderId:null,readyAt:null,expectedRevision:0,operator:'',reason:''};
 if(request.method==='POST'){
  if(request.headers.get('Origin')!==HOST||
     !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
   return respond({ok:false,error:'PREVISION_ORIGEN'},403);
  const raw=await request.text();
  if(raw.length>850)return respond({ok:false,error:'PREVISION_TAMANO'},413);
  let data;try{data=JSON.parse(raw)}catch{}
  if(!data||typeof data!=='object'||Array.isArray(data)||
     Object.keys(data).sort().join(',')!=='action,expectedRevision,mode,operator,orderId,readyAt,reason'||
     !['global','order'].includes(data.action)||
     !Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<0||
     typeof data.operator!=='string'||data.operator.trim().length<2||data.operator.length>60||
     typeof data.reason!=='string'||data.reason.length>240)
   return respond({ok:false,error:'PREVISION_DATOS'},422);
  if(data.action==='global'&&(!allowed.includes(data.mode)||data.orderId!==null||data.readyAt!==null||data.reason!==''))return respond({ok:false,error:'PREVISION_GLOBAL'},422);
  if(data.action==='order'&&(data.mode!==null||typeof data.orderId!=='string'||!/^[a-f0-9-]{36}$/i.test(data.orderId)||
    !(data.readyAt===null||typeof data.readyAt==='string')))return respond({ok:false,error:'PREVISION_ORDEN'},422);
  Object.assign(p,data);
 }else if(request.method!=='GET')return respond({ok:false,error:'PREVISION_METODO'},405);
 const payload={schema:'saber-central-live-staff-forecast-v1',...p};
 const body=JSON.stringify(payload),ts=Math.floor(Date.now()/1000),id=crypto.randomUUID();
 try{
  const secret=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const arr=new Uint8Array(await crypto.subtle.sign('HMAC',secret,new TextEncoder().encode(ts+'\n'+id+'\n'+body)));
  const sig=Array.from(arr,b=>b.toString(16).padStart(2,'0')).join('');
  const r=await env.SABER_CENTRAL.fetch(new Request('https://pagos.libreriasaber.com.ar/internal/central/live/staff-forecast',{
   method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':id,'x-saber-signature':sig},body
  }));
  const data=await r.json().catch(()=>null);
  if(!r.ok||data?.ok!==true)return respond({ok:false,error:data?.error||'PREVISION_CENTRAL'},r.status);
  return respond(data);
 }catch{return respond({ok:false,error:'PREVISION_CONEXION_CENTRAL'},503)}
}
