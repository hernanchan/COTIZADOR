/**
 * Piloto multifichero: agrega PDF de sesiones independientes únicamente después
 * de confirmar sus recibos en el servidor. Nunca permite checkout ni pagos.
 * Cada entrada de recibosVerificados DEBE llegar de la consulta HMAC privada,
 * nunca de JSON enviado por el navegador.
 */
import {cotizarDocumentos} from './cotizar-documentos.mjs';

const receiptPattern=/^DOC-[a-f0-9-]{36}$/i;
const orderPattern=/^WEB-ENSAYO-[A-F0-9]{16}$/;
const shaPattern=/^[a-f0-9]{64}$/;
const filePattern=/^[A-Za-z0-9_-]{1,80}$/;

export function cotizarLoteVerificado({
  recibosVerificados,formato,caras,copias,materialColor='obra70',
  anillado='ninguno',precios,
  maxFiles=5,maxFileBytes=1024*1024,requireSharedOrder=false
}){
  if(![[5,1024*1024,false],[30,20*1024*1024,true]].some(x=>
     x[0]===maxFiles&&x[1]===maxFileBytes&&x[2]===requireSharedOrder)||
     !Array.isArray(recibosVerificados)||recibosVerificados.length<1||
     recibosVerificados.length>maxFiles)
    throw Error('El lote excede el límite de recepción permitido.');
  const ids=new Set(),ordenes=new Set(),huellas=new Set();
  const documentos=recibosVerificados.map((r,i)=>{
    if(!r||r.ok!==true||r.verified!==true||r.storageVerified!==true||
       r.status!=='verified'||r.pageVerification!=='server'||
       r.paymentAuthorized!==false||!receiptPattern.test(r.receiptId||'')||
       !(requireSharedOrder?/^WEB-[A-Za-z0-9_-]{5,80}$/.test(r.orderId||''):
         orderPattern.test(r.orderId||''))||!filePattern.test(r.fileId||'')||
       typeof r.name!=='string'||!r.name.toLowerCase().endsWith('.pdf')||
       !['bn','color'].includes(r.mode)||!shaPattern.test(r.sha256||'')||
       !Number.isSafeInteger(r.pages)||r.pages<1||r.pages>20000||
       !Number.isSafeInteger(r.bytes)||r.bytes<5||r.bytes>maxFileBytes)
      throw Error('Uno de los PDF carece de verificación privada completa.');
    if(ids.has(r.receiptId)||(!requireSharedOrder&&ordenes.has(r.orderId))||
       (requireSharedOrder&&ordenes.size>0&&!ordenes.has(r.orderId))||
       huellas.has(r.sha256))
      throw Error('Recibos o documentos duplicados en el lote.');
    ids.add(r.receiptId);ordenes.add(r.orderId);huellas.add(r.sha256);
    return {id:'pdf'+(i+1),nombre:r.name,paginas:r.pages,modo:r.mode,orden:i+1};
  });
  // En el piloto, el anillado de varios documentos sólo admite ninguno,
  // juntos o separados. La elección de orden se incorpora en otra etapa.
  if(!['ninguno','juntos','separados'].includes(anillado))
    throw Error('Modalidad de anillado aún no habilitada para el piloto.');
  const detalle=cotizarDocumentos({
    archivos:documentos,copias,formato,caras,materialColor,anillado,precios
  });
  if(!Number.isFinite(detalle.total)||detalle.total<0)
    throw Error('No se pudo confirmar el precio.');
  return Object.freeze({
    ok:true,documentos:documentos.map(d=>({nombre:d.nombre,paginas:d.paginas,modo:d.modo})),
    receiptIds:[...ids],
    precioUnitarioBN:detalle.tarifaBN,precioUnitarioColor:detalle.tarifaColor,
    siguienteDescuentoBN:detalle.siguienteDescuentoBN,
    siguienteDescuentoColor:detalle.siguienteDescuentoColor,
    paginasVerificadas:detalle.paginasPorEjemplar,
    hojasTotales:detalle.hojasTotales,cantidadBN:detalle.bnCantidad,
    cantidadColor:detalle.colorCantidad,
    subtotalImpresiones:detalle.subtotalBN+detalle.subtotalColor,
    anillados:detalle.cargoAnillado,total:detalle.total,
    priceVersion:String(precios?.generatedAt||'sin-fecha'),
    paymentAuthorized:false
  });
}
