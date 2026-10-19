import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {cotizarDocumentos} from '../integraciones/autocotizador/pruebas/cotizar-documentos.mjs';

const cfg=JSON.parse(await readFile(fileURLToPath(new URL('../precios-web.json',import.meta.url)),'utf-8'));
const colorId=cfg.colorA4.materials[0].id;
const files=[
 {id:'a',nombre:'Apunte1.pdf',paginas:12,modo:'bn',grupo:1,orden:1},
 {id:'b',nombre:'Apunte2.pdf',paginas:10,modo:'bn',grupo:0,orden:3},
 {id:'c',nombre:'Laminas.pdf',paginas:4,modo:'color',grupo:1,orden:2}
];
const base={archivos:files,copias:1,formato:'a4',caras:'simple',materialColor:colorId,anillado:'juntos',precios:cfg};
const juntos=cotizarDocumentos(base);
assert.equal(juntos.paginasPorEjemplar,26);
assert.equal(juntos.paginasBN,22);
assert.equal(juntos.paginasColor,4);
assert.equal(juntos.hojasPorEjemplar,26);
assert.equal(juntos.detalleAnillados.length,1);
assert.deepEqual(juntos.detalleAnillados[0].archivos,['a','c','b']);
assert.equal(juntos.cargoAnillado,2330);
assert.equal(juntos.total,juntos.subtotalBN+juntos.subtotalColor+juntos.cargoAnillado);

const separados=cotizarDocumentos({...base,anillado:'separados',copias:2});
assert.equal(separados.hojasTotales,52);
assert.equal(separados.detalleAnillados.length,3);
assert.equal(separados.cargoAnillado,3*2330*2);
assert.equal(separados.bnCantidad,44);
assert.equal(separados.colorCantidad,8);

const mixto=cotizarDocumentos({...base,anillado:'mixto',caras:'double'});
assert.equal(mixto.detalleAnillados.length,1);
assert.deepEqual(mixto.detalleAnillados[0].archivos,['a','c']);
assert.equal(mixto.detalleAnillados[0].hojasPorEjemplar,8); // 12/2 + 4/2
assert.equal(mixto.hojasTotales,13); // 6 + 5 + 2: sin mezclar reversos entre PDF

const sinAnillado=cotizarDocumentos({...base,anillado:'ninguno'});
assert.equal(sinAnillado.cargoAnillado,0);

const onlyBN=cotizarDocumentos({...base,archivos:[files[0]],anillado:'ninguno'});
assert.equal(onlyBN.colorCantidad,0);
assert.equal(onlyBN.total,onlyBN.subtotalBN);

function shouldReject(label,changes){
 assert.throws(()=>cotizarDocumentos({...base,...changes}),Error,label);
}
shouldReject('no files',{archivos:[]});
shouldReject('fractional copies',{copias:1.5});
shouldReject('zero copies',{copias:0});
shouldReject('wrong size',{formato:'a2'});
shouldReject('mixed page modes in single document',{archivos:[{...files[0],modo:'mixed'}]});
shouldReject('duplicate file IDs',{archivos:[files[0],files[0]]});
shouldReject('invalid pages',{archivos:[{...files[0],paginas:0}]});
shouldReject('too many binding sheets',{archivos:[{...files[0],paginas:500}],anillado:'juntos'});
shouldReject('invalid binding group',{archivos:[{...files[0],grupo:-1}],anillado:'mixto'});

console.log('OK: cálculo B/N y color por PDF, doble faz, copias, precios, grupos de anillado y errores controlados.');
