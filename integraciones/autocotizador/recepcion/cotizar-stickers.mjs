/** Tarifas del catálogo público vigente: una plancha por página seleccionada y por copia. */
export function cotizarStickersPdf({formato,paginas,copias,precios}){
 if(!['a4','a3'].includes(formato))throw Error('Stickers: únicamente planchas A4 o A3');
 if(!Number.isSafeInteger(paginas)||paginas<1||paginas>2000||
  !Number.isSafeInteger(copias)||copias<1||copias>500)throw Error('Cantidad inválida de planchas');
 const cantidad=paginas*copias;
 const producto=precios?.stickers?.products?.find(p=>p.id==='sticker_'+formato);
 if(!producto)throw Error('Falta precio de stickers '+formato);
 const rango=producto.prices?.find(t=>cantidad>=t.from&&(t.to===null||cantidad<=t.to));
 if(!rango||!Number.isFinite(rango.unit)||rango.unit<=0)throw Error('Sin tarifa de stickers');
 return {formato,paginas,copias,cantidad,unitario:rango.unit,subtotal:cantidad*rango.unit,
  descripcion:producto.name+' · Adhesivo fotográfico con precorte'};
}
