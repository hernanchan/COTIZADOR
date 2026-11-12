/** Agenda LIVE protegida por Basic de personal y HMAC hacia Central.
 * El navegador jamás recibe la clave de la pasarela.
 */
const HOST='https://pedidos.libreriasaber.com.ar';
const GO='GO_COMERCIAL_CONFIRMADO';
const respond=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'}});
export async function agendaPersonalDocumentosLive(request,env,{authorized=false}={}){
 if(!authorized)return respond({ok:false,error:'AGENDA_PERSONAL_NO_AUTORIZADO'},401);
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.DOCS_MP_LIVE_GATE!==GO||env?.DOCS_LIVE_STAFF_GATE!==GO||
  env?.DOCS_LIVE_PACKAGE_GATE!==GO||
  typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
  typeof env?.SABER_CENTRAL?.fetch!=='function')
  return respond({ok:false,error:'AGENDA_NO_CONFIGURADA'},503);
 const u=new URL(request.url);
 if(u.origin!==HOST||u.pathname!=='/personal/api/live-calendar'||u.search)
  return respond({ok:false,error:'AGENDA_RUTA'},404);
 const p={action:'read',weekly:null,closedDates:null,expectedRevision:0,operator:''};
 if(request.method==='POST'){
  if(request.headers.get('Origin')!==HOST||
   !/^application\\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
   return respond({ok:false,error:'AGENDA_ORIGEN'},403);
  const body=await request.text();
  if(body.length>6500)return respond({ok:false,error:'AGENDA_TAMANO'},413);
  let x;try{x=JSON.parse(body)}catch{}
  if(!x||typeof x!=='object'||Array.isArray(x)||
   Object.keys(x).sort().join(',')!=='closedDates,expectedRevision,operator,weekly'||
   !Number.isSafeInteger(x.expectedRevision)||x.expectedRevision<0||x.expectedRevision>100000||
   typeof x.operator!=='string'||x.operator.trim().length<2||x.operator.trim().length>60||
   !x.weekly||typeof x.weekly!=='object'||Array.isArray(x.weekly)||
   !Array.isArray(x.closedDates)||x.closedDates.length>180)
   return respond({ok:false,error:'AGENDA_DATOS'},422);
  Object.assign(p,{...x,action:'save'});
 }else if(request.method!=='GET')return respond({ok:false,error:'AGENDA_METODO'},405);
 const payload={schema:'saber-central-live-staff-calendar-v1',...p};
 const body=JSON.stringify(payload),ts=Math.floor(Date.now()/1000),id=crypto.randomUUID();
 try{
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const raw=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ts+'\\n'+id+'\\n'+body)));
  const signature=Array.from(raw,b=>b.toString(16).padStart(2,'0')).join('');
  const response=await env.SABER_CENTRAL.fetch(new Request('https://pagos.libreriasaber.com.ar/internal/central/live/staff-calendar',{
   method:'POST',headers:{'Content-Type':'application/json',
    'x-saber-ts':String(ts),'x-saber-request-id':id,'x-saber-signature':signature},body
  }));
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.ok!==true)return respond({ok:false,error:data?.error||'AGENDA_CENTRAL'},response.status);
  if(!data.calendar||typeof data.calendar.revision!=='number')return respond({ok:false,error:'AGENDA_RESPUESTA'},502);
  return respond(data);
 }catch{return respond({ok:false,error:'AGENDA_CONEXION_CENTRAL'},503)}
}
