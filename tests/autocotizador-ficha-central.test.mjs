import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {consolidarPedidoVerificado} from '../integraciones/autocotizador/recepcion/consolidar-pedido-verificado.mjs';
import {prepararFichaCentral} from '../integraciones/autocotizador/recepcion/ficha-produccion-central.mjs';
const orderId='WEB-PEDIDO-ABCDEF';
const cfg=(fileId,nombre,servicio,productoGrafica='')=>({
 fileId,nombre,servicio,productoGrafica,productoFoto:'',
 seleccion:'a4',paginasSeleccionadas:'',copias:1,modo:'bn',caras:'simple',
 materialColor:'',papelPoster:'obra80',anillado:'ninguno',grupoAnillado:'',
 corteVariante:'gt3',corteMetros:1
});
const configs=[cfg('a01','adhesivo.pdf','stickers'),cfg('a02','tarjeta.pdf','grafica','tarjetas-0')];
const receipt=(fileId,name,n)=>({
 fileId,name,orderId,status:'verified',storageVerified:true,pageVerification:'server',
 receiptId:'DOC-'+(String(n).padStart(8,'0'))+'-1234-4234-8234-1234567890ab',
 sha256:String(n).repeat(64),bytes:1800,pageCount:1,
 pageMetrics:[{anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}]
});
const receipts=[receipt('a01','adhesivo.pdf',1),receipt('a02','tarjeta.pdf',2)];
const verificado=()=>consolidarPedidoVerificado({
 orderId,configuraciones:configs,recibosServidor:receipts,preciosServidor:precios
});
test('prepara ficha de producción con recibos y páginas verificadas, sin pago',()=>{
 const d=prepararFichaCentral({pedidoVerificado:verificado()});
 assert.equal(d.schema,'saber-central-ficha-produccion-v1');
 assert.equal(d.trabajos.length,2);
 assert.equal(d.totalVerificadoSinPago,21000);
 assert.deepEqual(d.trabajos.map(x=>x.servicio),['stickers','grafica']);
 assert.deepEqual(d.trabajos[0].paginasElegidas,[1]);
 assert.equal(d.trabajos[1].productoId,'tarjetas-0');
 assert.equal(d.trabajos[0].reciboPrivado,receipts[0].receiptId);
 assert.equal(d.listoParaProducir,false);
 assert.equal(d.pagoConfirmado,false);
 assert.ok(d.trabajos.every(x=>x.pdfImprimibleVerificado===false&&!x.descargaPrivadaHabilitada));
});
test('impide ficha sin pago pendiente, pedido alterado y páginas ajenas',()=>{
 const d=verificado();
 assert.throws(()=>prepararFichaCentral({pedidoVerificado:{...d,paymentAuthorized:true}}));
 assert.throws(()=>prepararFichaCentral({pedidoVerificado:{...d,importeRecalculado:10}}));
 assert.throws(()=>prepararFichaCentral({pedidoVerificado:{...d,cotizacion:{...d.cotizacion,plan:d.cotizacion.plan.map(x=>({...x,paginasElegidas:[99]}))}}}));
});
test('no permite que un SKU reemplace al identificador de un trabajo',()=>{
 const d=verificado();
 const alterado={...d,cotizacion:{...d.cotizacion,plan:d.cotizacion.plan.map(x=>x.destino==='grafica'?{...x,id:'tarjetas-0'}:x)}};
 assert.throws(()=>prepararFichaCentral({pedidoVerificado:alterado}),/desglose/);
});
