/** Panel bancario privado. Docs staff Basic -> service binding HMAC -> Central D1. */
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const CENTRAL='https://pagos.libreriasaber.com.ar/internal/central/live/transfer-staff-';
const GO='GO_COMERCIAL_CONFIRMADO';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const REF=/^[A-Z0-9][A-Z0-9._/ -]{5,79}$/;
const reply=(x,status=200)=>Response.json(x,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow','Referrer-Policy':'no-referrer'
}});
const hex=a=>Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
const enabled=(env,service)=>env?.SABER_ENTORNO==='produccion'&&
 env?.CENTRAL_DB_ENV==='produccion'&&env?.DOCS_LIVE_TRANSFER_GATE===GO&&
 env?.DOCS_LIVE_STAFF_GATE===GO&&env?.DOCS_MP_LIVE_GATE===GO&&
 env?.DOCS_LIVE_PACKAGE_GATE===GO&&
 typeof env?.CENTRAL_BRIDGE_KEY==='string'&&env.CENTRAL_BRIDGE_KEY.length>=32&&
 typeof service?.fetch==='function';
export async function transferenciasPersonalLive(request,env,{
 authorized=false,service=env?.SABER_CENTRAL,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 if(!authorized)return reply({ok:false,error:'TRANSFER_STAFF_NO_AUTORIZADO'},401);
 if(!enabled(env,service))return reply({ok:false,error:'TRANSFER_STAFF_NO_HABILITADO'},503);
 const url=new URL(request.url);
 const pending=url.pathname==='/personal/api/live-transferencias-pendientes',
  approve=url.pathname==='/personal/api/live-transferencias-aprobar';
 if(url.origin!==ORIGIN||url.search||(!pending&&!approve))
  return reply({ok:false,error:'TRANSFER_STAFF_RUTA'},404);
 let payload,kind;
 if(pending){
  if(request.method!=='GET')return reply({ok:false,error:'TRANSFER_STAFF_METODO'},405);
  kind='pending';
  payload={schema:'saber-central-live-transfer-staff-pending-v1',
   purpose:'listar-transferencias-pendientes'};
 }else{
  if(request.method!=='POST'||request.headers.get('Origin')!==ORIGIN||
     (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin')||
     !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
   return reply({ok:false,error:'TRANSFER_STAFF_ORIGEN'},403);
  const raw=await request.text();
  if(raw.length>1100)return reply({ok:false,error:'TRANSFER_STAFF_TAMANO'},413);
  let p;try{p=JSON.parse(raw)}catch{}
  if(!p||typeof p!=='object'||Array.isArray(p)||
     !['amount_ars,confirmed,operator,order_id',
       'amount_ars,bank_reference,confirmed,operator,order_id']
      .includes(Object.keys(p).sort().join(','))||
     !UUID.test(p.order_id||'')||!Number.isSafeInteger(p.amount_ars)||p.amount_ars<1||
     p.confirmed!==true||typeof p.operator!=='string'||p.operator.trim().length<2||
     p.operator.trim().length>60||
     (Object.hasOwn(p,'bank_reference')&&typeof p.bank_reference!=='string'))
   return reply({ok:false,error:'TRANSFER_STAFF_DATOS_INVALIDOS'},422);
  const legacy=Object.hasOwn(p,'bank_reference');
  const reference=legacy?p.bank_reference.trim().toUpperCase().replace(/\s+/g,' '):null;
  if(legacy&&(!REF.test(reference)||/\.(?:PDF|PNG|JPE?G|WEBP)$/.test(reference)))
   return reply({ok:false,error:'TRANSFER_STAFF_REFERENCIA_INVALIDA'},422);
  kind='approve';
  payload={schema:'saber-central-live-transfer-staff-approve-v1',
   order_id:p.order_id,amount_ars:p.amount_ars,
   operator:p.operator.trim(),confirmed:true};
  if(legacy)payload.bank_reference=reference;
 }
 const body=JSON.stringify(payload),ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1e9||ts>9999999999||!UUID.test(id))
  return reply({ok:false,error:'TRANSFER_STAFF_FIRMA'},503);
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 let response,data;
 try{
  response=await service.fetch(new Request(CENTRAL+kind,{
   method:'POST',headers:{'Content-Type':'application/json',
    'x-saber-ts':String(ts),'x-saber-request-id':id,
    'x-saber-signature':signature},body}));
  data=await response.json();
 }catch{return reply({ok:false,error:'TRANSFER_STAFF_CENTRAL_INDISPONIBLE'},503)}
 if(!response.ok||data?.ok!==true)return reply({ok:false,
  error:typeof data?.error==='string'&&/^TRANSFER_LIVE_[A-Z0-9_]+$/.test(data.error)?
   data.error:'TRANSFER_STAFF_CENTRAL_RECHAZA'},response.status===409?409:503);
 if(pending){
  if(!Array.isArray(data.pending)||data.pending.length>100)
   return reply({ok:false,error:'TRANSFER_STAFF_LISTA_INCONSISTENTE'},502);
  return reply({ok:true,pending:data.pending},200);
 }
 if(data.paymentVerified!==true||data.productionAuthorized!==false||
    data.order_id!==payload.order_id||data.amount_ars!==payload.amount_ars)
  return reply({ok:false,error:'TRANSFER_STAFF_ACREDITACION_INCONSISTENTE'},502);
 return reply({ok:true,paymentVerified:true,productionAuthorized:false},200);
}
