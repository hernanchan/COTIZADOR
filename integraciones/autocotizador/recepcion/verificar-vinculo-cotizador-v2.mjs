/**
 * Cruce privado de referencia local del cotizador V2 con PDF REAL verificado
 * por Cloudflare/GAS/Drive. Nunca acepta recibos del navegador como autoridad.
 * No cambia el total del carrito ni autoriza pago o producción.
 */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const RECEIPT=/^DOC-[a-f0-9-]{36}$/i;
const SHA=/^[a-f0-9]{64}$/;
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
export function verificarVinculoCotizadorV2({
 referencia,recibo,sessionId,expectedOrderId=null,expectedMode=null
}){
 const r=referencia,v=recibo;
 if(!r||typeof r!=='object'||Array.isArray(r)||
  Object.keys(r).sort().join(',')!==
   'bytes,estado,localRef,nombre,paginas,recibido,schema,sha256,verificadoServidor'||
  r.schema!=='saber-pdf-local-pendiente-v1'||
  !UUID.test(r.localRef||'')||!SHA.test(r.sha256||'')||
  !Number.isSafeInteger(r.bytes)||r.bytes<5||r.bytes>20*1024*1024||
  !Number.isSafeInteger(r.paginas)||r.paginas<1||r.paginas>2000||
  typeof r.nombre!=='string'||r.nombre.length<1||r.nombre.length>120||
  !/\.pdf$/i.test(r.nombre)||
  r.estado!=='PENDIENTE_DE_ENVIO'||r.recibido!==false||
  r.verificadoServidor!==false)
  throw Error('Referencia del carrito no admite confirmación.');
 if(!v||v.ok!==true||v.status!=='verified'||v.verified!==true||
  v.storageVerified!==true||v.pageVerification!=='server'||
  v.paymentAuthorized!==false||
  !RECEIPT.test(v.receiptId||'')||v.receiptId!==sessionId||
  !ORDER.test(v.orderId||'')||
  // ID nuevo: SHA parcial + UUID local, para dos PDF idénticos en el pedido.
  // Se acepta también el ID legado (sólo SHA) para reanudar recibos anteriores.
  !['pdf-'+r.sha256.slice(0,16)+r.localRef.replace(/-/g,'').toLowerCase().padStart(33,'-'),
    'pdf-'+r.sha256.slice(0,24)].includes(v.fileId)||
  v.sha256!==r.sha256||v.bytes!==r.bytes||
  v.pages!==r.paginas||!['bn','color'].includes(v.mode))
  throw Error('El PDF de Google no coincide con la referencia del carrito.');
 // Google guarda el nombre seguro como fileId__nombre.
 const expectedName=v.fileId+'__'+r.nombre.replace(/[^A-Za-z0-9_. -]/g,'_');
 if(v.name!==expectedName||
    expectedOrderId!==null&&(v.orderId!==expectedOrderId||!ORDER.test(expectedOrderId))||
    expectedMode!==null&&v.mode!==expectedMode)
  throw Error('Recibo de otro pedido, otro archivo o impresión distinta.');
 return Object.freeze({
  schema:'saber-v2-pdf-conciliado-privado-v1',
  localRef:r.localRef,orderId:v.orderId,fileId:v.fileId,receiptId:v.receiptId,
  sha256:v.sha256,bytes:v.bytes,pages:v.pages,mode:v.mode,
  estado:'RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO',
  reciboGoogleVerificado:true,
  precioRecalculado:false,ingresadoEnCentral:false,
  paymentAuthorized:false,listoParaProducir:false,
  descargaPrivadaHabilitada:false
 });
}
