import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {consolidarPedidoVerificado} from '../integraciones/autocotizador/recepcion/consolidar-pedido-verificado.mjs';
import {prepararFichaCentral} from '../integraciones/autocotizador/recepcion/ficha-produccion-central.mjs';

const orderId='WEB-FASE1-SIN-CLIENTES';
const uuid=['DOC-12345678-1234-4234-8234-1234567890ab','DOC-87654321-1234-4234-8234-1234567890ab'];
const config=(name,id,extra={})=>({
 fileId:id,nombre:name,servicio:'auto',seleccion:'original',copias:1,
 modo:'bn',caras:'simple',papelPoster:'obra80',anillado:'ninguno',
 grupoAnillado:'',materialColor:'',paginasSeleccionadas:'',
 ...extra
});
const receipt=(name,id,metrics,index=0)=>({
 fileId:id,name,orderId,status:'verified',storageVerified:true,
 pageVerification:'server',receiptId:uuid[index],sha256:(index?'b':'a').repeat(64),
 bytes:1800,pageCount:metrics.length,pageMetrics:metrics
});
const metric=(w,h,modo)=>({anchoCm:w,altoCm:h,modo});
const run=(configs,receipts)=>consolidarPedidoVerificado({
 orderId,configuraciones:configs,recibosServidor:receipts,preciosServidor:precios
});

test('A0 clasificado CAD por el backend tiene cotizacion de ploteo sin pago autorizado',()=>{
 const c=config('plano.pdf','f1');
 const r=receipt('plano.pdf','f1',[metric(84.1,118.9,'cad')]);
 const x=run([c],[r]);
 assert.equal(x.estado,'ARCHIVOS_VERIFICADOS_SIN_PAGO');
 assert.equal(x.paymentAuthorized,false);
 assert.equal(x.cotizacion.plan[0].destino,'ploteos');
 assert.equal(x.cotizacion.plan[0].origen[0].anchoCm,84.1);
 assert.ok(x.importeRecalculado>0);
});
test('PDF A0 sin clasificacion verificable no obtiene precio inventado',()=>{
 const c=config('plano.pdf','f1');
 const r=receipt('plano.pdf','f1',[metric(84.1,118.9,'sin-clasificar')]);
 assert.throws(()=>run([c],[r]),/revisión|pendiente|cotizar/i);
});
test('medidas y clasificación elegidas en navegador no reemplazan las del recibo',()=>{
 const c={...config('plano.pdf','f1'),paginas:[metric(21,29.7,'poster')]};
 const r=receipt('plano.pdf','f1',[metric(84.1,118.9,'cad')]);
 const x=run([c],[r]);
 assert.equal(x.cotizacion.plan[0].origen[0].anchoCm,84.1);
 assert.equal(x.cotizacion.plan[0].destino,'ploteos');
});
test('dos PDFs A4 verificados permiten recalcular anillado agrupado sin pagos',()=>{
 const a=config('parte1.pdf','f1',{seleccion:'a4',anillado:'grupo',grupoAnillado:'1'});
 const b=config('parte2.pdf','f2',{seleccion:'a4',anillado:'grupo',grupoAnillado:'1'});
 const x=run([a,b],[
  receipt('parte1.pdf','f1',[metric(21,29.7,'sin-clasificar')]),
  receipt('parte2.pdf','f2',[metric(21,29.7,'sin-clasificar')],1)
 ]);
 assert.equal(x.paymentAuthorized,false);
 assert.equal(x.cotizacion.plan.length,2);
 assert.ok(x.importeRecalculado>0);
});

test('la ficha privada registra cada pagina CAD y su rollo automatico sin habilitar impresion',()=>{
 const c=config('plano.pdf','f1');
 const r=receipt('plano.pdf','f1',[metric(84.1,118.9,'cad')]);
 const pedido=run([c],[r]);
 const ficha=prepararFichaCentral({pedidoVerificado:pedido});
 assert.equal(ficha.pagoConfirmado,false);
 assert.equal(ficha.listoParaProducir,false);
 assert.equal(ficha.trabajos.length,1);
 const t=ficha.trabajos[0];
 assert.equal(t.servicio,'ploteos');
 assert.equal(t.planoPorPagina.length,1);
 assert.equal(t.planoPorPagina[0].numeroOriginal,1);
 assert.equal(t.planoPorPagina[0].modo,'cad');
 assert.match(t.planoPorPagina[0].rollo,/^rollo\\d+$/);
 assert.equal(t.planoPorPagina[0].papel,'obra80');
 assert.equal(t.pdfImprimibleVerificado,false);
});
test('el resumen de anillados verificado preserva el grupo en la ficha privada',()=>{
 const a=config('parte1.pdf','f1',{seleccion:'a4',anillado:'grupo',grupoAnillado:'1'});
 const b=config('parte2.pdf','f2',{seleccion:'a4',anillado:'grupo',grupoAnillado:'1'});
 const pedido=run([a,b],[
  receipt('parte1.pdf','f1',[metric(21,29.7,'sin-clasificar')]),
  receipt('parte2.pdf','f2',[metric(21,29.7,'sin-clasificar')],1)
 ]);
 const ficha=prepararFichaCentral({pedidoVerificado:pedido});
 assert.equal(ficha.trabajos.length,2);
 assert.equal(ficha.trabajos.every(t=>t.servicio==='documentos'),true);
 assert.equal(ficha.listoParaProducir,false);
 assert.ok(Array.isArray(ficha.gruposAnillado));
 assert.ok(ficha.gruposAnillado.length>0);
});
