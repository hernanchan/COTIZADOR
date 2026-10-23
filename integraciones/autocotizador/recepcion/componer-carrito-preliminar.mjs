/** Puente SIN checkout entre el catálogo local y el nuevo presupuesto con PDF.
 * Los precios de localStorage NO son confiables: cálculo únicamente ilustrativo.
 */
export function componerCarritoPreliminar({borrador,articulos=[]}){
 if(!borrador||borrador.schema!=='saber-pedido-borrador-v1'||
    borrador.estado!=='PENDIENTE_DE_RECEPCION'||
    borrador.filesReceived!==false||borrador.paymentAuthorized!==false||
    !Number.isSafeInteger(borrador.totalOrientativo)||borrador.totalOrientativo<=0)
  throw Error('No hay un borrador de impresión para revisar.');
 if(!Array.isArray(articulos)||articulos.length>100)
  throw Error('El carrito de la tienda tiene demasiadas líneas.');
 const productos=articulos.map((x,i)=>{
  if(!x||x.type!=='product'||typeof x.id!=='string'||!x.id.trim()||
     x.id.length>80||typeof x.name!=='string'||!x.name.trim()||x.name.length>180||
     !Number.isSafeInteger(Number(x.qty))||Number(x.qty)<1||Number(x.qty)>500||
     !Number.isSafeInteger(Number(x.price))||Number(x.price)<=0)
   throw Error('Artículo de tienda no válido o trabajo gráfico antiguo sin verificación: '+(i+1));
  return {tipo:'producto',codigo:x.id,nombre:x.name,cantidad:Number(x.qty),
   precioReferencia:Number(x.price),subtotalReferencia:Number(x.qty)*Number(x.price),
   necesitaValidacionServidor:true};
 });
 const subtotalProductos=productos.reduce((n,x)=>n+x.subtotalReferencia,0);
 const totalOrientativo=subtotalProductos+borrador.totalOrientativo;
 if(!Number.isSafeInteger(totalOrientativo)||totalOrientativo<=0)
  throw Error('Total preliminar fuera de rango.');
 return Object.freeze({
  schema:'saber-carrito-preliminar-v1',estado:'SIN_RECEPCION_NI_PAGO',
  productos,trabajos:borrador.items,
  subtotalProductosOrientativo:subtotalProductos,
  subtotalTrabajosOrientativo:borrador.totalOrientativo,totalOrientativo,
  filesReceived:false,serverQuoteVerified:false,
  pricesVerifiedByServer:false,paymentAuthorized:false,
  checkoutEnabled:false
 });
}
