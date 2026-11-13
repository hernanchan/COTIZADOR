import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaRetornoLive} from './pagina-retorno-live.mjs';
const host='https://pedidos.libreriasaber.com.ar/pedido/estado';
const on={SABER_ENTORNO:'produccion',DOCS_MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO'};
test('retorno cerrado no expone pagina ni consulta pagos',async()=>{
 for(const [url,env,method] of [
  [host,{...on,DOCS_MP_LIVE_GATE:'NO_GO'},'GET'],
  [host,{...on,SABER_ENTORNO:'preparacion'},'GET'],
  ['https://saber-documentos-pruebas.workers.dev/pedido/estado',on,'GET'],
  ['http://pedidos.libreriasaber.com.ar/pedido/estado',on,'GET'],
  [host,on,'POST']
 ]){
  const response=paginaRetornoLive(new Request(url,{method}),env);
  assert.equal(response.status,404);
 }
});
test('retorno LIVE no acredita pago por argumentos de Mercado Pago',async()=>{
 const r=paginaRetornoLive(new Request(host+'?status=approved&payment_id=123&merchant_order_id=777'),on);
 assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/Seguimiento de tu pedido/);
 assert.match(html,/Consultando pago y estado del trabajo en Librería Saber/);
 assert.match(html,/action:'status'/);
 assert.match(html,/credentials:'same-origin'/);
 assert.match(html,/uploadAuthorized===true/);
 assert.match(html,/response.status===401/);
 assert.match(html,/location.replace\('\/pedido\/continuar'\)/);
 assert.doesNotMatch(html,/\b123\b|\b777\b/);
 assert.equal(r.headers.get('Cache-Control'),'no-store, private');
 assert.match(r.headers.get('Content-Security-Policy'),/connect-src 'self'/);
});

test('retorno de pago incluye seguimiento real, orden y archivos pendientes sin admitir acreditación por URL',async()=>{
 const on={SABER_ENTORNO:'produccion',DOCS_MP_LIVE_GATE:'GO_COMERCIAL_CONFIRMADO',DOCS_LIVE_TUS_GATE:'GO_COMERCIAL_CONFIRMADO',DOCS_LIVE_RECEPCION_GATE:'GO_COMERCIAL_CONFIRMADO'};
 const response=paginaRetornoLive(new Request('https://pedidos.libreriasaber.com.ar/pedido/estado?status=approved&payment_id=9999'),on);
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/Seguimiento de tu pedido/);
 assert.match(html,/id="numeroPedido"/);
 assert.match(html,/id="estadoTrabajo"/);
 assert.match(html,/id="resumenArchivos"/);
 assert.match(html,/id="fechaRetiro"/);
 assert.match(html,/actualizarSeguimiento\(data\)/);
 assert.match(html,/setInterval\(\(\)=>\{if\(!document\.hidden\)void revisar\(\)\},15000\)/);
 assert.match(html,/\/api\/pedido\/live\/checkout/);
 assert.doesNotMatch(html,/searchParams\.get\('payment_id'\)/);
});

test('pospago automático: no pide otra selección y solo envía si acreditó el pago',async()=>{
 const response=paginaRetornoLive(new Request(host),on);
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/Recepción automática de originales/);
 assert.doesNotMatch(html,/type="file"/);
 assert.doesNotMatch(html,/Volvé a seleccionar|Seleccioná nuevamente|Enviar PDF después del pago/);
 assert.match(html,/leerOriginalesLive/);
 assert.match(html,/enviarPDFsTUSPagadosLive/);
 assert.match(html,/enviarPDFsR2PagadosLive/);
 assert.match(html,/data\.estado==='pagado_esperando_archivos'/);
 assert.match(html,/data\.uploadAuthorized===true/);
 assert.match(html,/bankPending/);
 assert.match(html,/t\.customerNotified===true/);
 assert.match(html,/setInterval/);
 assert.match(html,/borrarOriginalesLive/);
 assert.match(html,/no cierres esta pestaña|No cierres esta pestaña/);
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 assert.ok(script,'No se encontró JS de envío automático');
 assert.doesNotThrow(()=>new Function(script[1]),'JavaScript pospago inválido');
});

test('aviso permanente de no cerrar navegador durante la recepción postpago',async()=>{
 const r=paginaRetornoLive(new Request(host),on);
 const html=await r.text();
 assert.match(html,/id="aviso-subida"/);
 assert.match(html,/mantené esta pestaña abierta/);
 assert.match(html,/hasta que confirmemos «Archivo recibido»/);
 assert.match(html,/nunca vuelvas a pagar por el mismo pedido/);
});

test('seguimiento informa progreso real, reintento y recepción distinta de inspección R2',async()=>{
 const response=paginaRetornoLive(new Request(host),on);
 const html=await response.text();
 assert.match(html,/id="progreso-envio"/);
 assert.match(html,/id="porcentaje-envio"/);
 assert.match(html,/id="reintentar"/);
 assert.match(html,/retry\.addEventListener\('click'/);
 assert.match(html,/lastAutoAttempt=0/);
 assert.match(html,/showProgress\(p\.percent,p\.phase,'TUS'\)/);
 assert.match(html,/showProgress\(p\.batchPercent,p\.phase,'R2'\)/);
 assert.match(html,/Archivo recibido y verificado/);
 assert.match(html,/Librería Saber revisará el original y las instrucciones antes de imprimir/);
 assert.match(html,/const pendingR2=large\.some\(m=>!received\.has\(m\.fileId\)\)/);
 assert.doesNotMatch(html,/void flow\.iniciarPago\(\)/);
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Function(script[1]));
});
