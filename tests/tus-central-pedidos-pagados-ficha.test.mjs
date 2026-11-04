import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const src=readFileSync(new URL('../integraciones/mercadopago/pruebas/worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Request,Response,URL,URLSearchParams,TextEncoder,
 crypto:webcrypto,console,AbortSignal,fetch:()=>{throw Error('Network disabled in test')}});
vm.runInContext(src.replace('export default {','globalThis.worker = {'),ctx);
const html=vm.runInContext('adminHtml',ctx);
const client=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>'));
const paid=client.slice(client.indexOf('async function showOrder('),client.indexOf('function agregarFichaDeImpresion('));
const spec=client.slice(client.indexOf('function agregarFichaDeImpresion('),client.indexOf('async function showUnpaidDetails('));

test('paid-order Central JavaScript compiles with the complete operator print sheet',()=>{
 assert.ok(client.length>1000);
 new vm.Script(client);
 assert.match(paid,/documentosVerificados/);
 assert.match(paid,/PAGO VERIFICADO/);
 assert.match(paid,/d\.numeroOrden/);
  assert.ok(paid.includes('agregarFichaDeImpresion(line,t,{pagado:true,trabajos:d.documentos.trabajos});'));
 assert.match(paid,/Array\.isArray\(d\.trabajos\)/);
 assert.match(paid,/d\.trabajos\.length!==d\.archivos/);
});
test('paid-order downloads are restricted to operator-only private document worker',()=>{
 assert.match(paid,/d\.esTUS/);
 assert.match(paid,/personal-descargar/);
 assert.match(paid,/url\.searchParams\.set\("receiptId",t\.reciboPrivado\)/);
 assert.match(paid,/webOrderId/);
 assert.doesNotMatch(paid,/getPublicUrl|supabase\.co\/storage|service_role/i);
 assert.match(paid,/PDF final \/ imposición: PENDIENTE/);
});
test('paid print instructions never report an unverified print-ready PDF',()=>{
 assert.match(spec,/pagado=false/);
 assert.match(spec,/pagado\?"PEDIDO PAGADO Y VERIFICADO/);
 assert.match(spec,/NO IMPRIMIR SIN COMPROBAR ORIGINAL, ESCALA, PAPEL Y PDF FINAL/);
 assert.match(spec,/NO IMPRIMIR SIN PAGO CONFIRMADO Y VALIDACIÓN DE PRODUCCIÓN/);
 assert.match(spec,/NO CONSTA — verificar/);
 assert.match(spec,/Copiar instrucciones/);
  assert.ok(client.includes('agregarFichaDeImpresion(area,t,{trabajos:x.documentos.trabajos});'));
 assert.match(spec,/ANILLADO CONJUNTO/);
  assert.match(spec,/hojas físicas por anillado/);
  assert.match(src,/listoParaProducir:false/);
});
test('order API still requires paid order with verified D1 payment review',()=>{
 const section=src.slice(src.indexOf('if(url.pathname==="/admin/api/order"'),src.indexOf('if(url.pathname==="/demo/catalog"'));
 assert.match(section,/status='paid'/);
 assert.match(section,/state='verified'/);
 assert.match(section,/centralAdminDetail\(env,id\)/);
});
