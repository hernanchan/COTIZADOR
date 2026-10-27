/**
 * Prepara el manifiesto V2 multi-PDF después de la recepción real verificada.
 * Sólo transporte de metadatos, nunca confianza comercial ni escritura D1.
 * El backend debe verificar de nuevo cada recibo y recalcular el precio.
 */
const WEB=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const RECEIPT=/^DOC-[a-f0-9-]{36}$/i;
const SHA=/^[a-f0-9]{64}$/;
const formats=new Set(['a4','a3']),sides=new Set(['simple','double']);
export function prepararManifiestoDocumentalV2({orderId,trabajos}){
 if(!WEB.test(orderId||'')||!Array.isArray(trabajos)||trabajos.length<1||trabajos.length>30)
  throw Error('Pedido V2 sin trabajos verificables.');
 const receipts=new Set(),shaRefs=new Set(),localRefs=new Set();
 const items=trabajos.map((entry,index)=>{
  const v=entry?.vinculo,quote=v?.cotizacionServidor;
  // Contrato mixto de etapa 1. Los datos CAD/Póster son instrucciones
  // preliminares; el servidor relee el PDF y vuelve a calcular el precio.
  if(entry?.ploteoVerificado!==undefined){
   const plot=entry.ploteoVerificado;
   if(!v||v.schema!=='saber-v2-pdf-conciliado-privado-v1'||
      v.orderId!==orderId||!UUID.test(v.localRef||'')||
      !RECEIPT.test(v.receiptId||'')||!SHA.test(v.sha256||'')||
      !Number.isSafeInteger(v.pages)||v.pages<1||v.pages>2000||
      v.reciboGoogleVerificado!==true||v.paymentAuthorized!==false||
      v.listoParaProducir!==false||v.precioRecalculado!==false||
      v.estado!=='RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO'||
      !plot||plot.estado!=='PRELIMINAR_VERIFICADA_SIN_PEDIDO'||
      plot.paginasOriginales!==v.pages||
      !Number.isSafeInteger(plot.totalArs)||plot.totalArs<1||
      typeof plot.priceVersion!=='string'||!plot.priceVersion||
      !Number.isSafeInteger(plot.copias)||plot.copias<1||plot.copias>200||
      !['obra80','recubierto'].includes(plot.papelPoster)||
      !Array.isArray(plot.paginas)||plot.paginas.length!==v.pages||
      plot.paginas.some((p,i)=>!p||p.numero!==i+1||
       !['cad','poster'].includes(p.modo)||
       !Number.isFinite(p.anchoCm)||!Number.isFinite(p.altoCm)||
       !/^(rollo|rec)\\d+$/.test(p.rollo||'')||
       !['obra80','recubierto'].includes(p.papel)||
       (p.modo==='cad'&&(p.papel!=='obra80'||!/^rollo\\d+$/.test(p.rollo)))||
       (p.modo==='poster'&&p.papel!==plot.papelPoster))||
      plot.paymentAuthorized!==false||plot.checkoutEnabled!==false||
      receipts.has(v.receiptId)||localRefs.has(v.localRef)||
      shaRefs.has(v.sha256))
    throw Error('Ploteo V2 no confirmado o duplicado: '+(index+1));
   receipts.add(v.receiptId);localRefs.add(v.localRef);shaRefs.add(v.sha256);
   return Object.freeze({referenciaLocal:v.localRef,reciboPrivado:v.receiptId,
    sha256:v.sha256,paginas:v.pages,
    opciones:Object.freeze({servicio:'ploteos',copias:plot.copias,
     papelPoster:plot.papelPoster}),
    subtotalReferencia:plot.totalArs,versionPrecioReferencia:plot.priceVersion,
    estado:'REQUIERE_REVALIDACION_DE_BACKEND'});
  }
  if(!v||v.schema!=='saber-v2-pdf-conciliado-privado-v1'||
   v.orderId!==orderId||!UUID.test(v.localRef||'')||
   !RECEIPT.test(v.receiptId||'')||!SHA.test(v.sha256||'')||
   !Number.isSafeInteger(v.pages)||v.pages<1||v.pages>2000||
   v.reciboGoogleVerificado!==true||v.precioRecalculado!==false||
   v.paymentAuthorized!==false||v.listoParaProducir!==false||
   v.estado!=='RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO'||
   !quote||quote.estado!=='PRELIMINAR_VERIFICADA_SIN_PEDIDO'||
   !Number.isSafeInteger(quote.totalArs)||quote.totalArs<1||
   typeof quote.priceVersion!=='string'||!quote.priceVersion||
   quote.paginasOriginales!==v.pages||!formats.has(quote.formato)||
   !sides.has(quote.caras)||!Number.isSafeInteger(quote.copias)||
   quote.copias<1||quote.copias>200||
   !['ninguno','juntos'].includes(quote.anillado)||
   !/^[A-Za-z0-9_-]{1,80}$/.test(quote.materialColor||'')||
   quote.paymentAuthorized!==false||
   receipts.has(v.receiptId)||localRefs.has(v.localRef)||
   shaRefs.has(v.sha256))
   throw Error('Trabajo V2 no confirmado o duplicado: '+(index+1));
  receipts.add(v.receiptId);localRefs.add(v.localRef);shaRefs.add(v.sha256);
  return Object.freeze({referenciaLocal:v.localRef,reciboPrivado:v.receiptId,
   sha256:v.sha256,paginas:v.pages,
   opciones:Object.freeze({formato:quote.formato,caras:quote.caras,
    copias:quote.copias,anillado:quote.anillado,materialColor:quote.materialColor}),
   subtotalReferencia:quote.totalArs,versionPrecioReferencia:quote.priceVersion,
   estado:'REQUIERE_REVALIDACION_DE_BACKEND'});
 });
 const total=items.reduce((a,x)=>a+x.subtotalReferencia,0);
 if(!Number.isSafeInteger(total)||total<1)throw Error('Total preliminar fuera de rango.');
 return Object.freeze({schema:'saber-v2-manifiesto-preliminar-v1',orderId,
  items:Object.freeze(items),totalOrientativo:total,
  receiptsRecheckedByBackend:false,pricesRecalculatedByBackend:false,
  registeredInD1:false,checkoutEnabled:false,paymentAuthorized:false,
  listoParaProducir:false});
}
