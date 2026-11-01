import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {webcrypto,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {crearTandaTUS} from '../integraciones/autocotizador/recepcion/tus-pedido-contrato.mjs';
import {verificarTandaTUSYRecalcular} from '../integraciones/autocotizador/recepcion/tus-pedido-puente.mjs';
const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
async function quote(ancho,alto,seleccion,modo='bn',materialColor='obra70'){
 const pdf=await PDFDocument.create();
 for(let i=0;i<4;i++)pdf.addPage([ancho,alto]);
 const bytes=new Uint8Array(await pdf.save());
 const sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const id='WEB-ENSAYO-1234567890ABCDEF1234567890ABCDEF';
 const secret='test-secret-0123456789012345678901234567890';
 const signed=await crearTandaTUS({orderId:id,
  metas:[{fileId:'test1',name:'A5_original.pdf',mode:modo,bytes:bytes.length,sha256,pages:4}],
  secret,subtle:webcrypto.subtle,uuid:randomUUID,ahora:()=>1800000000,
  firmarSubida:async()=>('PRIVATE_TEST_'+randomUUID())});
 const receipt=signed.sessions[0];
 return verificarTandaTUSYRecalcular({
  orderId:id,entries:[{proof:receipt.proof,opciones:{
   servicio:'auto',seleccion,paginasSeleccionadas:'',copias:2,
   modo,caras:'double',paginasPorHoja:1,papelPoster:'obra80',
   anillado:'ninguno',grupoAnillado:'',materialColor,
   productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1
  }}],secret,preciosServidor:precios,ahora:()=>1800000001,subtle:webcrypto.subtle,
  leerObjetoPrivado:async()=>bytes
 });
}
test('A5 original: tarifa A4, tamaño final A5 y sin ampliación',async()=>{
 const [a5,a4]=await Promise.all([
  quote(419.53,595.28,'original'),quote(595.28,841.89,'a4')]);
 assert.equal(a5.verificacion.importeRecalculado,a4.verificacion.importeRecalculado);
 const t=a5.verificacion.ficha.trabajos[0];
 assert.equal(t.formatoFinal,'a5');
 assert.deepEqual(t.operaciones,['sin_escalado']);
 assert.equal(t.carasPresupuestadas,'double');
 assert.equal(t.copias,2);
 assert.equal(t.tipoAnillado,'ninguno');
 assert.equal(a5.verificacion.paymentAuthorized,false);
});
test('A5 original color usa papel A4 sin cambiar el formato',async()=>{
 const r=await quote(419.53,595.28,'original','color','obra70');
 assert.equal(r.verificacion.ficha.trabajos[0].formatoFinal,'a5');
 assert.equal(r.verificacion.ficha.trabajos[0].material,'obra70');
});
