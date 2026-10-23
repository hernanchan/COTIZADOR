import test from 'node:test';
import assert from 'node:assert/strict';
import precios from '../precios-web.json' with {type:'json'};
import {consolidarPedidoVerificado} from '../integraciones/autocotizador/recepcion/consolidar-pedido-verificado.mjs';
const orderId='WEB-PEDIDO0123';
const line=(nombre,servicio,fileId,productoGrafica='')=>({
 fileId,nombre,servicio,productoGrafica,paginas:[{numero:1,anchoCm:1,altoCm:1,modo:'cad'}],
 paginasSeleccionadas:'',seleccion:'a4',copias:1,modo:'bn',caras:'simple',papelPoster:'obra80',
 materialColor:'',anillado:'ninguno',grupoAnillado:'',productoFoto:'',corteVariante:'gt3',corteMetros:1
});
const configs=[line('stickers.pdf','stickers','f1'),line('tarjeta.pdf','grafica','f2','tarjetas-0')];
const recibo=(fileId,name)=>({
 fileId,name,orderId,status:'verified',storageVerified:true,pageVerification:'server',
 receiptId:fileId==='f1'?'DOC-12345678-1234-4234-8234-1234567890ab':'DOC-87654321-1234-4234-8234-1234567890ab',
 sha256:'a'.repeat(64),bytes:1526,pageCount:1,
 pageMetrics:[{anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}]
});
const receipts=[recibo('f1','stickers.pdf'),recibo('f2','tarjeta.pdf')];
const run=(a=configs,r=receipts)=>consolidarPedidoVerificado({
 orderId,configuraciones:a,recibosServidor:r,preciosServidor:precios
});
test('dos archivos verificados se recalculan sin autorizar todavía pago',()=>{
 const d=run();
 assert.equal(d.importeRecalculado,21000);
 assert.equal(d.archivos.length,2);
 assert.equal(d.archivos[0].paginas,1);
 assert.equal(d.paymentAuthorized,false);
 assert.equal(d.cotizacion.paymentAuthorized,false);
 assert.equal(d.estado,'ARCHIVOS_VERIFICADOS_SIN_PAGO');
});
test('se rechazan recibos sin hash, sin confirmación de Drive y de otra orden',()=>{
 for(const campo of [{storageVerified:false},{sha256:'mal'},{orderId:'WEB-OTRO0000'},{pageVerification:'client'},{status:'dispatched'}]){
  assert.throws(()=>run(configs,[{...receipts[0],...campo},receipts[1]]));
 }
});
test('rechaza falta de medidas del PDF, archivo cambiado y recibos duplicados',()=>{
 assert.throws(()=>run(configs,[{...receipts[0],pageMetrics:[]},receipts[1]]));
 assert.throws(()=>run([{...configs[0],nombre:'otro.pdf'},configs[1]]));
 assert.throws(()=>run(configs,[receipts[0],receipts[0]]));
 assert.throws(()=>run(configs,[receipts[0],{...receipts[1],receiptId:receipts[0].receiptId}]));
});
test('recalcula dimensiones solo de recibos, no de los valores del navegador',()=>{
 const d=run();
 assert.equal(d.cotizacion.plan[0].origen[0].anchoCm,21);
 assert.equal(d.cotizacion.plan[0].origen[0].altoCm,29.7);
});
