import {cotizarFotosPdf} from './cotizar-fotos.mjs';
export function procesarFotoCarga({archivo,indice,paginas,precios,fotos,plan,pendientes}){
 if(archivo.anillado!=='ninguno'){
  pendientes.push({indice,nombre:archivo.nombre,motivo:'Fotografías incompatibles con anillado'});return;
 }
 const producto=precios.photos?.products?.find(x=>x.id===archivo.productoFoto);
 if(!producto||producto.size==='Polaroid'){
  pendientes.push({indice,nombre:archivo.nombre,motivo:'Elegí tamaño y papel fotográfico'});return;
 }
 const calculo=cotizarFotosPdf({productoId:archivo.productoFoto,paginas:paginas.length,copias:archivo.copias,precios});
 const id='fot'+(fotos.length+1);
 fotos.push({id,nombre:archivo.nombre,...calculo});
 plan.push({indice,nombre:archivo.nombre,destino:'fotos',id,formatoFinal:producto.size,
  paginasElegidas:paginas.map(x=>x.numero),origen:paginas.map(x=>({numero:x.numero,anchoCm:x.anchoCm,altoCm:x.altoCm})),
  ajuste:'verificar_encuadre_y_recorte',unidadComercial:calculo.unidadComercial});
}