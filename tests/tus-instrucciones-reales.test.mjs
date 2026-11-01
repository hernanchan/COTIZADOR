import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomUUID,webcrypto} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {crearTandaTUS} from '../integraciones/autocotizador/recepcion/tus-pedido-contrato.mjs';
import {verificarTandaTUSYRecalcular} from '../integraciones/autocotizador/recepcion/tus-pedido-puente.mjs';

const ORDER='WEB-ENSAYO-ABCDEF0123456789ABCDEF0123456789';
const SECRET='tus-test-secret-private-only-'+('a'.repeat(32));
const prices=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const rawCentral=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console});
vm.runInContext(rawCentral.replace('export default {','globalThis.worker = {'),ctx);
const normalize=vm.runInContext('centralSafeManifest',ctx);

async function fakePDF(pages,width,height){
 const d=await PDFDocument.create();
 for(let i=0;i<pages;i++)d.addPage([width,height]);
 const bytes=new Uint8Array(await d.save());
 const sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
 return {bytes,sha256,pages};
}
async function verificarCasos(casos){
 const docs=await Promise.all(casos.map(async (spec,i)=>{
  const pdf=await fakePDF(spec.paginas,spec.ancho,spec.alto);
  return {fileId:'test-'+(i+1),name:'OtroPDF'+(i+1)+'.pdf',
   mode:spec.modo,bytes:pdf.bytes.length,sha256:pdf.sha256,pages:pdf.pages,
   data:pdf.bytes,opciones:{
    servicio:'auto',seleccion:spec.formato,paginasSeleccionadas:'',
    copias:spec.copias,modo:spec.modo,caras:spec.caras,
    paginasPorHoja:spec.nup,papelPoster:'obra80',
    anillado:spec.anillado,grupoAnillado:'',materialColor:spec.papel,
    productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1
   }};
 }));
 const signed=await crearTandaTUS({
  orderId:ORDER,
  metas:docs.map(({fileId,name,mode,bytes,sha256,pages})=>({fileId,name,mode,bytes,sha256,pages})),
  secret:SECRET,subtle:webcrypto.subtle,
  uuid:randomUUID,ahora:()=>1800000000,firmarSubida:async()=>('SIGNED_PRIVATE_'+randomUUID())
 });
 const byStorage=new Map(signed.sessions.map((s,i)=>[s.objectName,docs[i].data]));
 const entries=signed.sessions.map((s,i)=>({proof:s.proof,opciones:docs[i].opciones}));
 const checked=await verificarTandaTUSYRecalcular({
  orderId:ORDER,entries,secret:SECRET,preciosServidor:prices,
  ahora:()=>1800000001,subtle:webcrypto.subtle,
  leerObjetoPrivado:async (name)=>byStorage.get(name)
 });
 const normalized=normalize(checked.verificacion);
 return {checked,normalized};
}
test('dos PDF distintos: A4 B/N doble faz y anillado; A3 color simple sin anillado',async()=>{
 const result=await verificarCasos([
  {paginas:4,ancho:595.28,alto:841.89,formato:'a4',modo:'bn',caras:'double',
   copias:2,nup:1,anillado:'individual',papel:'obra70'},
  {paginas:3,ancho:841.89,alto:1190.55,formato:'a3',modo:'color',caras:'simple',
   copias:1,nup:1,anillado:'ninguno',papel:'a3_color_obra80'}
 ]);
 assert.equal(result.checked.verificacion.ficha.trabajos.length,2);
 const [a,b]=result.normalized.trabajos;
 const required=['formatoFinal','modo','carasPresupuestadas','paginasPorCaraPresupuestadas',
  'copias','material','tipoAnillado'];
 for(const t of [a,b]){
  for(const name of required)assert.notEqual(t[name],null,name);
  assert.deepEqual(Array.from(t.paginasElegidas),Array.from({length:t.paginasOriginales},(_,i)=>i+1));
 }
 assert.equal(a.formatoFinal,'a4');
 assert.equal(a.modo,'bn');assert.equal(a.carasPresupuestadas,'double');
 assert.equal(a.copias,2);assert.equal(a.material,'estandar');
 assert.equal(a.tipoAnillado,'individual');
 assert.equal(b.formatoFinal,'a3');assert.equal(b.modo,'color');
 assert.equal(b.carasPresupuestadas,'simple');assert.equal(b.copias,1);
 assert.equal(b.material,'a3_color_obra80');
 assert.equal(b.tipoAnillado,'ninguno');
 assert.equal(result.normalized.pagoConfirmado,false);
 assert.equal(result.normalized.listoParaProducir,false);
});
test('otro PDF A4 color con 2 páginas por cara conserva el papel exacto sin perder opciones',async()=>{
 const x=await verificarCasos([{paginas:4,ancho:595.28,alto:841.89,
  formato:'a4',modo:'color',caras:'double',copias:1,nup:2,
  anillado:'ninguno',papel:'obra140'}]);
 const [t]=x.normalized.trabajos;
 assert.equal(t.paginasPorCaraPresupuestadas,2);
 assert.equal(t.material,'obra140');
 assert.equal(t.carasPresupuestadas,'double');
 assert.equal(t.tipoAnillado,'ninguno');
});
test('historico sin instrucciones conserva NO CONSTA en vez de falsear anillado',async()=>{
 const x=await verificarCasos([{paginas:2,ancho:595.28,alto:841.89,
  formato:'a4',modo:'bn',caras:'simple',copias:1,nup:1,
  anillado:'ninguno',papel:'obra70'}]);
 const copy=JSON.parse(JSON.stringify(x.checked.verificacion));
 delete copy.ficha.trabajos[0].tipoAnillado;
 const legacy=normalize(copy);
 assert.equal(legacy.trabajos[0].tipoAnillado,null);
});
