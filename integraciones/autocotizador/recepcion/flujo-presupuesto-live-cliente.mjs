/** Flujo comprador LIVE previo a subir originales.
 * Cálculo local de SHA256 -> borrador D1 aprobado -> orden numerada -> MP LIVE.
 * Los PDF no salen del navegador mientras no haya pago conciliado.
 * Recepción TUS/R2 productiva es un módulo distinto aún NO activado.
 */
import {sha256PdfLocalPorFragmentos} from './sha256-pdf-local-fragmentos.mjs';
import {iniciarCheckoutLiveCliente} from './checkout-live-cliente.mjs';
import {guardarOriginalesLive,leerOriginalesLive} from './custodia-local-originales-live.mjs';
export {leerOriginalesLive,borrarOriginalesLive} from './custodia-local-originales-live.mjs';
const MIB=1048576,WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function post(fetcher,path,body){
 const res=await fetcher(path,{method:'POST',credentials:'same-origin',
  redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await res.json().catch(()=>null);
 if(!res.ok||data?.ok!==true)throw Error(String(data?.error||'LIVE_SERVICIO_INDISPONIBLE').slice(0,100));
 return data;
}
export function crearFlujoPresupuestoLive({
 files,archivos,webOrderId,telefono,nombre,direccion='',origin=location.origin,
 fetcher=fetch,hasher=sha256PdfLocalPorFragmentos,uuid=()=>crypto.randomUUID(),
 storage=typeof sessionStorage==='undefined'?null:sessionStorage,
 onProgress=()=>{},onState=()=>{},
 custodiarOriginales=guardarOriginalesLive,recuperarOriginales=leerOriginalesLive
}={}){
 if(origin!=='https://pedidos.libreriasaber.com.ar'||!WEB.test(webOrderId||'')||
  !/^\+?[0-9 ()-]{10,26}$/.test(telefono||'')||
  telefono.replace(/\D/g,'').length<10||
  telefono.replace(/\D/g,'').length>15||
  typeof nombre!=='string'||nombre.trim().length<2||nombre.trim().length>100||/[<>]/.test(nombre)||
  typeof direccion!=='string'||direccion.trim().length>180||/[<>]/.test(direccion)||
  !Array.isArray(files)||!Array.isArray(archivos)||
  files.length<1||files.length>10||files.length!==archivos.length||
  typeof fetcher!=='function'||typeof hasher!=='function'||
  typeof storage?.setItem!=='function'||typeof custodiarOriginales!=='function'||typeof recuperarOriginales!=='function')throw Error('LIVE_FLUJO_IDENTIDAD_INVALIDA');
 let totalTus=0;
 for(let i=0;i<files.length;i++){
  const f=files[i],a=archivos[i];
  if(!f||typeof f.slice!=='function'||!Number.isSafeInteger(f.size)||
    f.size<5||f.size>200*MIB||typeof f.name!=='string'||
    !/\.pdf$/i.test(f.name)||f.name.length>120||a?.nombre!==f.name||
    !Array.isArray(a.paginas)||!a.paginas.length||a.paginas.length>2000)
   throw Error('LIVE_FLUJO_ARCHIVOS_INVALIDOS');
  if(f.size<=40*MIB)totalTus+=f.size;
 }
 if(totalTus>60*MIB)throw Error('LIVE_FLUJO_TUS_EXCEDE_CUPO');
 let state='seleccionado',order=null,metas=null;
 const setState=s=>{state=s;onState(s)};
 async function preparar(){
  if(state!=='seleccionado')throw Error('LIVE_FLUJO_FASE_INVALIDA');
  setState('calculando');
  const manifiestos=[];
  try{
   for(let i=0;i<files.length;i++){
    const f=files[i];
    const signature=new Uint8Array(await f.slice(0,5).arrayBuffer());
    if(String.fromCharCode(...signature)!=='%PDF-')throw Error('LIVE_FLUJO_NO_PDF');
    const sha=await hasher(f,{onProgress:p=>onProgress({index:i+1,total:files.length,...p})});
    if(!SHA.test(sha))throw Error('LIVE_FLUJO_SHA');
    const fileId='pdf_'+i+'_'+uuid().replaceAll('-','');
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(fileId))throw Error('LIVE_FLUJO_FILE_ID');
    manifiestos.push({fileId,nombre:f.name,bytes:f.size,sha256:sha});
   }
   metas=manifiestos.map((m,i)=>({fileId:m.fileId,name:m.nombre,bytes:m.bytes,sha256:m.sha256,
    pages:archivos[i].paginas.length,mode:archivos[i].modo,
    transport:m.bytes<=40*MIB?'tus':'r2'}));
   if(!metas||metas.some(m=>!['bn','color'].includes(m.mode)||
     m.pages<1||m.pages>2000))throw Error('LIVE_METAS_POSTPAGO_INVALIDAS');
   setState('registrando_borrador');
   const draft=await post(fetcher,'/api/pedido/live/borrador',{
    webOrderId,archivos,manifiestos});
   if(draft.webOrderId!==webOrderId||draft.fileCount!==files.length||
      !UUID.test(draft.draftId||'')||!SHA.test(draft.quoteHash||'')||
      !Number.isSafeInteger(draft.totalArs)||draft.totalArs<1||
      draft.paymentAuthorized!==false||draft.checkoutEnabled!==false)
    throw Error('LIVE_FLUJO_BORRADOR_INCONSISTENTE');
   setState('registrando_orden');
   const result=await post(fetcher,'/api/pedido/live/orden',{
    webOrderId,draftId:draft.draftId,quoteHash:draft.quoteHash,
    telefono:telefono.trim(),nombre:nombre.trim(),direccion:direccion.trim()});
   if(result.webOrderId!==webOrderId||!UUID.test(result.commercialOrderId||'')||
      !/^\d{3,}$/.test(result.numeroOrden||'')||
      result.totalArs!==draft.totalArs||result.fileCount!==files.length||
      result.checkoutEnabled!==false||result.paymentAuthorized!==false||
      result.uploadAuthorized!==false||result.productionAuthorized!==false)
    throw Error('LIVE_FLUJO_ORDEN_INCONSISTENTE');
   order={webOrderId,commercialOrderId:result.commercialOrderId,
    amountArs:result.totalArs,fileCount:files.length,numeroOrden:result.numeroOrden};
   // Los PDF originales deben persistir antes de permitir el pago.
   setState('conservando_originales');
   await custodiarOriginales({files,metas,webOrderId,
    commercialOrderId:order.commercialOrderId,
    onProgress:p=>onProgress({phase:p.phase,total:files.length})});
   // Guardar referencia y manifiesto en esta pestaña en cuanto Central confirma
   // la orden: recuperarla no puede depender de haber pulsado Mercado Pago.
   storage.setItem('saber-live-archivos-v1',JSON.stringify({
    webOrderId,commercialOrderId:order.commercialOrderId,metas}));
   // La recepción posterior al pago necesita la referencia EN AMBOS medios:
   // antes sólo la guardaba el botón Mercado Pago; las transferencias pagadas
   // quedaban sin orden recuperable y nunca comenzaba TUS/R2.
   storage.setItem('saber-live-pedido-v1',JSON.stringify({
    webOrderId,commercialOrderId:order.commercialOrderId
   }));
   storage.setItem('saber-live-numero-v1',order.numeroOrden);
   setState('presupuestado');
   return Object.freeze({...order});
  }catch(error){setState('error');throw error}
 }
 async function iniciarPago(){
  if(state!=='presupuestado'||!order)throw Error('LIVE_FLUJO_PAGO_SIN_ORDEN');
  const {numeroOrden,...orden}=order;
  if(!metas||metas.some(m=>!['bn','color'].includes(m.mode)||
    m.pages<1||m.pages>2000))throw Error('LIVE_METAS_POSTPAGO_INVALIDAS');
  // Bloquear el pago si se perdió alguno de los File locales.
  await recuperarOriginales({webOrderId,commercialOrderId:order.commercialOrderId,metas});
  // Sin estos metadatos persistidos, no abrir Checkout: después del
  // redirect habría pago sin posibilidad de verificar los PDF originales.
  storage.setItem('saber-live-archivos-v1',JSON.stringify({
   webOrderId,commercialOrderId:order.commercialOrderId,metas}));
  const url=await iniciarCheckoutLiveCliente({orden,fetcher,storage,origin});
  setState('esperando_pago');
  return url;
 }
 async function consultarPago(){
  if(!order||!['esperando_pago','pagado'].includes(state))
   throw Error('LIVE_FLUJO_ESTADO_INVALIDO');
  const r=await post(fetcher,'/api/pedido/live/checkout',{action:'status',
   webOrderId,commercialOrderId:order.commercialOrderId});
  if(r.webOrderId!==webOrderId||r.commercialOrderId!==order.commercialOrderId||
    r.amountArs!==order.amountArs||r.fileCount!==order.fileCount)
   throw Error('LIVE_FLUJO_ESTADO_AJENO');
  if(r.estado==='pagado_esperando_archivos'&&r.uploadAuthorized===true){
   setState('pagado');return 'pagado';
  }
  if(r.estado==='pendiente'&&r.uploadAuthorized===false)return 'pendiente';
  if(r.estado==='revocado'&&r.uploadAuthorized===false){
   setState('revocado');return 'revocado';
  }
  throw Error('LIVE_FLUJO_ESTADO_INCONSISTENTE');
 }
 return Object.freeze({
  get estado(){return state},
  get orden(){return order&&Object.freeze({...order})},
  preparar,iniciarPago,consultarPago
 });
}
