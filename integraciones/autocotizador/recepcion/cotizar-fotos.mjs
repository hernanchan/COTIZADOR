export function cotizarFotosPdf({productoId,paginas,copias,precios}){
 if(!Number.isSafeInteger(paginas)||paginas<1||paginas>2000||!Number.isSafeInteger(copias)||copias<1||copias>500)throw Error('Cantidad invalida');
 if(typeof productoId!=='string'||!productoId||productoId.length>80||productoId.includes('polaroid'))throw Error('Producto no habilitado');
 const producto=precios?.photos?.products?.find(p=>p.id===productoId);
 if(!producto)throw Error('Producto fotografico inexistente');
 const cantidad=paginas*copias;
 const idx=precios.photos.scales.findIndex(t=>cantidad>=t.from&&(t.to==null||cantidad<=t.to));
 const unitario=producto.prices?.[idx];
 if(idx<0||!Number.isFinite(unitario)||unitario<=0)throw Error('Tarifa no disponible');
 return {productoId,paginas,copias,cantidad,unitario,subtotal:unitario*cantidad,papel:producto.paper,tamano:producto.size,unidadComercial:productoId==='foto_carnet'?'plancha de 6 fotos carnet':'foto'};
}