/**
 * QA de navegador, SOLO interfaz privada: no toca API de pedido, checkout, TUS ni R2.
 * Usa un PDF efímero de 500 páginas A4 y 100 MiB con JPEG reales.
 * El contenido no sale del navegador; la única llamada comercial es presupuesto.
 */
import assert from 'node:assert/strict';
import {mkdtemp,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';

const MiB=1048576;
const base='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const pass=process.env.SABER_OPERATOR_PASSWORD;
assert.ok(pass,'Falta secreto de operador para QA');
const tmp=await mkdtemp(path.join(tmpdir(),'saber-qa-noenvio-'));
const watchdog=setTimeout(()=>{console.error('QA_WATCHDOG_NAVEGADOR_140S');process.exit(124)},140000);
watchdog.unref();
let browser;
try{
 console.log('QA_ETAPA_1_VERIFICAR_PDF_500P_100MiB_CON_JPEG');
 const filename=process.env.QA_PDF_INPUT;
 assert.ok(filename&&filename.endsWith('.pdf'),'Archivo QA no generado');
 const stats=await stat(filename);
 assert.equal(stats.size,100*MiB,'El fixture debe pesar exactamente 100 MiB');
 console.log('QA_ETAPA_3_PDF_100MIB_REAL_LISTO');
 const chrome=process.env.CHROME_PATH||'/usr/bin/google-chrome';
 console.log('QA_ETAPA_4_INICIAR_CHROME');
 browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({
  httpCredentials:{username:'operador',password:pass},
  viewport:{width:1320,height:850},
  acceptDownloads:false
 });
 const page=await context.newPage();
 page.on('pageerror',e=>console.error('QA_BROWSER_PAGEERROR='+String(e.message).slice(0,160)));
 page.on('crash',()=>console.error('QA_BROWSER_CRASH'));
 page.setDefaultTimeout(45000);
 const blocked=[];
 page.on('request',req=>{
  const url=req.url();
  if(req.method()!=='GET'&&req.method()!=='HEAD'){
   // Consultas y verificación anti-bots, sin carga de archivos ni cobro.
   const pathname=new URL(url).pathname;
   if(['/api/ensayo-carga-unica','/api/ensayo-materiales-rapido',
       '/prueba-v2/api/ensayo-tus-comprobar'].includes(pathname)||
      pathname.startsWith('/cdn-cgi/challenge-platform/'))return;
   blocked.push(req.method()+' '+pathname);
  }
 });
 console.log('QA_ETAPA_5_ABRIR_PORTAL');
 await page.goto(base+'/prueba-v2/',{waitUntil:'domcontentloaded',timeout:30000});
 console.log('QA_ETAPA_6_PORTAL_CARGADO');
 const iframe=page.frameLocator('#smart');
 await iframe.locator('input[name="modoImpresionLote"][value="individual"]').check();
 console.log('QA_ETAPA_7_SELECCIONAR_PDF');
 await iframe.locator('#archivos').setInputFiles(filename,{timeout:60000});
 console.log('QA_ETAPA_8_ARCHIVO_SELECCIONADO');
 // El archivo se analiza LOCALMENTE. No hacer clic en «Enviar mi pedido».
 console.log('QA_ETAPA_9_ESPERAR_METADATOS');
 await iframe.locator('#lista .archivo').first().waitFor({state:'visible',timeout:60000});
 console.log('QA_ETAPA_10_ESPERAR_PRECIO');
 try{
  await iframe.locator('#presupuesto').getByText(/TOTAL PRELIMINAR/i).waitFor({state:'attached',timeout:35000});
 }catch(error){
  const estado=await iframe.locator('#estado').innerText({timeout:5000}).catch(()=>'(estado no disponible)');
  const presupuesto=await iframe.locator('#presupuesto').innerText({timeout:5000}).catch(()=>'(presupuesto no disponible)');
  const ficha=await iframe.locator('#lista').innerText({timeout:5000}).catch(()=>'(ficha no disponible)');
  console.log('QA_FALLO_ESTADO='+estado.replace(/\\s+/g,' ').slice(0,280));
  console.log('QA_FALLO_PRESUPUESTO='+presupuesto.replace(/\\s+/g,' ').slice(0,400));
  console.log('QA_FALLO_FICHA='+ficha.replace(/\\s+/g,' ').slice(0,550));
  throw error;
 }
 console.log('QA_ETAPA_11_PRECIO_LISTO');
 const details=await iframe.locator('#lista .resumen-archivo').first().innerText();
 const quote=await iframe.locator('#presupuesto').innerText();
 console.log('BROWSER_QA_CLASSIFICATION='+details.replace(/\s+/g,' ').slice(0,190));
 console.log('BROWSER_QA_QUOTE='+quote.replace(/\s+/g,' ').slice(0,210));
 assert.match(details,/500 pág/);
 assert.match(details,/Impresión/i);
 assert.match(details,/A4/i);
 assert.doesNotMatch(details,/Ploteo|Plotter/i);
 assert.match(quote,/TOTAL PRELIMINAR/i);
 await page.evaluate(()=>{
  window.__qaHandoff=[];
  const iframe=document.querySelector('#smart');
  window.addEventListener('message',event=>{
   if(event.source!==iframe.contentWindow)return;
   if(event.data?.type==='SABER_SMART_UNIVERSAL_PDF')
    window.__qaHandoff.push({
      type:event.data.type,
      count:event.data.files?.length,
      bytes:event.data.files?.[0]?.size,
      pageCount:event.data.archivos?.[0]?.paginas?.length,
      quoted:event.data.totalOrientativo
    });
   if(event.data?.type==='SABER_SMART_HANDOFF_ERROR')
    window.__qaHandoff.push({type:event.data.type,message:String(event.data.message||'').slice(0,100)});
  });
  iframe.contentWindow.postMessage({type:'SABER_SMART_PREPARAR_ENVIO'},location.origin);
 });
 await page.waitForFunction(()=>window.__qaHandoff?.length>0,null,{timeout:12000});
 const [msg]=await page.evaluate(()=>window.__qaHandoff);
 console.log('BROWSER_QA_HANDOFF='+JSON.stringify(msg));
 assert.equal(msg.type,'SABER_SMART_UNIVERSAL_PDF');
 assert.equal(msg.count,1);
 assert.equal(msg.bytes,100*MiB);
 assert.equal(msg.pageCount,500);
 assert.ok(Number.isSafeInteger(msg.quoted)&&msg.quoted>0);
 assert.deepEqual(blocked,[],'Intento de llamada no autorizada: '+blocked.join(','));
 // UI móvil: misma vista, sin nueva carga ni mutaciones.
 await page.setViewportSize({width:390,height:844});
 await iframe.locator('#presupuesto').getByText(/TOTAL PRELIMINAR/i).waitFor({state:'attached'});
 const width=await iframe.locator('body').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
 console.log('BROWSER_QA_MOBILE_WIDTH='+JSON.stringify(width));
 assert.ok(width.scroll<=width.client+16,'Desborde horizontal en cotizador móvil');
 // No generar capturas de archivos locales de prueba ni gastar memoria extra.
 console.log('BROWSER_QA_OK_A4_500PAGES_100MIB_R2_UNIVERSAL_NO_UPLOAD_NO_PAYMENT');
}finally{
 if(browser)await browser.close().catch(()=>{});
 await rm(tmp,{recursive:true,force:true}).catch(()=>{});
}
