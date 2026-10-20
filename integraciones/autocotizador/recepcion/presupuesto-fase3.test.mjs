import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cotizarDocumentos} from '../pruebas/cotizar-documentos.mjs';
import {prepararPresupuestoDocumentos} from '../pruebas/cotizacion-desde-recibos-servidor.mjs';
const price=JSON.parse(readFileSync(new URL('../../../precios-web.json',import.meta.url),'utf8'));
const receipt={
 orderId:'WEB-PILOTO-UN-PDF-20261020',
 fileId:'pdf-prueba',name:'pdf-prueba__ensayo.pdf',mode:'bn',
 status:'verified',verified:true,storageVerified:true,pageVerification:'server',
 pages:6,bytes:1024,sha256:'a'.repeat(64),
 receiptId:'DOC-da162bf3-5b63-48d5-81fe-0f20bd7d02d9',
 paymentAuthorized:false
};
const request={orderId:receipt.orderId,archivos:[{
 id:receipt.fileId,nombre:receipt.name,modo:receipt.mode,orden:1
}],copias:1,formato:'a4',caras:'simple',anillado:'ninguno',materialColor:'obra70'};
const quote=(s=request,r=receipt)=>prepararPresupuestoDocumentos({
 solicitud:s,recibosConfiables:[r],tarifasServidor:price
});
test('Seis páginas autorizadas por recibo Google: A4 simple',()=>{
 const x=quote();assert.equal(x.quote.paginasPorEjemplar,6);
 assert.equal(x.quote.total,6*100);assert.equal(x.pagesVerifiedBy,'server');
 assert.equal(x.paymentAuthorized,false);
 assert.equal(x.manifiesto.documentos[0].paginas,6);
});
test('Dos copias A4 doble faz y anillado con tarifa existente',()=>{
 const x=quote({...request,copias:2,caras:'double',anillado:'juntos'});
 assert.equal(x.quote.paginasPorEjemplar,6);
 assert.equal(x.quote.hojasTotales,6);
 assert.equal(x.quote.detalleAnillados.length,1);
 assert.equal(x.quote.total,12*80+2*2330);
 assert.equal(x.paymentAuthorized,false);
});
test('El cliente no puede alterar páginas, hash, orden, modo ni recibo',()=>{
 for(const [name,args] of [
  ['páginas del cliente',{s:{...request,archivos:[{...request.archivos[0],paginas:8}]}}],
  ['recibo sin validar',{r:{...receipt,status:'received'}}],
  ['recuento navegador',{r:{...receipt,pageVerification:'browser'}}],
  ['sin bytes comprobados',{r:{...receipt,storageVerified:false}}],
  ['SHA falso',{r:{...receipt,sha256:'0'}}],
  ['otro pedido',{r:{...receipt,orderId:'WEB-OTRO-PEDIDO'}}],
  ['nombre inventado',{s:{...request,archivos:[{...request.archivos[0],nombre:'otra-cosa.pdf'}]}}],
  ['duplicado',{s:{...request,archivos:[...request.archivos,...request.archivos]}}]
 ]) assert.throws(()=>quote(args.s||request,args.r||receipt),undefined,name);
});
test('Motor A3 y rangos: no admitir páginas sin validar ni pagos',()=>{
 const x=quote({...request,formato:'a3',copias:3});
 assert.equal(x.quote.archivos,1);
 assert.equal(x.quote.paginasPorEjemplar,6);
 assert.equal(x.paymentAuthorized,false);
});
