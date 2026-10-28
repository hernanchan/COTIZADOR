import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cotizarDocumentosIndividuales} from '../integraciones/autocotizador/pruebas/cotizar-documentos-individuales.mjs';

const prices=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const doc=(id,paginas,anillado,grupoAnillado='',copias=1,caras='double')=>({
 id,nombre:id+'.pdf',paginas,paginasPorHoja:1,copias,formato:'a4',
 modo:'bn',caras,anillado,grupoAnillado,materialColor:'estandar',orden:Number(id.slice(3))
});
test('12 páginas doble faz producen 6 hojas y 1 anillado individual de catálogo',()=>{
 const q=cotizarDocumentosIndividuales({archivos:[doc('pdf1',12,'individual')],precios});
 assert.equal(q.detalles[0].hojasPorJuego,6);
 assert.equal(q.subtotalAnillados,prices.bindings.a4[0].price);
 assert.equal(q.total,q.subtotalImpresiones+q.subtotalAnillados);
 assert.equal(q.paymentAuthorized,false);
});
test('dos PDF se anillan juntos por la suma de hojas y no cobran dos anillados',()=>{
 const q=cotizarDocumentosIndividuales({archivos:[
  doc('pdf1',12,'grupo','2'),doc('pdf2',8,'grupo','2')
 ],precios});
 assert.equal(q.detalleArmados.length,1);
 assert.equal(q.detalleArmados[0].hojasPorJuego,10);
 assert.deepEqual(q.detalleArmados[0].archivos,['pdf1','pdf2']);
 assert.equal(q.subtotalAnillados,prices.bindings.a4[0].price);
 assert.equal(q.total,q.subtotalImpresiones+q.subtotalAnillados);
});
test('no se cotiza grupo incompleto, copias inconsistentes ni exceso de capacidad',()=>{
 for(const files of [
  [doc('pdf1',12,'grupo','3')],
  [doc('pdf1',12,'grupo','3'),doc('pdf2',12,'grupo','3',2)],
  [doc('pdf1',500,'grupo','3'),doc('pdf2',500,'grupo','3')]
 ]){
  assert.throws(()=>cotizarDocumentosIndividuales({archivos:files,precios}));
 }
});
