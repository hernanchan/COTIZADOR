/** Paso comercial independiente, únicamente para Pages de pruebas.
 * No expone el PDF ni permite cobros. Permanecerá deshabilitado hasta
 * aprobar explícitamente las fases de recepción y pedidos privados.
 */
import {originMatches,privateConfig,validateChallenge} from './worker-express.mjs';
import {prepararPedidoComercialExpress} from './preparar-pedido-comercial.mjs';

const LIMIT=8192;
function json(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'
 }});
}
async function parseLimited(request){
 if(!request.body)throw Error('Sin pedido.');
 const known=Number(request.headers.get('Content-Length'));
 if(Number.isFinite(known)&&known>LIMIT)throw Error('Pedido demasiado grande.');
 const reader=request.body.getReader();let n=0,parts=[];
 try{while(true){
  const {done,value}=await reader.read();if(done)break;
  n+=value.byteLength;if(n>LIMIT){await reader.cancel();throw Error('Pedido demasiado grande.')}
  parts.push(value);
 }}finally{reader.releaseLock()}
 const joined=new Uint8Array(n);let i=0;
 for(const p of parts){joined.set(p,i);i+=p.length}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined));
}
export async function onRequestGet(){return json({ok:false,error:'Método no permitido.'},405)}
export async function onRequestPost({request,env,fetcher=fetch}){
 if(!originMatches(request,env))
  return json({ok:false,error:'Origen no autorizado.'},403);
 if(env?.EXPRESS_ORDER_PREPARE_ENABLED!=='PRIVATE_TEST_ONLY'||
    !await privateConfig(request,env))
  return json({ok:false,error:'Pedidos Express todavía deshabilitados.'},503);
 if(request.method!=='POST'||!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return json({ok:false,error:'Formato no permitido.'},415);
 let payload;
 try{payload=await parseLimited(request)}
 catch{return json({ok:false,error:'Pedido comercial no válido.'},400)}
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    Object.keys(payload).sort().join(',')!=='clientOrderId,items,referencia,turnstileToken'||
    typeof payload.turnstileToken!=='string'||payload.turnstileToken.length<8||
    payload.turnstileToken.length>2048)
  return json({ok:false,error:'Pedido comercial no válido.'},400);
 try{await validateChallenge(payload.turnstileToken,request,env,fetcher)}
 catch{return json({ok:false,error:'Verificación de seguridad rechazada.'},403)}
 try{
  const result=await prepararPedidoComercialExpress({
   referencia:payload.referencia,clientOrderId:payload.clientOrderId,
   items:payload.items,env
  });
  return json({ok:true,orderId:result.commercialOrderId,
    amountArs:result.amountArs,created:result.created,
    idempotent:result.idempotent,checkoutEnabled:false,
    paymentAuthorized:false},result.idempotent?200:201)
 }catch{
  return json({ok:false,error:'La Central no pudo preparar el pedido. Reintentá con el mismo identificador.',
    checkoutEnabled:false,paymentAuthorized:false},502)
 }
}
