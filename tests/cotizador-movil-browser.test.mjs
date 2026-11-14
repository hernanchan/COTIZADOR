import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs';
import {paginaCotizarLive} from '../integraciones/autocotizador/recepcion/pagina-cotizar-live.mjs';
import {prepararCotizadorArchivosLive} from '../integraciones/autocotizador/recepcion/pagina-archivos-live.mjs';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';

const gate='GO_COMERCIAL_CONFIRMADO';
const env={SABER_ENTORNO:'produccion',DOCS_LIVE_UI_GATE:gate,DOCS_MP_LIVE_GATE:gate,
 DOCS_LIVE_SESSION_GATE:gate,DOCS_LIVE_PRICING_GATE:gate,DOCS_LIVE_ORDER_GATE:gate,
 DOCS_LIVE_RECEPCION_GATE:gate};
const root='https://pedidos.libreriasaber.com.ar';
const url=root+'/cotizar?vista=movil';
const mobile=fs.readFileSync(new URL('../integraciones/autocotizador/recepcion/asistente-movil-live.txt',import.meta.url),'utf8');
const iframeMobile=prepararCotizadorArchivosLive(paginaCargaUnica(),{previewMovil:true});
const iframeDesktop=prepararCotizadorArchivosLive(paginaCargaUnica());
const pageMobile=await paginaCotizarLive(new Request(url),env,{authorized:true}).text();
const pageDesktop=await paginaCotizarLive(new Request(root+'/cotizar'),env,{authorized:true}).text();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let tests=0;
try{
 for(const [label,width,height] of [['retrato',390,844],['apaisado',853,393],['tableta',820,1180]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:label!=='tableta',hasTouch:label!=='tableta'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route(root+'/**',async route=>{
   const u=new URL(route.request().url());
   const p=u.pathname;
   let body=null,ct='text/html; charset=utf-8';
   if(p==='/cotizar')body=pageMobile;
   if(p==='/cotizar/archivos')body=iframeMobile;
   if(p==='/cotizar/movil.js'){body=mobile;ct='application/javascript';}
   if(p==='/cotizar/archivos.js'){body='';ct='application/javascript';}
   if(p==='/cotizar/flujo-live.js'){body='export function crearFlujoPresupuestoLive(){}';ct='application/javascript';}
   if(p==='/api/pedido/plazo'){body=JSON.stringify({ok:false});ct='application/json';}
   await route.fulfill({status:body===null?404:200,contentType:ct,body:body??'not found'});
  });
  await page.goto(url,{waitUntil:'load'});
  const frame=page.frameLocator('#pdf');
  await frame.locator('#asistenteMovil').waitFor({state:'visible',timeout:10000});
  const active=await frame.locator('body').evaluate(el=>({
   mobile:el.classList.contains('saber-mobile'),
   stage:el.dataset.mobileStage,
   wizard:!!document.querySelector('#asistenteMovil')&&getComputedStyle(document.querySelector('#asistenteMovil')).display!=='none',
   upload:getComputedStyle(document.querySelector('#zonaArchivos')).display,
   config:getComputedStyle(document.querySelector('#modoConfiguracion')).display
  }));
  assert.equal(active.mobile,true,label+': asistente no activado');
  assert.equal(active.stage,'1',label+': paso 1 ausente');
  assert.equal(active.wizard,true,label+': wizard invisible');
  assert.notEqual(active.upload,'none',label+': selector de PDF oculto');
  assert.equal(active.config,'none',label+': opciones anteriores visibles antes de tiempo');
  assert.equal(await page.locator('body').getAttribute('class'),'preview-movil mobile-wizard-ready');
  const initialPosition=await frame.locator('#accionesAsistenteMovil').evaluate(el=>({
    afterUpload:!!(document.getElementById('zonaArchivos').compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING),
    afterHeader:!!(document.getElementById('asistenteMovil').compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING),
    top:el.getBoundingClientRect().top, uploadBottom:document.getElementById('zonaArchivos').getBoundingClientRect().bottom,
    insideHeader:document.getElementById('asistenteMovil').contains(el)
  }));
  assert.equal(initialPosition.afterUpload,true,label+': continuar debe estar debajo de carga');
  assert.equal(initialPosition.afterHeader,true,label+': navegación no debe quedar arriba');
  assert.equal(initialPosition.insideHeader,false,label+': botones NO dentro de cabecera');
  assert.ok(initialPosition.top>=initialPosition.uploadBottom-2,label+': continuar se ve arriba de carga');
  // Tarjeta de prueba ya detectada: controles con la MISMA estructura del render real,
  // sin afirmar que leímos un PDF ni consultamos precios en este test de interfaz.
  await frame.locator('#lista').evaluate(el=>{
   el.innerHTML=[
    '<section class="grupo-pedido">',
      '<h3 class="titulo-grupo">Impresiones A4 · 1 archivo</h3>',
      '<section class="archivo"><div class="fila"><div class="fila-principal">',
       '<strong class="nombre">Apunte de ejemplo.pdf</strong>',
       '<div class="resumen-archivo">48 páginas · Impresión A4 · B/N · 1 copia</div>',
       '<div class="tamano-rapido"><button class="tamano-opcion seleccionada">A4</button></div>',
      '</div><span class="precio-archivo">Pendiente</span>',
      '<div class="acciones-archivo"><button aria-expanded="true">Cerrar detalles</button></div></div>',
      '<fieldset class="composicion-visible"><legend>Páginas por cara</legend>',
       '<div class="composicion-opciones"><label>1 página<input type="radio" checked></label>',
       '<label>2 páginas<input type="radio"></label></div></fieldset>',
      '<div class="panel-edicion"><p class="origen">Tamaño detectado: 21 × 29,7 cm · 48 páginas</p>',
       '<div class="controles">',
        '<label>Servicio<select><option>Impresiones / ploteos</option></select></label>',
        '<label>Tamaño de impresión<select><option value="a4" selected>A4</option></select></label>',
        '<label>Copias<input type="number" value="1"></label>',
        '<label>Impresión<select><option>B/N</option><option>Color</option></select></label>',
        '<label>Caras<select><option>Simple faz</option><option>Doble faz</option></select></label>',
        '<label>Anillado<select><option>Sin anillado</option><option>Por archivo</option></select></label>',
       '</div></div></section></section>'
   ].join('');
  });
  await frame.getByRole('button',{name:'Configurar mis archivos'}).click();
  assert.equal(await frame.locator('body').getAttribute('data-mobile-stage'),'2',label+': paso 2 inaccesible');
  assert.equal(await frame.locator('.panel-edicion label').filter({hasText:'Tamaño de impresión'}).isVisible(),true);
  assert.equal(await frame.locator('.panel-edicion .controles > label[data-mobile-part="3"]').first().isVisible(),false);
  await frame.getByRole('button',{name:'Elegir color y papel'}).click();
  assert.equal(await frame.locator('body').getAttribute('data-mobile-stage'),'3',label+': paso 3 inaccesible');
  assert.equal(await frame.locator('.panel-edicion .controles > label[data-mobile-part="3"]').first().isVisible(),true);
  assert.equal(await frame.locator('.panel-edicion label').filter({hasText:'Anillado'}).isVisible(),false);
  await frame.getByRole('button',{name:'Elegir caras'}).click();
  assert.equal(await frame.locator('body').getAttribute('data-mobile-stage'),'4',label+': paso 4 inaccesible');
  assert.equal(await frame.locator('.panel-edicion label').filter({hasText:'Caras'}).isVisible(),true);
  assert.equal(await frame.locator('.composicion-visible').isVisible(),true);
  const placement=await frame.locator('#accionesAsistenteMovil').evaluate(el=>{
    const list=document.getElementById('lista'),car= list.querySelector('.archivo');
    return {afterList:!!(list.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING),
      bottomOfOptions:car.getBoundingClientRect().bottom,
      topOfButtons:el.getBoundingClientRect().top,
      underHeader:!document.getElementById('asistenteMovil').contains(el)};
  });
  assert.equal(placement.afterList,true,label+': Siguiente debe estar debajo de las opciones');
  assert.equal(placement.underHeader,true,label+': no hacer scroll inverso');
  assert.ok(placement.topOfButtons>=placement.bottomOfOptions-2,
    label+': Siguiente aparece antes de simple/doble faz');
  await frame.getByRole('button',{name:'Copias y terminación'}).click();
  assert.equal(await frame.locator('body').getAttribute('data-mobile-stage'),'5',label+': paso 5 inaccesible');
  assert.equal(await frame.locator('.panel-edicion label').filter({hasText:'Copias'}).isVisible(),true);
  assert.equal(await frame.locator('.panel-edicion label').filter({hasText:'Anillado'}).isVisible(),true);
  await frame.getByRole('button',{name:'Revisar presupuesto'}).click();
  assert.equal(await frame.locator('body').getAttribute('data-mobile-stage'),'6',label+': paso 6 inaccesible');
  assert.equal(await frame.locator('.mobile-review-row').count(),1);
  const reviewPlacement=await frame.locator('#accionesAsistenteMovil').evaluate(el=>
    !!(document.getElementById('asistenteResumen').compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING));
  assert.equal(reviewPlacement,true,label+': Modificar opciones después del resumen');
  await page.frames()[1].evaluate(()=>window.parent.postMessage({
   type:'SABER_SMART_PRICE_STATE',estado:'listo',total:1500,sendable:true
  },location.origin));
  await page.waitForFunction(()=>document.getElementById('barra-precio')?.textContent.includes('1.500'));
  const bar=await page.locator('#barra-movil').evaluate(el=>({
   visible:getComputedStyle(el).display!=='none',
   disabled:document.getElementById('barra-continuar').disabled,
   amount:document.getElementById('barra-precio').textContent
  }));
  assert.equal(bar.visible,true,label+': precio no permanece visible');
  assert.equal(bar.disabled,true,label+': demo habilita pagos');
  assert.equal(errors.length,0,label+': errores JS: '+errors.join('|'));
  console.log('SABER_MOBILE_BROWSER_VISIBLE',label,width,height,active.stage,'→6',bar.amount,'CHECKOUT_BLOCKED');
  tests++;
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();
 await page.route(root+'/**',async route=>{
  const u=new URL(route.request().url()),p=u.pathname;
  const body=p==='/cotizar'?pageDesktop:p==='/cotizar/archivos'?iframeDesktop:
    p==='/cotizar/archivos.js'?'':p==='/cotizar/flujo-live.js'?'export function crearFlujoPresupuestoLive(){}':null;
  await route.fulfill({status:body===null?404:200,contentType:p.endsWith('.js')?'application/javascript':'text/html',body:body??'not found'});
 });
 await page.goto(root+'/cotizar',{waitUntil:'load'});
 assert.ok(!(await page.locator('body').getAttribute('class'))?.includes('preview-movil'));
 assert.equal(await page.frameLocator('#pdf').locator('#asistenteMovil').count(),0,'PC debe mantenerse intacta');
 console.log('SABER_DESKTOP_BROWSER_ORIGINAL_UI_UNTOUCHED');
 tests++;await context.close();
 console.log('SABER_BROWSER_VISUAL_TESTS_PASSED',tests);
}finally{await browser.close()}
