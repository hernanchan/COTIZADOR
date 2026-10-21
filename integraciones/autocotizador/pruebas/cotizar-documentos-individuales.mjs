/**
 * Presupuesto preliminar por PDF: agrupa descuentos exclusivamente por
 * tamaño + tipo (B/N o color) + papel, aunque las caras y copias difieran.
 * No acepta pagos ni sustituye la verificación de los originales.
 */
export function cotizarDocumentosIndividuales({archivos,precios}){
 if(!Array.isArray(archivos)||archivos.length<1||archivos.length>30)throw Error('Cantidad de PDF inválida.');
 const ids=new Set(), grupos=new Map(), detalles=[];
 for(const [i,a] of archivos.entries()){
  if(!a||typeof a.id!=='string'||ids.has(a.id)||a.id!=='pdf'+(i+1)||
   !Number.isSafeInteger(a.paginas)||a.paginas<1||a.paginas>20000||
   !Number.isSafeInteger(a.copias)||a.copias<1||a.copias>500||
   !['a4','a3'].includes(a.formato)||!['bn','color'].includes(a.modo)||
   !['simple','double'].includes(a.caras)||!['ninguno','individual'].includes(a.anillado))
   throw Error('Configuración de archivo inválida.');
  ids.add(a.id);
  const papel=a.modo==='bn'?'estandar':a.materialColor;
  const color=precios[a.formato==='a4'?'colorA4':'colorA3'];
  if(a.modo==='color'&&!color?.materials?.some(m=>m.id===papel))
   throw Error('Papel color no disponible.');
  const key=[a.formato,a.modo,papel].join(':');
  const cantidad=a.paginas*a.copias;
  if(!Number.isSafeInteger(cantidad))throw Error('Cantidad inválida.');
  if(!grupos.has(key))grupos.set(key,{key,formato:a.formato,modo:a.modo,papel,cantidad:0,archivos:[]});
  const grupo=grupos.get(key);grupo.cantidad+=cantidad;grupo.archivos.push(i);
  detalles.push({...a,cantidad,grupo:key});
 }
 let total=0,subtotalImpresiones=0,subtotalAnillados=0;
 for(const g of grupos.values()){
  const base=precios[g.formato==='a4'?'bnA4':'bnA3'];
  const color=precios[g.formato==='a4'?'colorA4':'colorA3'];
  const scales=(g.modo==='bn'?base:color)?.scales;
  if(!Array.isArray(scales))throw Error('Escalas no disponibles.');
  const ix=scales.findIndex(e=>g.cantidad>=Number(e.from||1)&&(e.to==null||g.cantidad<=Number(e.to)));
  if(ix<0)throw Error('No hay escala para este grupo.');
  const material=g.modo==='color'?color.materials.find(m=>m.id===g.papel):null;
  for(const indice of g.archivos){
   const a=detalles[indice];
   const unit=g.modo==='bn'?Number(scales[ix][a.caras]):Number(material?.prices?.[ix]?.[a.caras]);
   if(!Number.isFinite(unit)||unit<0)throw Error('Precio unitario inválido.');
   a.precioUnitario=unit;
   a.subtotalImpresion=a.cantidad*unit;
   let anillado=0;
   if(a.anillado==='individual'){
    const hojas=Math.ceil(a.paginas/(a.caras==='double'?2:1));
    const filas=precios.bindings?.[a.formato]||[];
    const fila=filas.find(r=>hojas<=Number(r.to));
    if(!fila)throw Error('Anillado requiere revisión por cantidad de hojas.');
    anillado=Number(fila.price)*a.copias;
    if(!Number.isFinite(anillado)||anillado<0)throw Error('Precio de anillado inválido.');
   }
   a.subtotalAnillado=anillado;
   a.subtotal=a.subtotalImpresion+anillado;
   subtotalImpresiones+=a.subtotalImpresion;
   subtotalAnillados+=anillado;
  }
  g.precioEscalaDesde=Number(scales[ix].from||1);
 }
 total=subtotalImpresiones+subtotalAnillados;
 if(!Number.isFinite(total)||total<0)throw Error('Total inválido.');
 return {estado:'PRELIMINAR_SIN_VERIFICAR',paymentAuthorized:false,total,
   subtotalImpresiones,subtotalAnillados,
   paginasTotales:detalles.reduce((n,a)=>n+a.paginas,0),
   detalles:detalles.map(a=>({id:a.id,nombre:a.nombre,paginas:a.paginas,
    formato:a.formato,modo:a.modo,materialColor:a.materialColor,caras:a.caras,
    copias:a.copias,anillado:a.anillado,cantidad:a.cantidad,grupo:a.grupo,
    precioUnitario:a.precioUnitario,subtotal:a.subtotal})),
   grupos:[...grupos.values()].map(g=>({clave:g.key,cantidad:g.cantidad,
      archivos:g.archivos.length,desde:g.precioEscalaDesde}))};
}
