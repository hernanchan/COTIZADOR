import test from 'node:test';
import assert from 'node:assert/strict';
import prices from '../precios-web.json' with {type:'json'};
import {prepararPlanRecepcionUniversal,REGLAS_RECEPCION_UNIVERSAL} from
 '../integraciones/autocotizador/recepcion/plan-recepcion-universal-r2.mjs';

const MIB=1024*1024;
const tarifario={source:'private-d1-approved-only',revision:8,
 prices:{...prices,priceVersion:'d1-approved-revision-8'}};
const a4=(name='Apuntes.pdf')=>({
 nombre:name,paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
 seleccion:'original',servicio:'auto',copias:1,modo:'bn',caras:'simple',
 anillado:'ninguno',grupoAnillado:'',materialColor:'',
 papelPoster:'obra80'
});
const a3=(name='Planilla A3.pdf')=>({
 ...a4(name),paginas:[{numero:1,anchoCm:29.7,altoCm:42,modo:'sin-clasificar'}]
});
const plot=(name='Panel A1.pdf')=>({
 ...a4(name),paginas:[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}]
});
const manifest=(a,index,bytes)=>({
 fileId:'file_'+index,nombre:a.nombre,bytes,sha256:String(index).repeat(64)
});
const plan=(archivos,bytes=[])=>prepararPlanRecepcionUniversal({
 archivos,manifiestos:archivos.map((a,i)=>manifest(a,i+1,bytes[i])),tarifario
});
test('60 MiB A4 usa R2 aunque no sea plano ni poster',()=>{
 const r=plan([a4()],[60*MIB]);
 assert.equal(r.archivos[0].transporte,'r2');
 assert.equal(r.archivos[0].destino,'documentos');
 assert.equal(r.archivos[0].formatoFinal,'a4');
 assert.equal(r.filesUploaded,false);
 assert.equal(r.paymentAuthorized,false);
 assert.equal(r.productionAuthorized,false);
 assert.ok(r.totalArs>0);
});
test('A3 de 70 MiB usa la tarifa A3 pero transporte R2',()=>{
 const r=plan([a3()],[70*MIB]);
 assert.equal(r.archivos[0].destino,'documentos');
 assert.equal(r.archivos[0].formatoFinal,'a3');
 assert.equal(r.archivos[0].transporte,'r2');
});
test('ploteo A1 de 150 MiB conserva clasificación y ruta R2',()=>{
 const r=plan([plot()],[150*MIB]);
 assert.equal(r.archivos[0].destino,'ploteos');
 assert.equal(r.archivos[0].transporte,'r2');
 assert.ok(r.totalArs>0);
});
test('mismo pedido: documentos A4 60 MB + pequeño A4 + plano grande',()=>{
 const archivos=[a4('Apuntes grandes.pdf'),a4('Resumen pequeño.pdf'),plot('Panel A1.pdf')];
 const r=plan(archivos,[60*MIB,2*MIB,150*MIB]);
 assert.deepEqual(r.archivos.map(x=>x.transporte),['r2','tus','r2']);
 assert.deepEqual(r.archivos.map(x=>x.destino),['documentos','documentos','ploteos']);
 assert.equal(r.archivos.length,3);
 assert.equal(r.documentos,2);
 assert.equal(r.ploteos,1);
 assert.equal(new Set(r.archivos.map(x=>x.fileId)).size,3);
 assert.equal(r.requierePagoAntesDeR2,true);
 assert.equal(r.productionAuthorized,false);
});
test('frontera exacta: 40 MiB TUS, byte siguiente R2',()=>{
 const r=plan([a4('Pequeño.pdf'),a4('Grande.pdf')],[40*MIB,40*MIB+1]);
 assert.deepEqual(r.archivos.map(x=>x.transporte),['tus','r2']);
});
test('no fabrica pedido con todos TUS o lote TUS superior a 60 MiB',()=>{
 assert.throws(()=>plan([a4()],[40*MIB]),/SIN_ARCHIVOS_GRANDES/);
 assert.throws(()=>plan([
  a4('A.pdf'),a4('B.pdf'),a4('C.pdf')
 ],[40*MIB,40*MIB,80*MIB]),/LOTE_TUS_EXCEDIDO/);
});
test('precio aprobado D1 y clasificación íntegra son obligatorios',()=>{
 const archivos=[a4()],manifiestos=[manifest(archivos[0],1,60*MIB)];
 for(const bad of [undefined,{...tarifario,source:'local'},
  {...tarifario,prices:{...prices,priceVersion:'catalogo-local'}}]){
  assert.throws(()=>prepararPlanRecepcionUniversal({archivos,manifiestos,tarifario:bad}),
   /TARIFAS_NO_APROBADAS/);
 }
 assert.throws(()=>prepararPlanRecepcionUniversal({
  archivos,manifiestos:[{...manifiestos[0],sha256:'not-sha'}],tarifario
 }),/MANIFIESTO_INVALIDO/);
 assert.throws(()=>prepararPlanRecepcionUniversal({
  archivos,manifiestos:[{...manifiestos[0],nombre:'Archivo ajeno.pdf'}],tarifario
 }),/MANIFIESTO_INVALIDO/);
});
test('R2 no admite por el momento archivos mayores a 200 MiB',()=>{
 assert.equal(REGLAS_RECEPCION_UNIVERSAL.pdfR2MaxBytes,200*MIB);
 assert.throws(()=>plan([a4()],[200*MIB+1]),/TAMANO_FUERA_DE_LIMITE/);
});
test('un subtotal extra del navegador se ignora: prevalece precio D1 aprobado',()=>{
 const archivos=[a4()],manifiestos=[manifest(archivos[0],1,60*MIB)];
 const correcto=prepararPlanRecepcionUniversal({archivos,manifiestos,tarifario});
 const manipulado=prepararPlanRecepcionUniversal({
  archivos,manifiestos,tarifario,totalArs:1
 });
 assert.deepEqual(manipulado,correcto);
 assert.notEqual(manipulado.totalArs,1);
});
