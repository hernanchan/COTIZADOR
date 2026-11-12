/** Acceso R2 sólo para el personal: descarga privada del PDF en staging
 * y registro de inspección humana firmada en Central. Nunca autentica comprador.
 */
const HOST='https://pedidos.libreriasaber.com.ar';
const CENTRAL='https://pagos.libreriasaber.com.ar/internal/central/live/r2-inspection-';
const GO='GO_COMERCIAL_CONFIRMADO';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const KEY=/^r2-v1\/WEB-ENSAYO-[A-F0-9]{32}\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.pdf$/i;
const respond=(data,status=200)=>Response.json(data,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow'}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const enabled=env=>env?.SABER_ENTORNO==='produccion'&&
 env?.CENTRAL_DB_ENV==='produccion'&&env?.DOCS_MP_LIVE_GATE===GO&&
 env?.DOCS_LIVE_RECEPCION_GATE===GO&&env?.DOCS_LIVE_STAFF_GATE===GO&&
 env?.DOCS_LIVE_R2_GATE===GO&&env?.DOCS_LIVE_R2_STAGING_GATE===GO&&
 env?.DOCS_LIVE_PACKAGE_GATE===GO&&
 typeof env?.CENTRAL_BRIDGE_KEY==='string'&&env.CENTRAL_BRIDGE_KEY.length>=32&&
 typeof env?.SABER_CENTRAL?.fetch==='function'&&
 typeof env?.SABER_R2_GRANDES_LIVE?.head==='function'&&
 typeof env?.SABER_R2_GRANDES_LIVE?.get==='function';
async function central(env,kind,payload,{
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID(),
 subtle=crypto.subtle
}={}){
 const route=kind==='board'?'staff-board':kind==='source'?'source':'confirm';
 const schema=kind==='board'?'saber-central-r2-live-staff-board-v1':
  'saber-central-r2-inspection-'+route+'-v1';
 const body=JSON.stringify({schema,...payload});
 const id=nonce(),ts=now();
 if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(ts))
  throw Error('INSPECCION_STAFF_FIRMA');
 const secret=await subtle.importKey('raw',
  new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',secret,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 const target=kind==='board'?'https://pagos.libreriasaber.com.ar/internal/central/live/r2-staff-board':CENTRAL+route;
 const r=await env.SABER_CENTRAL.fetch(new Request(target,{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':String(ts),'x-saber-request-id':id,
   'x-saber-signature':signature},body}));
 const result=await r.json().catch(()=>null);
 if(!r.ok||result?.ok!==true)
  return {ok:false,status:r.status,error:'INSPECCION_STAFF_CENTRAL'};
 return {ok:true,data:result};
}
export async function inspeccionR2PersonalLive(request,env,{authorized=false}={}){
 if(!authorized)return respond({ok:false,error:'STAFF_R2_NO_AUTORIZADO'},401);
 if(!enabled(env))return respond({ok:false,error:'STAFF_R2_NO_CONFIGURADO'},503);
 const u=new URL(request.url);
 const path=u.pathname,board=path.endsWith('/live-r2-board')||path.endsWith('/live-board'),
  source=path.endsWith('/live-r2-inspection-source');
 const original=path.endsWith('/live-r2-inspection-original');
 const confirm=path.endsWith('/live-r2-inspection-confirm');
 if(u.origin!==HOST||(!board&&!source&&!original&&!confirm))
  return respond({ok:false,error:'STAFF_R2_RUTA'},404);
 if(board){
  if(request.method!=='GET'||u.search)
   return respond({ok:false,error:'STAFF_R2_TABLERO_RUTA'},405);
  try{
   const result=await central(env,'board',{purpose:'listar-pedidos-entrantes'});
   if(!result.ok)return respond({ok:false,error:result.error},result.status);
   const d=result.data;
   if(!Array.isArray(d.orders)||d.source!=='production-d1-verified-payments-only'||
      d.productionAuthorized!==false)
    return respond({ok:false,error:'STAFF_R2_TABLERO_INCONSISTENTE'},502);
   return respond({ok:true,orders:d.orders,productionAuthorized:false});
  }catch{return respond({ok:false,error:'STAFF_R2_TABLERO_INDISPONIBLE'},503)}
 }
 let p;
 if(source||original){
  if(request.method!=='GET'||[...u.searchParams.keys()].sort().join(',')!=='fileId,webOrderId')
   return respond({ok:false,error:'STAFF_R2_CONSULTA'},422);
  p={webOrderId:u.searchParams.get('webOrderId'),fileId:u.searchParams.get('fileId')};
 }else{
  if(request.method!=='POST'||request.headers.get('Origin')!==HOST||
   !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
   return respond({ok:false,error:'STAFF_R2_ORIGEN'},403);
  const raw=await request.text();
  if(raw.length>140000)return respond({ok:false,error:'STAFF_R2_TAMANO'},413);
  try{p=JSON.parse(raw)}catch{}
  if(!p||typeof p!=='object'||Array.isArray(p)||
   Object.keys(p).sort().join(',')!=='confirmed,fileId,measuredDimensions,operator,webOrderId'||
   p.confirmed!==true||typeof p.operator!=='string'||
   p.operator.trim().length<2||p.operator.trim().length>60||
   !Array.isArray(p.measuredDimensions)||!p.measuredDimensions.length||
   p.measuredDimensions.length>2000||
   p.measuredDimensions.some((x,i)=>!x||typeof x!=='object'||
    Object.keys(x).sort().join(',')!=='altoCm,anchoCm,numero'||
    x.numero!==i+1||!Number.isFinite(x.anchoCm)||!Number.isFinite(x.altoCm)||
    x.anchoCm<=0||x.altoCm<=0))
   return respond({ok:false,error:'STAFF_R2_INFORME'},422);
 }
 if(!WEB.test(p.webOrderId||'')||!FILE.test(p.fileId||''))
  return respond({ok:false,error:'STAFF_R2_IDENTIDAD'},422);
 try{
  const result=await central(env,confirm?'confirm':'source',p);
  if(!result.ok)return respond({ok:false,error:result.error},result.status);
  const d=result.data;
  if(confirm){
   if(d.inspected!==true||d.webOrderId!==p.webOrderId||d.fileId!==p.fileId||
    d.productionAuthorized!==false)
    return respond({ok:false,error:'STAFF_R2_RESULTADO'},502);
   return respond({ok:true,inspected:true,prepressApproved:false,
    productionAuthorized:false});
  }
  if(d.schema!=='saber-r2-staff-inspection-source-v1'||
   d.webOrderId!==p.webOrderId||d.fileId!==p.fileId||
   d.productionAuthorized!==false||d.inspected!==false||
   !KEY.test(d.objectKey||'')||
   !d.objectKey.startsWith('r2-v1/'+p.webOrderId+'/')||
   !Number.isSafeInteger(d.bytes)||d.bytes<=40*1048576||
   d.bytes>200*1048576||!/^[a-f0-9]{64}$/.test(d.sha256||''))
   return respond({ok:false,error:'STAFF_R2_FICHA'},502);
  if(source)return respond({ok:true,webOrderId:d.webOrderId,
    fileId:d.fileId,bytes:d.bytes,sha256:d.sha256,
    paginasDeclaradas:d.paginasDeclaradas,
    instruction:'Inspeccioná el PDF real antes de aprobar. Los datos del presupuesto no sustituyen las medidas comprobadas.'});
  const head=await env.SABER_R2_GRANDES_LIVE.head(d.objectKey);
  if(!head||head.size!==d.bytes)
   return respond({ok:false,error:'STAFF_R2_OBJETO_NO_DISPONIBLE'},503);
  const object=await env.SABER_R2_GRANDES_LIVE.get(d.objectKey);
  if(!object?.body||object.size!==d.bytes)
   return respond({ok:false,error:'STAFF_R2_ORIGINAL_NO_DISPONIBLE'},503);
  return new Response(object.body,{headers:{
   'Content-Type':'application/pdf','Content-Length':String(d.bytes),
   'Content-Disposition':'attachment; filename="libreriasaber-'+p.fileId+'.pdf"',
   'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff',
   'X-Robots-Tag':'noindex,nofollow','Referrer-Policy':'no-referrer'
  }});
 }catch{return respond({ok:false,error:'STAFF_R2_SERVICIO_NO_DISPONIBLE'},503)}
}
