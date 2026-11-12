/** Ensayo visual aislado: mismo HTML LIVE, navegador Chrome real, sin Cloudflare ni pagos. */
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {paginaCotizarLive} from '../autocotizador/recepcion/pagina-cotizar-live.mjs';
import {paginaCargaUnica} from '../autocotizador/recepcion/carga-unica-pagina.mjs';
import {prepararCotizadorArchivosLive} from '../autocotizador/recepcion/pagina-archivos-live.mjs';
const G='GO_COMERCIAL_CONFIRMADO';
const env={SABER_ENTORNO:'produccion',DOCS_LIVE_UI_GATE:G,DOCS_MP_LIVE_GATE:G,
 DOCS_LIVE_SESSION_GATE:G,DOCS_LIVE_RECEPCION_GATE:G,DOCS_LIVE_PRICING_GATE:G,
 DOCS_LIVE_ORDER_GATE:G};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  let type='text/html; charset=utf-8',body;
  if(pathname==='/cotizar'){
   const response=paginaCotizarLive(new Request('https://pedidos.libreriasaber.com.ar/cotizar'),env,{authorized:true});
   body=await response.text();
   // La prueba usa 127.0.0.1, pero conserva exactamente el HTML, CSS y scripts.
  }else if(pathname==='/cotizar/archivos'){
   body=prepararCotizadorArchivosLive(paginaCargaUnica());
  }else if(pathname==='/cotizar/flujo-live.js'){
   type='text/javascript; charset=utf-8';body='export function crearFlujoPresupuestoLive(){throw Error("PRUEBA_SIN_PAGOS")}';
  }else if(pathname==='/cotizar/archivos.js'){
   type='text/javascript; charset=utf-8';body='// Solo se ensaya disposición visual, sin enviar archivos ni cotizar.';
  }else if(pathname==='/api/pedido/plazo'){
   type='application/json';body=JSON.stringify({ok:true,guaranteed:false,label:'Hoy (orientativo)',
    notice:'Fecha sujeta a confirmación.',estimatedDeadlineDate:'2026-11-11',mode:'hoy'});
  }else{res.writeHead(404).end('Not found');return}
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(body);
 }catch(e){res.writeHead(500).end('Error '+e.message)}
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const width of [360,390,768,1366]){
  const context=await browser.newContext({viewport:{width,height:800},deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdnjs.cloudflare.com/**',r=>r.fulfill({
   status:200,contentType:'text/javascript',body:'window.pdfjsLib={};'
  }));
  const response=await page.goto(origin+'/cotizar',{waitUntil:'domcontentloaded',timeout:20000});
  assert.equal(response.status(),200);
  const child=page.frameLocator('#pdf');
  await child.locator('#archivos').waitFor({state:'visible'});
  await page.waitForTimeout(1200);
  console.log('MOBILE_DIAGNOSTICO_'+width+'='+JSON.stringify({
   errores:errors,
   padre:await page.evaluate(()=>({
    frame:document.getElementById('pdf')?.outerHTML.slice(0,350),
    altura:document.getElementById('pdf')?.getBoundingClientRect().height
   })),
   hijo:await child.locator('body').evaluate(el=>({
    alto:el.scrollHeight,documento:document.documentElement.scrollHeight,
    pathname:location.pathname,observador:typeof ResizeObserver
   }))
  }));
  await page.waitForFunction(()=>{
   const frame=document.getElementById('pdf');
   return frame&&frame.style.height&&parseInt(frame.style.height,10)>250;
  },{timeout:12000});
  const before=await page.locator('#pdf').boundingBox();
  await child.locator('#lista').evaluate(el=>{
   for(let n=0;n<6;n++){
    const card=document.createElement('article');
    card.className='archivo';
    card.style.cssText='min-height:260px;padding:15px;border:1px solid #ccdbe7;margin:8px 0';
    card.textContent='Archivo de prueba '+(n+1)+' · Elegí opciones de impresión';
    el.appendChild(card);
   }
  });
  await page.waitForFunction(previous=>{
   const frame=document.getElementById('pdf');
   return frame.getBoundingClientRect().height>previous+900;
  },before.height,{timeout:14000});
  const box=await page.locator('#pdf').boundingBox();
  const hiddenForm=await page.locator('#seccion-confirmacion').isHidden();
  assert.equal(hiddenForm,true,'Los datos personales deben estar en la segunda pantalla');
  assert.equal(await page.locator('#siguiente').isDisabled(),true,'No avanzar antes de cotizar');
  const childInfo=await child.locator('body').evaluate(el=>({
   scroll:document.documentElement.scrollHeight,
   width:document.documentElement.scrollWidth,
   viewport:innerWidth,
   duplicateTotal:getComputedStyle(document.querySelector('#presupuesto')).display,
   inputRight:document.querySelector('#archivos').getBoundingClientRect().right
  }));
  const horizontal=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(box.height>before.height+900,'No se ajustó la altura del iframe');
  await child.locator('body').evaluate(()=>{
    addEventListener('message',event=>{
      if(event.data?.type==='SABER_SMART_PREPARAR_ENVIO')
       window.parent.postMessage({type:'SABER_SMART_UNIVERSAL_PDF',files:[],archivos:[]},location.origin);
    });
    window.parent.postMessage({type:'SABER_SMART_PRICE_STATE',
      sendable:true,total:7524,estado:'listo'},location.origin);
  });
  await page.waitForFunction(()=>!document.querySelector('#siguiente').disabled,{timeout:5000});
  await page.locator('#siguiente').click();
  await page.waitForFunction(()=>!document.querySelector('#seccion-confirmacion').hidden,{timeout:5000});
  assert.equal(await page.locator('#seccion-archivos').isHidden(),true);
  assert.equal(await page.locator('#nombre').isVisible(),true);
  assert.equal(await page.locator('#continuar').isVisible(),true);
  await page.locator('#volver-archivos').click();
  assert.equal(await page.locator('#seccion-confirmacion').isHidden(),true);
  assert.equal(await child.locator('#archivos').isVisible(),true);
  assert.ok(horizontal.scroll<=horizontal.width+3,'Desborde horizontal en pantalla principal');
  assert.ok(childInfo.width<=childInfo.viewport+3,'Desborde horizontal dentro de iframe');
  assert.ok(childInfo.inputRight<=childInfo.viewport+3,'Selector fuera de pantalla');
  assert.equal(childInfo.duplicateTotal,'none','El presupuesto aparece duplicado');
  assert.deepEqual(errors,[],'Excepción de interfaz '+errors.join(' | '));
  console.log('SABER_MOBILE_LAYOUT_OK '+JSON.stringify({
    width,iframeAntes:Math.round(before.height),iframeDespues:Math.round(box.height),
    datosEnSegundaPantalla:true,frameBottom:Math.round(box.y+box.height),
    documentWidth:horizontal.scroll,childWidth:childInfo.width
  }));
  await context.close();
 }
 console.log('SABER_MOBILE_QA_NO_ORDERS_NO_PAYMENTS_NO_REAL_FILES');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
