import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fichaPrearchivoUniversal} from './ficha-prearchivo-universal.mjs';
import {verificarFichaUniversal} from '../../mercadopago/pruebas/r2-lote-universal-central.mjs';
import {cotizarCargaUnica} from './cotizar-carga-unica.mjs';
import {cotizarDocumentosIndividuales} from '../pruebas/cotizar-documentos-individuales.mjs';
const precios=JSON.parse(readFileSync(new URL('../../../precios-web.json',import.meta.url),'utf8'));
const file=(w,h,modo='bn',materialColor='obra70',sel='original')=>({
 nombre:'original.pdf',servicio:'auto',seleccion:sel,
 paginas:Array.from({length:114},(_,i)=>({numero:i+1,anchoCm:w,altoCm:h,modo:'sin-clasificar'})),
 modo,caras:'simple',copias:1,materialColor,anillado:'ninguno',grupoAnillado:'',papelPoster:'obra80'
});
const quote=a=>cotizarCargaUnica({archivos:[a],precios,promociones:{codes:[]},ahora:Date.UTC(2026,10,12,12)});
test('Legal 21,59 × 35,56 cm se conserva sin escala y cuesta igual que A4 B/N',()=>{
 const legal=quote(file(21.59,35.56));
 const a4=quote(file(21,29.7));
 assert.equal(legal.estado,'PRELIMINAR');
 assert.equal(legal.total,a4.total);
 assert.equal(legal.detalleImpresiones[0].formato,'legal');
 assert.equal(legal.plan[0].formatoFinal,'legal');
 assert.equal(legal.plan[0].tarifaAplicada,'a4');
 assert.equal(legal.plan[0].ajuste,'sin_escalado');
 assert.equal(legal.plan[0].origen[0].anchoCm,21.59);
 assert.equal(legal.plan[0].origen[0].altoCm,35.56);
 assert.ok(legal.total>0);
});
test('Legal rotado color obra70 mantiene el mismo precio que A4 color obra70',()=>{
 const legal=quote(file(35.56,21.59,'color','obra70'));
 const a4=quote(file(21,29.7,'color','obra70'));
 assert.equal(legal.estado,'PRELIMINAR');
 assert.equal(legal.total,a4.total);
 assert.equal(legal.detalleImpresiones[0].formato,'legal');
 assert.equal(legal.plan[0].ajuste,'sin_escalado');
});
test('Legal no aplica automáticamente tarifa de 70g a papeles de color especiales',()=>{
 const legal=quote(file(21.59,35.56,'color','fotografico'));
 assert.equal(legal.estado,'INCOMPLETO');
 assert.equal(legal.total,null);
 assert.match(legal.pendientes[0].motivo,/Legal.*70 g/);
});
test('Legal conserva escala A4 también para doble faz y anillado individual',()=>{
 const c=(fmt,modo)=>cotizarDocumentosIndividuales({
  archivos:[{id:'pdf1',nombre:'test.pdf',paginas:114,formato:fmt,modo,
   materialColor:'obra70',caras:'double',copias:1,anillado:'individual',grupoAnillado:'',orden:1}],
  precios
 });
 for(const modo of ['bn','color']){
  const a4=c('a4',modo),legal=c('legal',modo);
  assert.equal(legal.total,a4.total);
  assert.equal(legal.detalles[0].formato,'legal');
  assert.equal(legal.detalles[0].hojasPorJuego,57);
 }
});
test('no confundir Legal original con ploteo, A3 ni tamaño grande arbitrario',()=>{
 const a3=quote(file(29.7,42));
 assert.equal(a3.plan[0].formatoFinal,'a3');
 const other=quote(file(21.59,37.2));
 assert.equal(other.estado,'INCOMPLETO');
 assert.equal(other.total,null);
});
test('D1 acepta ficha Legal original de 48MiB firmada con precio A4 obra70',async()=>{
 const webOrderId='WEB-ENSAYO-'+'A'.repeat(32);
 const archivo=file(21.59,35.56,'color','obra70');
 const sha256='b'.repeat(64);
 const manifiestos=[{fileId:'pdf_0_abcdef1234',nombre:archivo.nombre,bytes:49823112,sha256}];
 const tarifario={prices:{...precios,priceVersion:'d1-approved-revision-3'},
  promotions:{codes:[]}};
 const ficha=fichaPrearchivoUniversal({webOrderId,archivos:[archivo],
  manifiestos,tarifario,produccion:true,ahora:Date.UTC(2026,10,12,12)});
 assert.equal(ficha.archivos[0].formatoFinal,'legal');
 assert.equal(ficha.archivos[0].transporte,'r2');
 assert.equal(ficha.archivos[0].configuracion.seleccion,'original');
 assert.equal(ficha.archivos[0].importeArs,quote(archivo).total);
 const quoteHash=createHash('sha256').update(JSON.stringify(ficha)).digest('hex');
 const received=await verificarFichaUniversal({...ficha,quoteHash});
 assert.equal(received.totalArs,ficha.totalArs);
 assert.equal(received.archivos[0].formatoFinal,'legal');
});
