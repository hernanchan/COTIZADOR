/**
 * Cotización multimaterial segura para PDFs >40 MiB SIN crear pago ni subida.
 * Ensayo de integración del motor actual con transporte TUS/R2 por archivo.
 * OFF por defecto. No sustituye el endpoint de checkout anterior.
 */
import {prepararPlanRecepcionUniversal} from './plan-recepcion-universal-r2.mjs';
import {obtenerTarifarioD1Privado} from './obtener-tarifario-d1-privado.mjs';

const reply=(data,status=200)=>Response.json(data,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow,noarchive'
}});
export async function cotizarPlanUniversalSinSubida(request,env,{
 authorized=false,priceLoader=obtenerTarifarioD1Privado
}={}){
 if(!authorized)return reply({ok:false,error:'R2_PLAN_ACCESO_DENEGADO'},401);
 if(env?.DOCS_R2_UNIVERSAL_PLAN_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_PRICE_ADMIN_D1_ENABLED!=='PRIVATE_TEST_ONLY')
  return reply({ok:false,error:'R2_PLAN_NO_HABILITADO'},503);
 const url=new URL(request.url);
 if(request.method!=='POST'||request.headers.get('Origin')!==url.origin||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')||
    (request.headers.get('Sec-Fetch-Site')&&
     !['same-origin','none'].includes(request.headers.get('Sec-Fetch-Site'))))
  return reply({ok:false,error:'R2_PLAN_ORIGEN_INVALIDO'},403);
 let payload;
 try{
  const length=request.headers.get('Content-Length');
  if(length!==null&&Number(length)>150000)throw Error('extenso');
  const raw=await request.text();
  if(raw.length>150000)throw Error('extenso');
  payload=JSON.parse(raw);
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     Object.keys(payload).sort().join(',')!=='archivos,manifiestos')
   throw Error('campos');
 }catch{return reply({ok:false,error:'R2_PLAN_SOLICITUD_INVALIDA'},422)}
 let price,plan;
 try{
  price=await priceLoader(env);
  plan=prepararPlanRecepcionUniversal({
   archivos:payload.archivos,manifiestos:payload.manifiestos,tarifario:price
  });
 }catch(error){
  const reason=String(error?.message||'');
  return reply({ok:false,error:/^R2_PLAN_UNIVERSAL_[A-Z_]+$/.test(reason)?
    reason:'R2_PLAN_COTIZACION_NO_DISPONIBLE'},422);
 }
 // El comprador solo ve el resultado provisorio. No recibe identidad técnica
 // del bucket, claves internas, secretos, URLs de sesión ni autorización de carga.
 return reply({ok:true,schema:plan.schema,priceRevision:plan.priceRevision,
  quoteState:plan.quoteState,totalArs:plan.totalArs,
  archivos:plan.archivos.map(f=>({
   indice:f.indice,fileId:f.fileId,nombre:f.nombre,bytes:f.bytes,
   transporte:f.transporte,destino:f.destino,
   formatoFinal:f.formatoFinal,paginasElegidas:f.paginasElegidas
  })),
  filesUploaded:false,paymentAuthorized:false,
  productionAuthorized:false,requiresPaymentConfirmation:plan.requierePagoAntesDeR2
 });
}
