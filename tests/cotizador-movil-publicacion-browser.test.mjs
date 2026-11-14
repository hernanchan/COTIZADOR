import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {paginaCotizarLive} from '../integraciones/autocotizador/recepcion/pagina-cotizar-live.mjs';
import {prepararCotizadorArchivosLive} from '../integraciones/autocotizador/recepcion/pagina-archivos-live.mjs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';

const gate='GO_COMERCIAL_CONFIRMADO',root='https://pedidos.libreriasaber.com.ar';
const env={SABER_ENTORNO:'produccion',DOCS_LIVE_UI_GATE:gate,DOCS_MP_LIVE_GATE:gate,
 DOCS_LIVE_SESSION_GATE:gate,DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,
 DOCS_LIVE_ORDER_GATE:gate,DOCS_LIVE_TRANSFER_GATE:gate,DOCS_LIVE_TUS_GATE:gate};
const html=await paginaCotizarLive(new Request(root+'/cotizar'),env,{authorized:true}).text();
assert.match(html,/const enabled=true,bankEnabled=true,previewMode=false/);
const child=prepararCotizadorArchivosLive(paginaCargaUnica());
assert.match(child,/src="\/cotizar\/movil.js"/);
const js=fs.readFileSync(new URL('../integraciones/autocotizador/recepcion/asistente-movil-live.txt',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const [label,width,height] of [['comercial-mobile-vertical',390,844],['comercial-mobile-horizontal',853,393]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(root+'/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   let body=null,ctype='text/html';
   if(path==='/cotizar')body=html;
   if(path==='/cotizar/archivos')body=child;
   if(path==='/cotizar/movil.js'){body=js;ctype='application/javascript'}
   if(path==='/cotizar/archivos.js'){body='';ctype='application/javascript'}
   if(path==='/cotizar/flujo-live.js'){
    body='export function crearFlujoPresupuestoLive(){return {}}';ctype='application/javascript';
   }
   if(path==='/api/pedido/plazo'){body='{"ok":false}';ctype='application/json'}
   await route.fulfill({status:body===null?404:200,contentType:ctype,body:body??'not found'});
  });
  await page.goto(root+'/cotizar',{waitUntil:'load'});
  const frame=page.frameLocator('#pdf');
  await frame.locator('#asistenteMovil').waitFor({state:'visible',timeout:10000});
  assert.equal(await page.locator('body').getAttribute('class'),' mobile-wizard-ready'.trim(),
    label+': mobile-wizard-ready en ruta pública');
  assert.equal(await frame.locator('body').getAttribute('data-mobile-stage'),'1');
  // Tarjeta sintética para aislar la navegación de la cotización y no generar pedidos.
  await frame.locator('#lista').evaluate(el=>{
   el.innerHTML=[
    '<section class="grupo-pedido"><section class="archivo">',
    '<div class="fila"><div class="fila-principal">',
    '<strong class="nombre">Archivo.pdf</strong>',
    '<p class="resumen-archivo">48 páginas · A4</p>',
    '<div class="tamano-rapido"><button class="tamano-opcion seleccionada">A4</button></div>',
    '</div><div class="acciones-archivo"><button aria-expanded="true">Cerrar detalles</button></div></div>',
    '<fieldset class="composicion-visible"><legend>Páginas por cara</legend>',
    '<label><input type="radio" checked> 1 página</label></fieldset>',
    '<div class="panel-edicion"><div class="controles">',
    '<label>Servicio<select><option>Impresiones</option></select></label>',
    '<label>Tamaño de impresión<select><option value="a4">A4</option></select></label>',
    '<label>Impresión<select><option>Blanco y negro</option></select></label>',
    '<label>Caras<select><option>Simple faz</option><option>Doble faz</option></select></label>',
    '<label>Copias<input type="number" value="1"></label>',
    '<label>Anillado<select><option>Sin anillado</option></select></label>',
    '</div></div></section></section>'
   ].join('');
  });
  for(const button of ['Configurar mis archivos','Elegir color y papel','Elegir caras',
   'Copias y terminación','Revisar presupuesto'])await frame.getByRole('button',{name:button}).click();
  assert.equal(await frame.locator('body').getAttribute('data-mobile-stage'),'6');
  // Simular respuesta del motor comercial EXISTENTE, sin enviarla a producción.
  await frame.locator('body').evaluate(()=>{
   window.__receivedPreparation=false;
   window.addEventListener('message',event=>{
    if(event.origin===location.origin&&event.data?.type==='SABER_SMART_PREPARAR_ENVIO')
     window.__receivedPreparation=true;
   });
   window.parent.postMessage({type:'SABER_SMART_PRICE_STATE',estado:'listo',sendable:true,total:1600},location.origin);
  });
  await page.waitForFunction(()=>document.querySelector('#barra-continuar')?.disabled===false);
  const state=await page.locator('#barra-continuar').evaluate(el=>({
   visible:getComputedStyle(el).display!=='none',
   buttonEnabled:!el.disabled,
   total:document.querySelector('#barra-precio').textContent,
   documentStep:document.querySelector('#seccion-confirmacion').hidden
  }));
  assert.equal(state.visible,true,label+': botón de avance no visible');
  assert.equal(state.buttonEnabled,true,label+': botón de avance no habilitado');
  assert.match(state.total,/1\.600/);
  assert.equal(state.documentStep,true,label+': datos no pueden aparecer antes de preparación');
  await page.locator('#barra-continuar').click();
  await page.waitForFunction(()=>document.getElementById('siguiente')?.disabled);
  await frame.locator('body').waitFor({state:'visible'});
  await page.waitForTimeout(100);
  const got=await frame.locator('body').evaluate(()=>window.__receivedPreparation);
  assert.equal(got,true,label+': no se llamó al handoff existente');
  // Respuesta simulada de preparación del motor para verificar transición a datos.
  await frame.locator('body').evaluate(()=>
   window.parent.postMessage({type:'SABER_SMART_UNIVERSAL_PDF',files:[],archivos:[]},location.origin));
  await page.waitForFunction(()=>document.getElementById('seccion-confirmacion')?.hidden===false);
  assert.equal(await page.locator('#seccion-archivos').isVisible(),false,label+': paso de archivos debería ocultarse');
  assert.equal(await page.locator('#nombre').isVisible(),true,label+': falta pantalla de cliente');
  assert.equal(errors.length,0,label+': errores JS '+errors.join('|'));
  console.log('SABER_COMMERCIAL_MOBILE_CHECKOUT_HANDOFF_READY',label,'PRECIO',state.total,'DATOS_VISIBLES','NO_ORDER_CREATED');
  await context.close();
 }
 console.log('SABER_COMMERCIAL_MOBILE_BROWSER_FLOW_PASS');
}finally{await browser.close()}
