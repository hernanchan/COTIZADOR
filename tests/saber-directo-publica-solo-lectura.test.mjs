import test from 'node:test';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararVistaDisenoAbierta} from '../integraciones/autocotizador/recepcion/saber-directo-vista-previa.mjs';

const home=readFileSync(new URL('../vidriera/index.html',import.meta.url),'utf8');
const offers=readFileSync(new URL('../vidriera/ofertas.html',import.meta.url),'utf8');
const withoutScripts=html=>html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi,'');
for (const [name,html] of [['portada',home],['ofertas',offers]]){
 test('Diseño abierto sanitiza completamente JS, datos sensibles y enlaces de '+name,()=>{
  const rendered=prepararVistaDisenoAbierta(html,{ofertas:name==='ofertas'});
  assert.match(rendered,/VISTA DE DISEÑO · SIN CONTRASEÑA/);
  assert.match(rendered,/noindex,nofollow,noarchive/);
  assert.doesNotMatch(rendered,/localStorage|sendWhatsApp|productsCsvUrl|libreriasaber\.mp|20-22792046|MercadoPago|MP_TEST_ACCESS_TOKEN/);
  assert.doesNotMatch(rendered,/href="https:\/\/wa\.me\//);
  assert.doesNotMatch(rendered,/onclick=|onerror=/i);
  assert.doesNotMatch(rendered,/href="cotizar\.html"/);
  if(name==='portada'){
   assert.doesNotMatch(rendered,/href="https:\/\/libreriasaber\.com\.ar\/cotizar"/);
   assert.match(rendered,/Acceso del personal/);
   assert.match(rendered,/href="\/prueba-v2\/cotizar-cliente"/);
   assert.match(rendered,/los artículos y los trabajos de impresión se consultan por separado/i);
   assert.doesNotMatch(rendered,/El trabajo vuelve automáticamente a este carrito/);
  }
  if(name==='portada')assert.match(rendered,/href="#preview-aviso"/);
  else assert.match(rendered,/href="\/prueba-v2\/diseno-sin-clave"/);
  assert.match(rendered,/class="brand"/);
  if(name==='ofertas'){
    assert.equal((withoutScripts(rendered).match(/class="v3-sample-offer"/g)||[]).length,2);
    assert.match(rendered,/Resaltador Filgo x 4 pastel/);
    assert.match(rendered,/planilla MODELO/);
    assert.match(rendered,/drive\.google\.com\/thumbnail\?id=/);
  }
  if(name==='portada')assert.match(rendered,/href="\/prueba-v2\/diseno-sin-clave\/ofertas\.html\?categoria=/);
  else assert.match(rendered,/href="\/prueba-v2\/diseno-sin-clave#categorias"/);
 });
}
const workerSrc=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
test('Rutas públicas de diseño y solo lectura; CSP limita conexiones al propio origen',()=>{
 assert.match(workerSrc,/if\(page==='\/prueba-v2\/diseno-sin-clave'\|\|page==='\/prueba-v2\/diseno-sin-clave\/ofertas.html'\)/);
 assert.match(workerSrc,/connect-src 'self'/);
 assert.match(workerSrc,/if\(page==='\/prueba-v2\/diseno-sin-clave\/catalogo\.json'\)/);
 assert.match(workerSrc,/method!=='GET'/);
 assert.match(workerSrc,/form-action 'none'/);
 assert.match(workerSrc,/img-src https:\/\/cdn\.jsdelivr\.net https:\/\/drive\.google\.com https:\/\/\*\.googleusercontent\.com https:\/\/images\.unsplash\.com data:/);
 assert.match(workerSrc,/page==='\/prueba-v2\/'\|\|page==='\/prueba-v2\/orden-paquete'/);
});

test('Planilla modelo: categorías, fotos públicas y sin descuentos ficticios',()=>{
 const escolar=prepararVistaDisenoAbierta(offers,{ofertas:true,categoria:'Escolar'});
 const oficina=prepararVistaDisenoAbierta(offers,{ofertas:true,categoria:'Oficina'});
 const novedades=prepararVistaDisenoAbierta(offers,{ofertas:true,categoria:'Novedades'});
 assert.equal((withoutScripts(escolar).match(/class="v3-sample-offer"/g)||[]).length,3);
 assert.match(escolar,/Resaltador Filgo x 4 pastel/);
 assert.match(oficina,/Resma A4 P AMPA 70 g/);
 assert.doesNotMatch(withoutScripts(oficina),/<del>/);
 assert.doesNotMatch(withoutScripts(novedades),/class="v3-sample-offer"/);
 assert.match(novedades,/no tiene artículos activos/);
 const portada=prepararVistaDisenoAbierta(home);
 assert.match(portada,/Resaltador Filgo x 4 pastel/);
 assert.match(portada,/Resma A4 P AMPA 70 g/);
 assert.doesNotMatch(portada,/Kit Sharpie Lettering/);
 assert.doesNotMatch(portada,/sendWhatsApp|productsCsvUrl|libreriasaber\.mp/);
});

test('Carrito visible en la muestra, independiente de compras y pedidos reales',()=>{
 for(const [html,opts] of [[home,{}],[offers,{ofertas:true,categoria:'Escolar'}]]){
  const rendered=prepararVistaDisenoAbierta(html,opts);
  assert.match(rendered,/data-demo-open/);
  assert.match(rendered,/data-demo-drawer/);
  assert.match(rendered,/data-demo-add="ESC001"/);
  assert.match(rendered,/data-demo-total/);
  assert.match(rendered,/data-demo-step/);
  assert.match(rendered,/sessionStorage/);
  assert.match(rendered,/data-demo-whatsapp hidden/);
  assert.match(rendered,/Abrir WhatsApp para consultar/);
  assert.match(rendered,/\/prueba-v2\/diseno-sin-clave\/catalogo\.json/);
  assert.doesNotMatch(rendered,/XMLHttpRequest|sendWhatsApp|payments\/|MercadoPago|localStorage/);
 }
});

test('Ensayo prepara resumen de compra sin enviar mensajes, pagos ni pedidos',()=>{
 const rendered=prepararVistaDisenoAbierta(home);
 assert.match(rendered,/Preparar pedido para WhatsApp \(prueba\)/);
 assert.match(rendered,/data-demo-preview disabled/);
 assert.match(rendered,/data-demo-summary hidden/);
 assert.match(rendered,/TOTAL ORIENTATIVO/);
 assert.match(rendered,/confirman disponibilidad y precio final/);
 assert.match(rendered,/Abrir WhatsApp para consultar/);
 assert.match(rendered,/revalidación|refresh\(\)/);
 assert.match(rendered,/fetch\(path,\{method:'GET'/);
 assert.doesNotMatch(rendered,/href="https:\/\/wa\.me\/|sendWhatsApp|MercadoPago|XMLHttpRequest/);
});

test('El JavaScript efectivamente emitido a la vista no tiene errores de sintaxis',()=>{
 for(const [html,opts] of [[home,{}],[offers,{ofertas:true,categoria:'Escolar'}]]){
  const rendered=prepararVistaDisenoAbierta(html,opts);
  const scripts=[...rendered.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.ok(scripts.length>0,'La maqueta debe incluir el script de carrito');
  for(const source of scripts)assert.doesNotThrow(()=>new Script(source));
 }
});

test('El usuario debe consultar precios nuevos antes de abrir WhatsApp (sin pago ni pedido)',()=>{
 const r=prepararVistaDisenoAbierta(home);
 assert.match(r,/async function prepare\(\)/);
 assert.match(r,/try\{await refresh\(\)\}/);
 assert.match(r,/data-demo-whatsapp hidden/);
 assert.match(r,/confirmar disponibilidad y precio final/);
 assert.match(r,/https:\/\/wa\.me\/5493513110130/);
 assert.match(r,/Date\.now\(\)-validatedAt>60000/);
 assert.doesNotMatch(r,/form action=|enviarPago|createPreference|MP_TEST_ACCESS_TOKEN/);
});


test('V3 enlaza el mismo TUS sólo si el portal comprador está habilitado',()=>{
 const enabled=prepararVistaDisenoAbierta(home,{pedidoTUS:true});
 const disabled=prepararVistaDisenoAbierta(home,{pedidoTUS:false});
 assert.match(enabled,/href="\/prueba-v2\/pedido-cliente"/);
 assert.match(enabled,/Probar envío completo de PDF/);
 assert.match(enabled,/impresiones con pedido, pago Sandbox y seguimiento/);
 assert.doesNotMatch(enabled,/href="https:\/\/libreriasaber\.com\.ar\/cotizar"/);
 assert.match(disabled,/href="\/prueba-v2\/cotizar-cliente"/);
 assert.doesNotMatch(disabled,/href="\/prueba-v2\/pedido-cliente"/);
 assert.match(enabled,/data-demo-drawer/);
 assert.match(enabled,/\/prueba-v2\/diseno-sin-clave\/catalogo\.json/);
});
