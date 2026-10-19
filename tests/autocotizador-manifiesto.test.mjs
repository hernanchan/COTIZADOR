import assert from 'node:assert/strict';
import {crearManifiestoDocumentos} from '../integraciones/autocotizador/pruebas/manifiesto-documentos.mjs';
const orderId='WEB-1042',sha256='a'.repeat(64);
const docs=[
 {id:'a',nombre:'Apunte 1.pdf',modo:'bn',paginas:12,orden:1,grupo:1},
 {id:'b',nombre:'Apunte 2.pdf',modo:'bn',paginas:10,orden:3,grupo:0},
 {id:'c',nombre:'Láminas.pdf',modo:'color',paginas:4,orden:2,grupo:1}
];
const receipts=docs.map(d=>({fileId:d.id,orderId,status:'verified',
 pages:d.paginas,receiptId:'verified-'+d.id,sha256,bytes:800}));
const args={orderId,archivos:docs,recibos:receipts,formato:'a4',caras:'simple',
 copias:1,anillado:'mixto',materialColor:'obra70'};
const m=crearManifiestoDocumentos(args);
assert.equal(m.status,'files_verified_pending_payment');
assert.equal(m.requiresBackendPaymentVerification,true);
assert.equal(m.paginasPorEjemplar,26);
assert.equal(m.hojasPorEjemplar,26);
assert.deepEqual(m.tandas.map(t=>t.modo),['bn','color']);
assert.deepEqual(m.tandas[0].documentos.map(d=>d.id),['a','b']);
assert.deepEqual(m.gruposAnillado[0].ordenArchivos,['a','c']);
assert.deepEqual(m.documentosSueltos,['b']);
assert.equal(m.gruposAnillado[0].hojasPorEjemplar,16);
const duplex=crearManifiestoDocumentos({...args,caras:'double'});
assert.equal(duplex.hojasPorEjemplar,13);
assert.equal(duplex.gruposAnillado[0].hojasPorEjemplar,8);
const separate=crearManifiestoDocumentos({...args,anillado:'separados',copias:2});
assert.equal(separate.gruposAnillado.length,3);
assert.equal(separate.documentosSueltos.length,0);
assert.deepEqual(separate.gruposAnillado.map(g=>g.ejemplares),[2,2,2]);
const allTogether=crearManifiestoDocumentos({...args,anillado:'juntos'});
assert.deepEqual(allTogether.gruposAnillado[0].ordenArchivos,['a','c','b']);
const none=crearManifiestoDocumentos({...args,anillado:'ninguno'});
assert.equal(none.gruposAnillado.length,0);
assert.deepEqual(none.documentosSueltos,['a','c','b']);
for(const bad of [
 {...args,recibos:receipts.map((r,i)=>i===0?{...r,pages:11}:r)},
 {...args,recibos:receipts.map((r,i)=>i===0?{...r,status:'pending'}:r)},
 {...args,recibos:receipts.map((r,i)=>i===0?{...r,sha256:'unknown'}:r)},
 {...args,orderId:'WEB-1043'},
 {...args,archivos:[docs[0],docs[0],docs[2]]},
 {...args,archivos:[{...docs[0],orden:2},docs[1],docs[2]]}
])assert.throws(()=>crearManifiestoDocumentos(bad),Error);
console.log('OK: 2 tandas + anillado mixto, separado, conjunto y bloqueos de recibos no verificados.');
