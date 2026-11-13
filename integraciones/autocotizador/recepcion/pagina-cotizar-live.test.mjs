import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCotizarLive} from './pagina-cotizar-live.mjs';
const url='https://pedidos.libreriasaber.com.ar/cotizar';
const gate='GO_COMERCIAL_CONFIRMADO';
const env={SABER_ENTORNO:'produccion',DOCS_LIVE_UI_GATE:gate,
 DOCS_MP_LIVE_GATE:gate,DOCS_LIVE_SESSION_GATE:gate,
 DOCS_LIVE_TURNSTILE_SITE_KEY:'0x4AAAAABBBBBCCCCCDDDD123456789'};
test('ambas pantallas LIVE tienen enlace visible para volver a tienda, sin tocar el pago',async()=>{
 for(const authorized of [false,true]){
  const res=paginaCotizarLive(new Request(url),env,{authorized});
  assert.equal(res.status,200);
  const html=await res.text();
  assert.match(html,/<a class="volver-tienda" href="https:\/\/libreriasaber\.com\.ar\/">← Volver a la tienda<\/a>/);
  assert.match(html,/\.volver-tienda\{/);
  assert.doesNotMatch(html,/target="_blank"/);
 }
});
test('enlaces fotos y stickers preservan contexto en ingreso y en iframe, sin exponer parámetros ajenos',async()=>{
 for(const servicio of ['fotos','stickers']){
  const query='?servicio='+servicio;
  const entrada=paginaCotizarLive(new Request(url+query),env,{authorized:false});
  assert.equal(entrada.status,200);
  const intro=await entrada.text();
  assert.match(intro,new RegExp('location\\.replace\\(\\'/cotizar\\?servicio='+servicio+'\\'\\)'));
  assert.match(intro,servicio==='fotos'?/Cotizá tus fotos/:/Cotizá tus stickers/);
  const acceso=paginaCotizarLive(new Request(url+query),env,{authorized:true});
  assert.equal(acceso.status,200);
  const html=await acceso.text();
  assert.ok(html.includes('src="/cotizar/archivos?servicio='+servicio+'"'));
  assert.match(html,/id="precio-entrega"/);
  assert.match(html,/id="continuar"/);
 }
 const ajeno=await paginaCotizarLive(new Request(url+'?servicio=%3Cscript%3E'),env,{authorized:true}).text();
 assert.match(ajeno,/src="\/cotizar\/archivos"/);
 assert.doesNotMatch(ajeno,/<script>\s*<script>/);
});

test('sin gate ni host productivo el portal no se publica',()=>{
 for(const [where,patch] of [
  [url,{DOCS_LIVE_UI_GATE:'NO_GO'}],
  [url,{DOCS_MP_LIVE_GATE:'NO_GO'}],
  [url,{SABER_ENTORNO:'preparacion'}],
  ['https://saber-documentos-pruebas.workers.dev/cotizar',{}]
 ]){
  const result=paginaCotizarLive(new Request(where),{...env,...patch},{authorized:true});
  assert.equal(result.status,404);
 }
});
test('ingreso productivo exige Turnstile exclusivo del comprador',async()=>{
 const result=paginaCotizarLive(new Request(url),env,{authorized:false});
 assert.equal(result.status,200);
 const html=await result.text();
 assert.match(html,/saber_pedido_live/);
 assert.match(html,/\/api\/pedido\/live\/sesion/);
 assert.doesNotMatch(html,/prueba-v2|sandbox|MP_TEST/);
 assert.match(result.headers.get('Content-Security-Policy'),/challenges.cloudflare.com/);
});
test('portal autenticado reutiliza motor PDF pero no habilita pago sin recepción productiva',async()=>{
 const res=paginaCotizarLive(new Request(url),env,{authorized:true});
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/iframe id="pdf"/);
 assert.match(html,/src="\/cotizar\/archivos"/);
 assert.match(html,/import \{crearFlujoPresupuestoLive\} from '\/cotizar\/flujo-live.js'/);
 assert.match(html,/const enabled=false/);
 assert.doesNotMatch(html,/prueba-v2|ensayo-r2|pago de prueba/i);
});
test('recepción activa solo bajo gate LIVE exacto; la pantalla no acredita pagos',async()=>{
 const res=paginaCotizarLive(new Request(url),{
 ...env,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,
 DOCS_LIVE_ORDER_GATE:gate
 },{authorized:true});
 const html=await res.text();
 assert.match(html,/const enabled=true/);
 assert.match(html,/SABER_SMART_PREPARAR_ENVIO/);
 assert.match(html,/flow\.preparar\(\)/);
 assert.match(html,/flow\.iniciarPago\(\)/);
 assert.doesNotMatch(html,/uploadR2|sendOriginal|pagoAutorizado=true/);
});

test('la pantalla autenticada autoriza SOLO su propio módulo JS con nonce CSP',async()=>{
 const out=paginaCotizarLive(new Request(url),{
  ...env,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,
  DOCS_LIVE_ORDER_GATE:gate
 },{authorized:true});
 assert.equal(out.status,200);
 const html=await out.text();
 const tag=html.match(/<script type="module" nonce="([a-f0-9]{32})">/);
 assert.ok(tag,'MODULO_SIN_NONCE');
 const csp=out.headers.get('Content-Security-Policy');
 assert.ok(csp.includes("script-src 'self' 'nonce-"+tag[1]+"'"),'CSP_BLOQUEA_SCRIPT');
 assert.doesNotMatch(csp,/script-src[^;]*'unsafe-inline'/);
 assert.match(html,/crearFlujoPresupuestoLive/);
});


test('formulario comercial pide identidad completa sin ReferenceError y respeta CSP',async()=>{
 const res=paginaCotizarLive(new Request(url),{
  ...env,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,DOCS_LIVE_ORDER_GATE:gate
 },{authorized:true});
 const html=await res.text();
 assert.match(html,/id="nombre"[^>]*required/);
 assert.match(html,/id="telefono"[^>]*required/);
 assert.match(html,/id="direccion"[^>]*maxlength="180"/);
 const n=html.indexOf("const nombreCliente=document.getElementById('nombre');");
 const t=html.indexOf("const phone=document.getElementById('telefono');");
 const d=html.indexOf("const direccionCliente=document.getElementById('direccion');");
 const listener=html.indexOf("action.addEventListener('click'");
 assert.ok(n>0&&t>0&&d>0&&listener>Math.max(n,t,d),'contactos no declarados antes de ejecutar JS');
 assert.match(html,/\.\.\.pending,webOrderId:orderId\(\),telefono,nombre,direccion/);
 assert.match(html,/nombre\.length<2/);
 assert.match(html,/nombreCliente\.focus\(\)/);
 assert.match(html,/\[<>\]\/\.test\(nombre\)/);
 assert.match(html,/action\.disabled=!enabled/);
 const nonce=html.match(/<script type="module" nonce="([a-f0-9]{32})">/);
 assert.ok(nonce&&res.headers.get('Content-Security-Policy').includes("nonce-"+nonce[1]));
});

test('cotizador comercial prioriza precio, carga PDF JPG PNG y después identificación',async()=>{
 const res=paginaCotizarLive(new Request(url),{
  ...env,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,
  DOCS_LIVE_ORDER_GATE:gate
 },{authorized:true});
 const html=await res.text();
 const precio=html.indexOf('id="precio-entrega"');
 const carga=html.indexOf('id="pdf"');
 const nombre=html.indexOf('id="nombre"');
 const confirmar=html.indexOf('id="continuar"');
 assert.ok(precio>0&&precio<carga&&carga<nombre&&nombre<confirmar,
  'El cliente debe encontrar la carga antes de completar sus datos');
 assert.match(html,/PDF, JPG o PNG/);
 assert.match(html,/id="seccion-archivos"/);
 assert.match(html,/id="promo-dia"/);
 assert.match(html,/id="plazo-orientativo"/);
});

test('abrir enlace del cotizador con parámetros de origen no provoca 404',async()=>{
 for(const suffix of ['?utm_source=chatgpt.com','?utm_medium=referral','?ref=whatsapp']){
  const res=paginaCotizarLive(new Request(url+suffix),env,{authorized:false});
  assert.equal(res.status,200,'URL con parámetro '+suffix+' bloqueada');
  const html=await res.text();
  assert.match(html,/Cotizá tus impresiones y ploteos/);
  assert.match(html,/saber_pedido_live/);
  assert.doesNotMatch(html,/utm_source|utm_medium|ref=whatsapp/i);
 }
});

test('móvil: el iframe no tiene alto mínimo fijo ni desplazamiento anidado',async()=>{
 const response=paginaCotizarLive(new Request(url),env,{authorized:true});
 const html=await response.text();
 assert.match(html,/scrolling="no"/);
 assert.match(html,/SABER_SMART_RESIZE/);
 assert.match(html,/iframe\.style\.height=target\+'px'/);
 assert.match(html,/#pdf\{height:960px;min-height:0\}/);
 assert.match(html,/grid-template-columns:1fr/);
 assert.ok(html.indexOf('id="precio-entrega"')<html.indexOf('id="pdf"'));
 assert.ok(html.indexOf('id="pdf"')<html.indexOf('id="nombre"'));
});

test('el módulo JavaScript comercial generado compila con teléfonos argentinos',async()=>{
 const res=paginaCotizarLive(new Request(url),{
  ...env,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,
  DOCS_LIVE_ORDER_GATE:gate
 },{authorized:true});
 const html=await res.text();
 const match=html.match(/<script type="module" nonce="[a-f0-9]{32}">([\s\S]*?)<\/script>/);
 assert.ok(match,'Falta script comprador');
 const body=match[1].replace(/^\s*import[\s\S]*?;\s*/,'');
 assert.doesNotThrow(()=>new Function(body),'La pantalla tiene JS inválido y no responde a controles');
 assert.match(body,/\/\^\\\+\?\[0-9 \(\)-\]\{10,26\}\$\//);
 assert.match(body,/replace\(\/\\D\/g/);
});


test('transferencia LIVE ofrece Ya transferí y avisa al banco sin activar pago',async()=>{
 const res=paginaCotizarLive(new Request(url),{
  ...env,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,
  DOCS_LIVE_ORDER_GATE:gate,DOCS_LIVE_TRANSFER_GATE:gate,DOCS_LIVE_TUS_GATE:gate
 },{authorized:true});
 const html=await res.text();
 assert.match(html,/Ya transferí · Avisar a Librería Saber/);
 assert.match(html,/bankRequest\('notify'\)/);
 assert.match(html,/notice\.paymentVerified!==false/);
 assert.match(html,/notice\.uploadAuthorized!==false/);
 assert.match(html,/notice\.customerNotified!==true/);
 assert.match(html,/No se registró el aviso/);
 assert.doesNotMatch(html,/Ya transferí[^\n]*'pagado'/);
});

test('alias e importe bancario destacados, copia segura y aviso PDF grande',async()=>{
 const r=paginaCotizarLive(new Request(url),{
  ...env,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,
  DOCS_LIVE_ORDER_GATE:gate,DOCS_LIVE_TRANSFER_GATE:gate,DOCS_LIVE_TUS_GATE:gate
 },{authorized:true});
 const html=await r.text();
 assert.match(html,/className='transfer-box'/);
 assert.match(html,/className='transfer-alias'/);
 assert.match(html,/textContent=result\.alias/);
 assert.match(html,/navigator\.clipboard\.writeText\(result\.alias\)/);
 assert.match(html,/Copiar alias/);
 assert.match(html,/PDF pesados, mantené esta pestaña abierta/);
 assert.match(html,/NO acredita el pago automáticamente|Solo el personal confirma la acreditación bancaria/);
});
