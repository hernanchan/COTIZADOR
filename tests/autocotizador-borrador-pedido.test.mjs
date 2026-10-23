import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';
import {prepararBorradorPedido} from '../integraciones/autocotizador/recepcion/preparar-borrador-pedido.mjs';

const pagina={numero:1,anchoCm:21,altoCm:29.7,modo:'cad'};
const archivo=(servicio,productoGrafica='')=>({
 nombre:servicio+'.pdf',paginas:[pagina],paginasSeleccionadas:'',
 seleccion:'a4',servicio,productoGrafica,copias:1,modo:'bn',caras:'simple',
 papelPoster:'obra80',materialColor:'',corteVariante:'gt3',corteMetros:1,productoFoto:'',anillado:'ninguno',grupoAnillado:''
});
function conFile(a){
 const blob=new Blob(['%PDF-1.4\nfoo. endobj'],{type:'application/pdf'});
 Object.defineProperty(blob,'name',{value:a.nombre,enumerable:true});
 return {file:blob,name:a.nombre,paginas:a.paginas,copias:a.copias};
}
test('revisión reúne stickers y tarjetas sin autorizar pago ni recepción',()=>{
 const archivos=[archivo('stickers'),archivo('grafica','tarjetas-0')];
 const cotizacion=cotizarCargaUnica({archivos,precios});
 const borrador=prepararBorradorPedido({cotizacion,archivos:archivos.map(conFile)});
 assert.equal(borrador.totalOrientativo,21000);
 assert.equal(borrador.cantidadArchivos,2);
 assert.deepEqual(borrador.items.map(x=>x.servicio),['stickers','grafica']);
 assert.ok(borrador.items.every(x=>x.estadoArchivo==='SIN_ENVIAR'&&x.verificacionServidor===false));
 assert.equal(borrador.paymentAuthorized,false);
 assert.equal(borrador.filesReceived,false);
 assert.equal(borrador.serverQuoteVerified,false);
});
test('bloquear borrador si falta original o se cambió el PDF',()=>{
 const archivos=[archivo('grafica','folletos-0')];
 const cotizacion=cotizarCargaUnica({archivos,precios});
 assert.throws(()=>prepararBorradorPedido({cotizacion,archivos:[{name:'folletos.pdf',paginas:[pagina],copias:1}]}),/original/i);
 const copia=conFile(archivos[0]);copia.name='distinto.pdf';
 assert.throws(()=>prepararBorradorPedido({cotizacion,archivos:[copia]}),/original/i);
});
test('rechazar precio alterado, líneas omitidas y páginas inválidas',()=>{
 const archivos=[archivo('stickers'),archivo('grafica','tarjetas-0')];
 const cotizacion=cotizarCargaUnica({archivos,precios});
 const files=archivos.map(conFile);
 assert.throws(()=>prepararBorradorPedido({cotizacion:{...cotizacion,total:1},archivos:files}),/suma/i);
 assert.throws(()=>prepararBorradorPedido({cotizacion:{...cotizacion,plan:cotizacion.plan.slice(0,1)},archivos:files}),/presupuestar/i);
 assert.throws(()=>prepararBorradorPedido({cotizacion:{...cotizacion,plan:cotizacion.plan.map(x=>({...x,paginasElegidas:[99]}))},archivos:files}),/páginas/i);
});
test('se rechaza intercambio de originales de dos trabajos',()=>{
 const archivos=[archivo('stickers'),archivo('grafica','tarjetas-0')];
 const cotizacion=cotizarCargaUnica({archivos,precios});
 const files=archivos.map(conFile);
 assert.throws(()=>prepararBorradorPedido({cotizacion,archivos:files.reverse()}),/original/i);
});
test('no se prepara pedido si un trabajo sigue pendiente',()=>{
 const archivos=[archivo('grafica','')];
 const cotizacion=cotizarCargaUnica({archivos,precios});
 assert.equal(cotizacion.total,null);
 assert.throws(()=>prepararBorradorPedido({cotizacion,archivos:archivos.map(conFile)}),/sin presupuestar/i);
});
