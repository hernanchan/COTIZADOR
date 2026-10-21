import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cotizarLoteVerificado} from '../integraciones/autocotizador/pruebas/cotizacion-multifichero-piloto.mjs';

const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const receipt=(i,pages,mode='bn')=>({
 ok:true,verified:true,storageVerified:true,status:'verified',
 pageVerification:'server',paymentAuthorized:false,
 receiptId:'DOC-'+String(i).padStart(8,'0')+'-aaaa-4aaa-8aaa-123456789012',
 orderId:'WEB-ENSAYO-'+i.toString(16).padStart(16,'0').toUpperCase(),
 fileId:'documento',name:'archivo'+i+'.pdf',mode,bytes:500,
 sha256:i.toString(16).padStart(64,'0'),pages
});
const opts={formato:'a4',caras:'simple',copias:1,anillado:'ninguno',precios};
test('tres PDF independientes verifican y suman 100 impresiones para un solo descuento',()=>{
 const q=cotizarLoteVerificado({...opts,recibosVerificados:[receipt(1,20),receipt(2,30),receipt(3,50)]});
 assert.equal(q.paginasVerificadas,100);
 assert.equal(q.cantidadBN,100);
 assert.equal(q.precioUnitarioBN,76);
 assert.equal(q.total,7600);
 assert.equal(q.siguienteDescuentoBN.faltan,1);
 assert.equal(q.paymentAuthorized,false);
 assert.equal(q.receiptIds.length,3);
});
test('copias expanden el volumen; B/N y color se mantienen separados',()=>{
 const q=cotizarLoteVerificado({...opts,copias:2,recibosVerificados:[receipt(1,10),receipt(2,4,'color')]});
 assert.equal(q.cantidadBN,20);assert.equal(q.cantidadColor,8);
 assert.equal(q.precioUnitarioBN,84);
 assert.equal(q.precioUnitarioColor,200);
 assert.equal(q.total,20*84+8*200);
});
test('rechazar recibos duplicados, falsificados o aún sin verificación',()=>{
 const arr=[receipt(1,20),receipt(2,30)];
 assert.throws(()=>cotizarLoteVerificado({...opts,recibosVerificados:[arr[0],arr[0]]}),/duplicados/);
 assert.throws(()=>cotizarLoteVerificado({...opts,recibosVerificados:[arr[0],{...arr[1],verified:false}]}),/verificación/);
 assert.throws(()=>cotizarLoteVerificado({...opts,recibosVerificados:[{...arr[0],pages:0}]}),/verificación/);
 assert.throws(()=>cotizarLoteVerificado({...opts,recibosVerificados:[{...arr[0],paymentAuthorized:true}]}),/verificación/);
 assert.throws(()=>cotizarLoteVerificado({...opts,recibosVerificados:[...arr,...arr,...arr].slice(0,6)}),/entre uno y cinco/);
});
test('anillados juntos y separados cobran grupos diferentes',()=>{
 const arr=[receipt(1,20),receipt(2,30)];
 const juntos=cotizarLoteVerificado({...opts,anillado:'juntos',recibosVerificados:arr});
 const separados=cotizarLoteVerificado({...opts,anillado:'separados',recibosVerificados:arr});
 assert.equal(juntos.anillados,2330);
 assert.equal(separados.anillados,4660);
});
