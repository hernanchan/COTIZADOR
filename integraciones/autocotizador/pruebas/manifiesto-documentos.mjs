/**
 * Librería Saber · representación del pedido de documentos y su armado.
 * Solo crea la ficha lógica. NO autoriza pago ni producción por sí misma.
 * El backend debe consultar y validar cada recibo, estado de pago y precio.
 */
const validOrder=/^[A-Za-z0-9_-]{6,100}$/;
export function crearManifiestoDocumentos({
  orderId,archivos,recibos,formato,caras,copias,anillado,materialColor
}){
  if(typeof orderId!=='string'||!validOrder.test(orderId))
    throw Error('Referencia de pedido inválida.');
  if(!Array.isArray(archivos)||!archivos.length||archivos.length>150)
    throw Error('Archivos inválidos.');
  if(!Array.isArray(recibos)||recibos.length!==archivos.length)
    throw Error('Faltan recibos de recepción.');
  if(!['a4','a3'].includes(formato)||!['simple','double'].includes(caras)||
    !Number.isSafeInteger(copias)||copias<1||copias>500)
    throw Error('Configuración de impresión inválida.');
  if(!['ninguno','juntos','separados','mixto'].includes(anillado))
    throw Error('Configuración de anillado inválida.');
  if(typeof materialColor!=='string')throw Error('Material color inválido.');
  const map=new Map();
  for(const r of recibos){
    if(!r||typeof r.fileId!=='string'||map.has(r.fileId))
      throw Error('Recibo duplicado o inválido.');
    map.set(r.fileId,r);
  }
  const ids=new Set(),docs=[];
  for(const f of archivos){
    if(!f||typeof f.id!=='string'||!f.id||ids.has(f.id))throw Error('Archivo duplicado.');
    ids.add(f.id);
    if(!['bn','color'].includes(f.modo)||!Number.isSafeInteger(f.paginas)||f.paginas<1||
       !Number.isSafeInteger(f.orden)||f.orden<1)
      throw Error('Metadatos de documento inválidos.');
    const r=map.get(f.id);
    if(!r||r.status!=='verified'||r.orderId!==orderId||r.pages!==f.paginas||
       typeof r.receiptId!=='string'||r.receiptId.length<3||
       !/^[a-f0-9]{64}$/.test(r.sha256||''))
      throw Error('PDF no confirmado o páginas diferentes: '+f.id);
    if(!Number.isSafeInteger(r.bytes)||r.bytes<5)throw Error('Tamaño recibido inválido.');
    const grupo=anillado==='juntos'?'1':anillado==='separados'?f.id:
       anillado==='mixto'?String(f.grupo??'0'):'0';
    if(anillado==='mixto'&&(!/^\d+$/.test(grupo)||Number(grupo)>150))
      throw Error('Grupo de anillado inválido.');
    docs.push({id:f.id,nombre:f.nombre,modo:f.modo,paginas:f.paginas,
      hojasPorEjemplar:Math.ceil(f.paginas/(caras==='double'?2:1)),
      orden:f.orden,grupo:anillado==='ninguno'?'0':grupo,
      receiptId:r.receiptId,sha256:r.sha256,bytes:r.bytes});
  }
  if(map.size!==ids.size)throw Error('Hay recibos ajenos al pedido.');
  docs.sort((a,b)=>a.orden-b.orden);
  if(new Set(docs.map(x=>x.orden)).size!==docs.length)
    throw Error('Orden de documentos repetido.');
  const tandas=['bn','color'].map(mode=>({
    modo:mode,formato,caras,copias,material:mode==='color'?materialColor:'obra',
    documentos:docs.filter(d=>d.modo===mode).map(d=>({
      id:d.id,nombre:d.nombre,paginas:d.paginas,orden:d.orden,
      hojasPorEjemplar:d.hojasPorEjemplar,receiptId:d.receiptId
    }))
  })).filter(t=>t.documentos.length);
  const agrupados=new Map(),sueltos=[];
  for(const doc of docs){
    if(doc.grupo==='0'){sueltos.push(doc.id);continue}
    if(!agrupados.has(doc.grupo))agrupados.set(doc.grupo,[]);
    agrupados.get(doc.grupo).push(doc.id);
  }
  const grupos=[...agrupados].map(([grupo,ordenArchivos])=>({
    grupo,ordenArchivos,ejemplares:copias,
    hojasPorEjemplar:docs.filter(d=>ordenArchivos.includes(d.id)).reduce((x,d)=>x+d.hojasPorEjemplar,0)
  }));
  return Object.freeze({
    schema:'saber-document-order-v1',orderId,
    status:'files_verified_pending_payment', // pago se valida siempre por separado
    formato,caras,copias,anillado,materialColor,
    documentos:docs,tandas,gruposAnillado:grupos,documentosSueltos:sueltos,
    paginasPorEjemplar:docs.reduce((x,d)=>x+d.paginas,0),
    hojasPorEjemplar:docs.reduce((x,d)=>x+d.hojasPorEjemplar,0),
    // Ni precio ni cuenta de cliente; el backend debe consultarlos por orderId.
    requiresBackendPaymentVerification:true
  });
}
