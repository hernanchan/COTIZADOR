import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';
import {prepararCotizadorArchivosLive} from '../integraciones/autocotizador/recepcion/pagina-archivos-live.mjs';
import {paginaCotizarLive} from '../integraciones/autocotizador/recepcion/pagina-cotizar-live.mjs';

const PREVIEW='PRIVATE_TEST_ONLY', ON='GO_COMERCIAL_CONFIRMADO';
const env={
 SABER_ENTORNO:'produccion', DOCS_LIVE_UI_GATE:ON, DOCS_MP_LIVE_GATE:ON,
 DOCS_LIVE_SESSION_GATE:ON, DOCS_LIVE_PRICING_GATE:ON,
 DOCS_LIVE_RECEPCION_GATE:ON, DOCS_LIVE_ORDER_GATE:ON,
 DOCS_LIVE_TRANSFER_GATE:ON,DOCS_LIVE_TUS_GATE:ON
};
const pc=fs.readFileSync(new URL('../integraciones/autocotizador/recepcion/pc-v10-comercial.js.txt',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../integraciones/autocotizador/recepcion/pc-v10-comercial.css.txt',import.meta.url),'utf8');
const url='https://pedidos.libreriasaber.com.ar/cotizar';

test('la interfaz comercial predeterminada es identica con el gate cerrado',()=>{
 const base=paginaCargaUnica();
 const normal=prepararCotizadorArchivosLive(base);
 const defaultClosed=prepararCotizadorArchivosLive(base,{previewPcV10:false});
 assert.equal(normal,defaultClosed);
 assert.doesNotMatch(normal,/pc-v10\.(js|css)/);
 assert.match(normal,/\/cotizar\/archivos\.js/);
 assert.match(normal,/\/cotizar\/movil\.js/);
 assert.match(normal,/SABER_SMART_RESIZE/);
});

test('solo la vista PC opt-in carga recursos V10 sin reemplazar el motor de archivos',()=>{
 const preview=prepararCotizadorArchivosLive(paginaCargaUnica(),{previewPcV10:true});
 assert.match(preview,/href="\/cotizar\/pc-v10\.css\?pc=v10"/);
 assert.match(preview,/src="\/cotizar\/pc-v10\.js\?pc=v10"/);
 assert.match(preview,/src="\/cotizar\/archivos\.js"/);
 assert.match(preview,/src="\/cotizar\/movil\.js"/);
 assert.ok(preview.indexOf('src="/cotizar/archivos.js"')<preview.indexOf('src="/cotizar/pc-v10.js?pc=v10"'));
 assert.match(preview,/id="presupuesto"/);
 assert.match(preview,/id="prepararPedido"/);
});

test('la experiencia móvil nunca se sustituye por PC, ni forzando preview',()=>{
 const mobile=prepararCotizadorArchivosLive(paginaCargaUnica(),{previewMovil:true,previewPcV10:true});
 assert.doesNotMatch(mobile,/pc-v10\.(js|css)/);
 assert.match(mobile,/\/cotizar\/movil\.js/);
 assert.match(pc,/matchMedia\('\(min-width:900px\) and \(pointer:fine\)'\)/);
 assert.match(css,/@media\(min-width:900px\) and \(pointer:fine\)/);
});

test('la V10 muestra solo el presupuesto y el avance del contenedor comercial',()=>{
 assert.match(css,/body\.saber-pc-v3 #pc-sidebar\{display:none!important\}/);
 assert.match(css,/body\.saber-pc-v3 #pc-shell\{display:block!important\}/);
 assert.match(pc,/uploadZone\.append\(uploadSummary\)/);
 assert.match(pc,/modeControl\.hidden=isSingle/);
 assert.match(pc,/batchButton\.onclick=saveCommon/);
});

test('la pantalla comercial no ofrece preview si no está activada la compuerta',async()=>{
 const ordinary=await paginaCotizarLive(new Request(url+'?pc=v10'),env,{authorized:true}).text();
 assert.doesNotMatch(ordinary,/id="pc-v10-ensayo"/);
 assert.match(ordinary,/src="\/cotizar\/archivos"/);
 assert.doesNotMatch(ordinary,/\/cotizar\/archivos\?pc=v10/);
 assert.match(ordinary,/id="continuar"/);
});

test('preview opt-in conserva precios de motor comercial pero prohíbe avanzar a pedido',async()=>{
 const preview=await paginaCotizarLive(new Request(url+'?pc=v10'),{
  ...env,DOCS_LIVE_PC_V10_PREVIEW_GATE:PREVIEW
 },{authorized:true}).text();
 assert.match(preview,/id="pc-v10-ensayo"/);
 assert.match(preview,/src="\/cotizar\/archivos\?pc=v10"/);
 assert.match(preview,/<button[^>]*id="continuar" disabled>Recepción de pedidos temporalmente desactivada<\/button>/);
 assert.match(preview,/const enabled=false,/);
 assert.doesNotMatch(preview,/const enabled=true,/);
});

test('preview móvil y PC son excluyentes',async()=>{
 const html=await paginaCotizarLive(new Request(url+'?pc=v10&vista=movil'),{
  ...env,DOCS_LIVE_PC_V10_PREVIEW_GATE:PREVIEW
 },{authorized:true}).text();
 assert.doesNotMatch(html,/id="pc-v10-ensayo"/);
 assert.match(html,/src="\/cotizar\/archivos\?vista=movil"/);
 assert.doesNotMatch(html,/pc=v10/);
});

test('las nuevas rutas y compuertas quedan fuera de pagos y producción por omisión',()=>{
 const worker=fs.readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 assert.match(worker,/page==='\/cotizar\/pc-v10\.js'/);
 assert.match(worker,/page==='\/cotizar\/pc-v10\.css'/);
 assert.match(worker,/DOCS_LIVE_PC_V10_PREVIEW_GATE==='PRIVATE_TEST_ONLY'/);
 assert.match(worker,/if\(!previewPcV10\)return testResponse\(\{ok:false,error:'PC_V10_PREVIEW_CERRADA'\},404\)/);
 assert.match(worker,/autorizadoCompradorLive\(request,env\)/);
 assert.match(worker,/import pcV10LiveJs from '\.\/pc-v10-comercial\.js\.txt'/);
 assert.match(worker,/import pcV10LiveCss from '\.\/pc-v10-comercial\.css\.txt'/);
});
