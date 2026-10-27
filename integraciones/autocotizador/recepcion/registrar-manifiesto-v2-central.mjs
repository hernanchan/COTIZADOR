/**
 * Etapa privada V2: verificar que TODOS los renglones del carrito pertenezcan
 * al mismo pedido y a los recibos comprobados realmente por GAS/Drive.
 * El importe de navegador jamás viaja a la Central como importe definitivo:
 * se utiliza únicamente la ficha recalculada del servidor.
 */
import {enviarCentralFirmada} from './enviar-central-firmada.mjs';
const WEB=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const HEX=/^[a-f0-9]{64}$/;
const RECEIPT=/^DOC-[a-f0-9-]{36}$/i;
export function conciliarManifiestoV2ConServidor({manifiesto,verificacion}){
 const m=manifiesto,v=verificacion;
 if(!m||m.schema!=='saber-v2-manifiesto-preliminar-v1'||
   !WEB.test(m.orderId||'')||!Array.isArray(m.items)||
   m.items.length<1||m.items.length>30||
   m.registeredInD1!==false||m.paymentAuthorized!==false||
   m.checkoutEnabled!==false||m.pricesRecalculatedByBackend!==false||
   m.receiptsRecheckedByBackend!==false)
  throw Error('Manifiesto V2 no es un borrador comprobable.');
 if(!v||v.schema!=='saber-central-recepcion-verificada-v1'||
   v.orderId!==m.orderId||v.filesReceived!==true||
   v.paymentAuthorized!==false||v.listoParaProducir!==false||
   v.pagoConfirmado!==false||!Number.isSafeInteger(v.importeVerificado)||
   v.importeVerificado<1||!Array.isArray(v.recibos)||
   v.recibos.length!==m.items.length||!v.ficha)
  throw Error('El servidor no revalidó íntegramente el pedido V2.');
 const esperados=new Map();
 for(const item of m.items){
  if(!item||!RECEIPT.test(item.reciboPrivado||'')||
   !HEX.test(item.sha256||'')||
   !Number.isSafeInteger(item.paginas)||item.paginas<1||
   item.estado!=='REQUIERE_REVALIDACION_DE_BACKEND'||
   esperados.has(item.reciboPrivado))
   throw Error('Recibo preliminar V2 duplicado o inválido.');
  esperados.set(item.reciboPrivado,item);
 }
 const vistos=new Set();
 for(const recibo of v.recibos){
  const expected=esperados.get(recibo?.receiptId);
  if(!expected||vistos.has(recibo.receiptId)||
    recibo.sha256!==expected.sha256||recibo.pages!==expected.paginas||
    !Number.isSafeInteger(recibo.bytes)||recibo.bytes<5||
    typeof recibo.fileId!=='string'||!recibo.fileId)
   throw Error('Google confirmó archivos distintos de los declarados para el carrito.');
  vistos.add(recibo.receiptId);
 }
 if(vistos.size!==m.items.length)throw Error('Faltan PDFs verificados.');
 // Para CAD/Póster exigir la ficha recalculada por el servidor y comprobar
 // correspondencia uno-a-uno con el recibo. No usar el precio del navegador.
 const trabajos=v.ficha?.trabajos;
 if(!Array.isArray(trabajos)||trabajos.length!==m.items.length)
  throw Error('La Central no dispone de todos los trabajos verificados.');
 for(const item of m.items){
  if(item.opciones?.servicio!=='ploteos')continue;
  const ficha=trabajos.find(t=>t.reciboPrivado===item.reciboPrivado);
  if(!ficha||ficha.servicio!=='ploteos'||
     ficha.sha256!==item.sha256||ficha.paginasOriginales!==item.paginas||
     !Array.isArray(ficha.planoPorPagina)||
     ficha.planoPorPagina.length!==item.paginas||
     ficha.planoPorPagina.some((p,i)=>p.numeroOriginal!==i+1||
      !['cad','poster'].includes(p.modo)||
      !/^(rollo|rec)\d+$/.test(p.rollo||'')||
      !['obra80','recubierto'].includes(p.papel))||
     ficha.copias!==item.opciones.copias||
     ficha.pdfImprimibleVerificado!==false)
   throw Error('El ploteo no coincide con la ficha verificada del servidor.');
 }
 // No aceptar total local como precio; ni rechazar una modificación legítima
 // de tarifa: la autoridad es la cotización comprobada por el servidor.
 return Object.freeze({
  schema:'saber-v2-manifiesto-servidor-conciliado-v1',
  orderId:v.orderId,cantidadArchivos:vistos.size,
  importeServidor:v.importeVerificado,
  totalOrientativoDescartado:true,
  verificacion:v,
  receiptsRecheckedByBackend:true,pricesRecalculatedByBackend:true,
  registeredInD1:false,checkoutEnabled:false,paymentAuthorized:false,
  listoParaProducir:false
 });
}
/** Conexión HMAC al endpoint de stage, sólo si se activó explícitamente
 * la sincronización privada y sin habilitar checkout ni producción.
 * Se exige la verificación de bytes/recibos ya efectuada por backend.
 */
export async function registrarManifiestoV2EnCentral({
 manifiesto,verificacion,env,
 enviar=enviarCentralFirmada
}){
 if(env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY')
  throw Error('Registro V2 en Central apagado.');
 const c=conciliarManifiestoV2ConServidor({manifiesto,verificacion});
 const outcome=await enviar({
  verificacion:c.verificacion,url:env.CENTRAL_TEST_URL,
  clave:env.CENTRAL_BRIDGE_KEY,habilitado:env.DOCS_CENTRAL_SYNC_ENABLED,
  service:env.SABER_CENTRAL
 });
 if(outcome?.ok!==true||outcome.webOrderId!==c.orderId||
    outcome.guardado!==true||outcome.paymentAuthorized!==false||
    outcome.listoParaProducir!==false)
  throw Error('La Central no confirmó el manifiesto V2.');
 return Object.freeze({
  schema:'saber-v2-recibos-central-registrados-v1',
  orderId:c.orderId,archivos:c.cantidadArchivos,importeServidor:c.importeServidor,
  registeredInD1:true,idempotent:Boolean(outcome.existia),
  checkoutEnabled:false,paymentAuthorized:false,listoParaProducir:false
 });
}
