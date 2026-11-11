/** Comprador LIVE: solicita transferencia o consulta estado, SIN acreditar pagos. */
const GO='GO_COMERCIAL_CONFIRMADO';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const reply=(x,status=200)=>Response.json(x,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export async function transferenciaLiveComprador(req,env,{
 authorized=false,service=env?.SABER_CENTRAL,subtle=crypto.subtle,
 now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID()
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    env?.DOCS_LIVE_TRANSFER_GATE!==GO||env?.DOCS_LIVE_ORDER_GATE!==GO||
    env?.DOCS_LIVE_TUS_GATE!==GO||env?.DOCS_MP_LIVE_GATE!==GO||
    env?.CENTRAL_LIVE_URL!=='https://pagos.libreriasaber.com.ar/internal/central/live/checkout'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function')
  return reply({ok:false,error:'TRANSFER_LIVE_COMPRADOR_CERRADO'},503);
 if(authorized!==true)return reply({ok:false,error:'TRANSFER_LIVE_SESION_NO_VINCULADA'},401);
 const u=new URL(req.url);
 if(req.method!=='POST'||u.origin!==ORIGIN||u.pathname!=='/api/pedido/live/transfer'||
    u.search||req.headers.get('Origin')!==ORIGIN||
    (req.headers.get('Sec-Fetch-Site')&&req.headers.get('Sec-Fetch-Site')!=='same-origin')||
    !/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||''))
  return reply({ok:false,error:'TRANSFER_LIVE_ORIGEN_INVALIDO'},403);
 const raw=await req.text();
 if(raw.length>700)return reply({ok:false,error:'TRANSFER_LIVE_INPUT_LIMITE'},413);
 let p;try{p=JSON.parse(raw)}catch{}
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='action,commercialOrderId,webOrderId'||
    !['start','status'].includes(p.action)||!UUID.test(p.commercialOrderId||'')||
    !WEB.test(p.webOrderId||''))return reply({ok:false,error:'TRANSFER_LIVE_IDENTIDAD'},422);
 const signed={
  schema:'saber-central-live-transfer-'+p.action+'-v1',
  commercialOrderId:p.commercialOrderId,webOrderId:p.webOrderId
 };
 const body=JSON.stringify(signed),ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||!UUID.test(id))return reply({ok:false,error:'TRANSFER_LIVE_FIRMA_NO_DISPONIBLE'},503);
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 const target='https://pagos.libreriasaber.com.ar/internal/central/live/transfer-'+p.action;
 let res,data;
 try{
  res=await service.fetch(new Request(target,{
   method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
    'x-saber-request-id':id,'x-saber-signature':sig},body}));
  data=await res.json();
 }catch{return reply({ok:false,error:'TRANSFER_LIVE_CENTRAL_INDISPONIBLE'},503)}
 if(!res.ok||data?.ok!==true)
  return reply({ok:false,error:typeof data?.error==='string'&&
   /^TRANSFER_LIVE_[A-Z0-9_]{1,70}$/.test(data.error)?
   data.error:'TRANSFER_LIVE_RECHAZADA'},res.status===409?409:503);
 if(data.webOrderId!==p.webOrderId||data.commercialOrderId!==p.commercialOrderId||
    !Number.isSafeInteger(data.amountArs)||data.amountArs<1||
    data.productionAuthorized!==false||
    (data.estado==='transferencia_pendiente'?
      data.paymentVerified!==false||data.uploadAuthorized!==false||
      !/^[A-Za-z0-9._-]{6,50}$/.test(data.alias||''):
     data.estado!=='pagado_esperando_archivos'||
      data.paymentVerified!==true||data.uploadAuthorized!==true))
  return reply({ok:false,error:'TRANSFER_LIVE_RESPUESTA_INCONSISTENTE'},502);
 return reply({ok:true,webOrderId:p.webOrderId,commercialOrderId:p.commercialOrderId,
  amountArs:data.amountArs,estado:data.estado,
  ...(data.estado==='transferencia_pendiente'?{alias:data.alias}:{}),
  paymentVerified:data.paymentVerified,uploadAuthorized:data.uploadAuthorized,
  productionAuthorized:false});
}
