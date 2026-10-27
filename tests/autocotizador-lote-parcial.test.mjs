import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararLoteParcial,recomponerLoteParcial}
 from '../integraciones/autocotizador/recepcion/cotizar-lote-parcial.mjs';

const entrada=(name='PDF.pdf')=>({
 name,paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
 paginasSeleccionadas:'',seleccion:'a4',servicio:'auto',
 productoFoto:'',productoGrafica:'',corteVariante:'gt3',corteMetros:1,
 copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',
 anillado:'ninguno',grupoAnillado:'',materialColor:''
});
const resultado={
 ok:true,estado:'PRELIMINAR',paymentAuthorized:false,total:2800,
 subtotalImpresiones:2800,plan:[
  {indice:0,destino:'documentos',id:'pdf1'},
  {indice:1,destino:'documentos',id:'pdf2'}
 ],pendientes:[],detalleImpresiones:[
  {id:'pdf1',subtotal:1400},{id:'pdf2',subtotal:1400}
 ]
};

test('un PDF ilegible no elimina los presupuestos de otros documentos',()=>{
 const entries=[
  entrada('uno.pdf'),{name:'escaneo_malformado.pdf',paginas:null,error:'Lectura PDF fallida'},
  entrada('tres.pdf')
 ];
 const lote=prepararLoteParcial(entries);
 assert.deepEqual(lote.indices,[0,2]);
 assert.deepEqual(lote.archivos.map(e=>e.nombre),['uno.pdf','tres.pdf']);
 const final=recomponerLoteParcial(resultado,lote);
 assert.equal(final.estado,'INCOMPLETO');
 assert.equal(final.total,null);
 assert.equal(final.subtotalCalculable,2800);
 assert.equal(final.paymentAuthorized,false);
 assert.deepEqual(final.plan.map(e=>e.indice),[0,2]);
 assert.equal(final.pendientes[0].nombre,'escaneo_malformado.pdf');
 assert.equal(final.pendientes[0].indice,1);
});

test('lote sin errores conserva total y posición de todos los archivos',()=>{
 const lote=prepararLoteParcial([entrada('uno.pdf'),entrada('dos.pdf')]);
 const final=recomponerLoteParcial(resultado,lote);
 assert.deepEqual(final.plan.map(e=>e.indice),[0,1]);
 assert.equal(final.estado,'PRELIMINAR');
 assert.equal(final.total,2800);
 assert.equal(final.contieneArchivosSinAnalizar,false);
 assert.equal(final.subtotalCalculable,null);
});

test('error inicial y pendientes del backend preservan indices',()=>{
 const entries=[
  {name:'fallo.pdf',error:'No se puede abrir',paginas:null},
  entrada('uno.pdf'),entrada('dos.pdf')
 ];
 const lote=prepararLoteParcial(entries);
 const response={...resultado,total:null,estado:'INCOMPLETO',
  plan:[{indice:0,id:'pdf1',destino:'documentos'}],
  pendientes:[{indice:1,nombre:'dos.pdf',motivo:'Confirmar tamaño final'}]};
 const final=recomponerLoteParcial(response,lote);
 assert.equal(final.total,null);
 assert.deepEqual(final.plan.map(x=>x.indice),[1]);
 assert.deepEqual(final.pendientes.map(x=>x.indice),[2,0]);
 assert.equal(final.subtotalCalculable,null);
});

test('no permitir indices falsos del servidor',()=>{
 const lote=prepararLoteParcial([entrada('único.pdf')]);
 assert.throws(()=>recomponerLoteParcial({...resultado,plan:[{indice:5}],pendientes:[]},lote),
  /Índice de cotización inesperado/);
});

test('el límite sigue siendo de 30 PDF',()=>{
 assert.throws(()=>prepararLoteParcial(Array.from({length:31},()=>entrada())),/Lote inválido/);
});
