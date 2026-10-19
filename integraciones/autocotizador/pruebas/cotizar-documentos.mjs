/**
 * Librería Saber: cálculo preliminar de tandas PDF con tarifa del cotizador existente.
 * Módulo puro. Aún NO es cálculo autorizado para cobro: se debe verificar archivo,
 * páginas, papel, cantidades, descuentos y versión de precios en el servidor.
 */
export function cotizarDocumentos({archivos,copias,formato,caras,materialColor,anillado,precios}){
  if(!Array.isArray(archivos)||archivos.length===0)throw Error('Subí al menos un PDF.');
  if(archivos.length>150)throw Error('Demasiados PDF en una sola tanda.');
  if(!Number.isSafeInteger(copias)||copias<1||copias>500)throw Error('Elegí de 1 a 500 copias.');
  if(!['a4','a3'].includes(formato))throw Error('Tamaño de hoja inválido.');
  if(!['simple','double'].includes(caras))throw Error('Elegí simple o doble faz.');
  if(!['ninguno','juntos','separados','mixto'].includes(anillado))throw Error('Tipo de anillado inválido.');
  let paginasBN=0,paginasColor=0,hojasPorArchivo=[];
  const ids=new Set();
  for(const a of archivos){
    if(!a||typeof a.id!=='string'||!a.id||ids.has(a.id))throw Error('Identificación de archivo duplicada o inválida.');
    ids.add(a.id);
    if(!Number.isSafeInteger(a.paginas)||a.paginas<1||a.paginas>20000)throw Error('Cantidad de páginas inválida.');
    if(!['bn','color'].includes(a.modo))throw Error('Cada PDF debe ser totalmente B/N o totalmente color.');
    if(!Number.isSafeInteger(a.orden)||a.orden<1||a.orden>150)throw Error('Orden de armado inválido.');
    if(a.modo==='bn')paginasBN+=a.paginas; else paginasColor+=a.paginas;
    hojasPorArchivo.push({...a,hojas:Math.ceil(a.paginas/(caras==='double'?2:1))});
  }
  const bnCantidad=paginasBN*copias,colorCantidad=paginasColor*copias;
  const bn=precios[formato==='a4'?'bnA4':'bnA3'];
  const color=precios[formato==='a4'?'colorA4':'colorA3'];
  if(!bn?.scales?.length||!color?.scales?.length)throw Error('Faltan tarifas de impresión.');
  const escala=(escalas,n)=>escalas.findIndex(e=>n>=Number(e.from||1)&&(e.to==null||n<=Number(e.to)));
  const ib=bnCantidad?escala(bn.scales,bnCantidad):-1;
  const ic=colorCantidad?escala(color.scales,colorCantidad):-1;
  if(bnCantidad&&ib<0||colorCantidad&&ic<0)throw Error('No hay escala para esta cantidad.');
  const tarifaBN=bnCantidad?Number(bn.scales[ib][caras]):0;
  const papel=color.materials.find(m=>m.id===materialColor);
  if(colorCantidad&&!papel)throw Error('Elegí un papel para impresión color.');
  const tarifaColor=colorCantidad?Number(papel.prices[ic][caras]):0;
  if(!Number.isFinite(tarifaBN)||!Number.isFinite(tarifaColor)||tarifaBN<0||tarifaColor<0)throw Error('Tarifa inválida.');
  const subtotalBN=bnCantidad*tarifaBN,subtotalColor=colorCantidad*tarifaColor;
  const grupos=new Map();
  if(anillado!=='ninguno'){
    for(const a of hojasPorArchivo){
      let id=anillado==='juntos'?'juntos':anillado==='separados'?a.id:String(a.grupo??'0').trim();
      if(anillado==='mixto'&&(!/^\d+$/.test(id)||Number(id)<0||Number(id)>150))throw Error('Elegí grupos de anillado válidos.');
      if(anillado==='mixto'&&id==='0')continue; // ese archivo va suelto
      if(!grupos.has(id))grupos.set(id,[]);
      grupos.get(id).push(a);
    }
  }
  let cargoAnillado=0;const detalleAnillados=[];
  for(const [id,docs] of grupos){
    const ordenado=docs.slice().sort((a,b)=>a.orden-b.orden);
    const hojas=ordenado.reduce((n,a)=>n+a.hojas,0);
    const rows=precios.bindings?.[formato]||[];
    const fila=rows.find(r=>hojas<=Number(r.to));
    if(!fila)throw Error('El grupo de anillado '+id+' supera la capacidad cotizable; requiere revisión.');
    const precio=Number(fila.price);
    if(!Number.isFinite(precio)||precio<0)throw Error('Precio de anillado inválido.');
    cargoAnillado+=precio*copias;
    detalleAnillados.push({grupo:id,archivos:ordenado.map(a=>a.id),hojasPorEjemplar:hojas,ejemplares:copias,subtotal:precio*copias});
  }
  const hojasPorEjemplar=hojasPorArchivo.reduce((n,a)=>n+a.hojas,0);
  return Object.freeze({
    archivos:archivos.length,copias,formato,caras,paginasPorEjemplar:paginasBN+paginasColor,
    paginasBN,paginasColor,bnCantidad,colorCantidad,tarifaBN,tarifaColor,
    subtotalBN,subtotalColor,papelColor:papel?.name||'',hojasPorEjemplar,
    hojasTotales:hojasPorEjemplar*copias,anillado,detalleAnillados,
    cargoAnillado,total:subtotalBN+subtotalColor+cargoAnillado
  });
}
