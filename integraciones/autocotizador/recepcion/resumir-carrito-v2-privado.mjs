/** Vista segura de los PDF ya confirmados por el servidor.
 * No incluye tokens de sesión ni habilita una compra o escritura D1.
 */
const ID=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const DOC=/^DOC-[a-f0-9-]{36}$/i;
const SHA=/^[a-f0-9]{64}$/;
export function resumirCarritoDocumentalV2({orderId,items}){
 if(!ID.test(orderId||'')||!Array.isArray(items)||items.length>30)throw Error('Carrito V2 inválido.');
 const vistos=new Set(),recibos=new Set(),lines=[],pending=[];
 let quoteTotal=0;
 for(const item of items){
  if(!item||!Array.isArray(item.references))throw Error('Línea inválida.');
  for(const entry of item.references){
   const ref=entry?.reference,v=entry?.confirmacion,q=v?.cotizacionServidor;
   if(!ref||!UUID.test(ref.localRef||'')||vistos.has(ref.localRef))throw Error('Referencia V2 duplicada o inválida.');
   vistos.add(ref.localRef);
   if(!v){pending.push(ref.nombre||'PDF pendiente');continue;}
   if(v.schema!=='saber-v2-pdf-conciliado-privado-v1'||v.orderId!==orderId||
      v.localRef!==ref.localRef||!DOC.test(v.receiptId||'')||
      recibos.has(v.receiptId)||!SHA.test(v.sha256||'')||
      v.sha256!==ref.sha256||v.pages!==ref.paginas||
      v.reciboGoogleVerificado!==true||v.paymentAuthorized!==false||
      v.listoParaProducir!==false||v.precioRecalculado!==false||
      !q||q.estado!=='PRELIMINAR_VERIFICADA_SIN_PEDIDO'||
      !Number.isSafeInteger(q.totalArs)||q.totalArs<=0||
      q.paymentAuthorized!==false)
    throw Error('El PDF no tiene una constancia preliminar válida.');
   recibos.add(v.receiptId);
   lines.push(Object.freeze({nombre:ref.nombre,receiptId:v.receiptId,
    localRef:ref.localRef,paginas:v.pages,importeServidor:q.totalArs,
    estado:'VERIFICADO_PENDIENTE_DE_D1'}));
   quoteTotal+=q.totalArs;
   if(!Number.isSafeInteger(quoteTotal))throw Error('Importe preliminar fuera de rango.');
  }
 }
 return Object.freeze({schema:'saber-v2-resumen-operador-v1',orderId,
  totalReferencias:vistos.size,verificados:lines.length,pendientes:pending.length,
  nombresPendientes:Object.freeze(pending),lineas:Object.freeze(lines),
  totalServidorPreliminar:quoteTotal,completo:vistos.size>0&&pending.length===0,
  registroD1Confirmado:false,pagoAutorizado:false,
  checkoutHabilitado:false,produccionAutorizada:false});
}
