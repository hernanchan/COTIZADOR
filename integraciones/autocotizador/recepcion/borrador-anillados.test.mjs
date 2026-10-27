import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararBorradorPedido} from './preparar-borrador-pedido.mjs';

const file=name=>Object.assign(new Blob(['%PDF-1.4'],{type:'application/pdf'}),{name});
const archivo=(name,formato='a4',copias=2)=>({
 file:file(name),name,paginas:[{numero:1}],copias,caras:'simple',
 anillado:'grupo',grupoAnillado:'1',formato
});
const cotizacion=()=>({
 ok:true,paymentAuthorized:false,verificacion:'PRELIMINAR_SIN_VERIFICAR',
 estado:'PRELIMINAR',pendientes:[],total:200,subtotalImpresiones:200,
 plan:[0,1].map(i=>({indice:i,destino:'documentos',id:'pdf'+(i+1),
  nombre:'apunte'+(i+1)+'.pdf',paginasElegidas:[1],formatoFinal:'a4'})),
 detalleImpresiones:[0,1].map(i=>({id:'pdf'+(i+1),
  nombre:'apunte'+(i+1)+'.pdf',subtotal:100}))
});
test('mantiene agrupación y orden sin autorizar pagos',()=>{
 const documentos=[archivo('apunte1.pdf'),archivo('apunte2.pdf')];
 const borrador=prepararBorradorPedido({cotizacion:cotizacion(),archivos:documentos});
 assert.deepEqual(borrador.gruposAnillado[0].ordenArchivos,['archivo-1','archivo-2']);
 assert.equal(borrador.items[0].grupoAnillado,'1');
 assert.equal(borrador.items[1].ordenArmado,2);
 assert.equal(borrador.paymentAuthorized,false);
 assert.equal(borrador.serverQuoteVerified,false);
});
test('rechaza un grupo con copias diferentes',()=>{
 const documentos=[archivo('apunte1.pdf'),archivo('apunte2.pdf','a4',3)];
 assert.throws(()=>prepararBorradorPedido({
  cotizacion:cotizacion(),archivos:documentos
 }),/incompatible/);
});
test('rechaza un grupo con un solo documento',()=>{
 const documentos=[archivo('apunte1.pdf'),archivo('apunte2.pdf')];
 documentos[1].anillado='ninguno';documentos[1].grupoAnillado='';
 assert.throws(()=>prepararBorradorPedido({
  cotizacion:cotizacion(),archivos:documentos
 }),/incompatible/);
});

test('conserva hojas físicas de imposición y rechaza discordancias con precio',()=>{
 const documentos=[archivo('apunte1.pdf'),archivo('apunte2.pdf')];
 documentos[0].paginasPorHoja=4;
 const quote=cotizacion();
 quote.plan[0].paginasPorHoja=4;
 quote.detalleImpresiones[0].paginasPorHoja=4;
 const borrador=prepararBorradorPedido({cotizacion:quote,archivos:documentos});
 assert.equal(borrador.items[0].paginasPorHoja,4);
 assert.equal(borrador.items[0].carasPorJuego,1);
 assert.equal(borrador.items[0].hojasPorJuego,1);
 assert.equal(borrador.paymentAuthorized,false);
 quote.detalleImpresiones[0].paginasPorHoja=1;
 assert.throws(()=>prepararBorradorPedido({cotizacion:quote,archivos:documentos}),
  /no coincide/);
});
