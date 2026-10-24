import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cotizarLoteVerificado} from '../integraciones/autocotizador/pruebas/cotizacion-multifichero-piloto.mjs';

const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const receipt=i=>({
 ok:true,verified:true,storageVerified:true,status:'verified',
 pageVerification:'server',paymentAuthorized:false,
 receiptId:'DOC-'+String(i).padStart(8,'0')+'-aaaa-4aaa-8aaa-123456789012',
 orderId:'WEB-PRUEBA-LOTE-20261024',
 fileId:'pdf'+i,name:'doc'+i+'.pdf',mode:i%3===0?'color':'bn',
 bytes:2*1024*1024,sha256:i.toString(16).padStart(64,'0'),pages:2
});
const args={formato:'a4',caras:'simple',copias:1,anillado:'ninguno',
 precios,maxFiles:30,maxFileBytes:20*1024*1024,requireSharedOrder:true};
test('30 PDF de una misma compra se cotizan y el pago continúa apagado',()=>{
 const list=Array.from({length:30},(_,i)=>receipt(i+1));
 const q=cotizarLoteVerificado({...args,recibosVerificados:list});
 assert.equal(q.documentos.length,30);
 assert.equal(q.paginasVerificadas,60);
 assert.equal(q.receiptIds.length,30);
 assert.equal(q.paymentAuthorized,false);
 assert.ok(Number.isSafeInteger(q.total)&&q.total>0);
});
test('PDF de otro pedido, referencia de archivo repetida y cuota 31 se rechazan',()=>{
 const list=[receipt(1),receipt(2)];
 for(const changed of [
  {...receipt(2),orderId:'WEB-AJENO-LOTE-20261024'},
  {...receipt(2),fileId:'pdf1'},
  {...receipt(2),sha256:receipt(1).sha256}
 ]){
  assert.throws(()=>cotizarLoteVerificado({...args,recibosVerificados:[list[0],changed]}),/duplicados/);
 }
 assert.throws(()=>cotizarLoteVerificado({...args,
  recibosVerificados:Array.from({length:31},(_,i)=>receipt(i+1))}),/máximo/);
});
test('el piloto antiguo conserva exactamente el límite de cinco sesiones independientes',()=>{
 assert.throws(()=>cotizarLoteVerificado({formato:'a4',caras:'simple',copias:1,
  precios,recibosVerificados:Array.from({length:6},(_,i)=>({
   ...receipt(i+1),orderId:'WEB-ENSAYO-'+(i+1).toString(16).padStart(16,'0').toUpperCase(),
   bytes:500
  }))}),/entre uno y cinco/);
 assert.throws(()=>cotizarLoteVerificado({...args,maxFiles:30,
  maxFileBytes:1024*1024,recibosVerificados:[receipt(1)]}),/máximo|límite/);
});
