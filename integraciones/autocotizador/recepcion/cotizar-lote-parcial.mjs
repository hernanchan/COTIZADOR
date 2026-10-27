/**
 * Un PDF dañado no impide presupuestar los otros archivos del lote.
 * La cifra parcial nunca se confunde con el total comercial confirmado.
 * No modifica archivos originales ni valida facturación.
 */
export function prepararLoteParcial(entries){
 if(!Array.isArray(entries)||entries.length>30)throw Error('Lote inválido');
 const indices=[],archivos=[],noLeidos=[];
 for(const [indice,e] of entries.entries()){
  if(!e||e.error||!Array.isArray(e.paginas)||e.paginas.length<1){
   noLeidos.push({indice,nombre:String(e?.name||'Archivo '+(indice+1)),
    motivo:String(e?.error||'Análisis pendiente')});
   continue;
  }
  indices.push(indice);
  archivos.push({
   nombre:e.name,paginas:e.paginas,
   paginasSeleccionadas:e.paginasSeleccionadas,
   seleccion:e.seleccion,servicio:e.servicio||'auto',
   productoFoto:e.productoFoto||'',productoGrafica:e.productoGrafica||'',
   corteVariante:e.corteVariante,corteMetros:e.corteMetros,
   copias:e.copias,modo:e.modo,caras:e.caras,
   papelPoster:e.papelPoster,anillado:e.anillado,
   grupoAnillado:e.grupoAnillado,materialColor:e.materialColor
  });
 }
 return {indices,archivos,noLeidos};
}
export function recomponerLoteParcial(respuesta,lote){
 if(!respuesta||respuesta.ok!==true||
    !Array.isArray(respuesta.plan)||!Array.isArray(respuesta.pendientes)||
    !lote||!Array.isArray(lote.indices)||!Array.isArray(lote.noLeidos))
  throw Error('Cotización parcial inválida');
 const indiceOriginal=i=>{
  if(!Number.isSafeInteger(i)||i<0||i>=lote.indices.length)
   throw Error('Índice de cotización inesperado');
  return lote.indices[i];
 };
 const plan=respuesta.plan.map(p=>({...p,indice:indiceOriginal(p.indice)}));
 const pendientes=respuesta.pendientes.map(p=>({...p,indice:indiceOriginal(p.indice)}));
 for(const p of lote.noLeidos)
  pendientes.push({indice:p.indice,nombre:p.nombre,motivo:p.motivo});
 const parcial=lote.noLeidos.length>0;
 return {...respuesta,plan,pendientes,
  estado:parcial?'INCOMPLETO':respuesta.estado,
  subtotalCalculable:parcial&&Number.isSafeInteger(respuesta.total)?respuesta.total:null,
  total:parcial?null:respuesta.total,
  contieneArchivosSinAnalizar:parcial,paymentAuthorized:false};
}
