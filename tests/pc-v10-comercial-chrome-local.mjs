import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';
import {prepararCotizadorArchivosLive} from '../integraciones/autocotizador/recepcion/pagina-archivos-live.mjs';
import {paginaCotizarLive} from '../integraciones/autocotizador/recepcion/pagina-cotizar-live.mjs';

const root=new URL('../integraciones/autocotizador/recepcion/',import.meta.url);
const read=n=>fs.readFileSync(new URL(n,root),'utf8');
const prefix='https://pedidos.libreriasaber.com.ar';
const gate='GO_COMERCIAL_CONFIRMADO';
const env={SABER_ENTORNO:'produccion',DOCS_LIVE_UI_GATE:gate,
 DOCS_MP_LIVE_GATE:gate,DOCS_LIVE_SESSION_GATE:gate,
 DOCS_LIVE_PRICING_GATE:gate,DOCS_LIVE_ORDER_GATE:gate,
 DOCS_LIVE_RECEPCION_GATE:gate,DOCS_LIVE_TRANSFER_GATE:gate,
 DOCS_LIVE_TUS_GATE:gate,DOCS_LIVE_PC_V10_PREVIEW_GATE:'PRIVATE_TEST_ONLY'};
const parentHtml=await paginaCotizarLive(new Request(prefix+'/cotizar?pc=v10'),env,{authorized:true}).text();
const iframeHtml=prepararCotizadorArchivosLive(paginaCargaUnica(),{previewPcV10:true});
const resources=new Map([
 ['/cotizar/archivos.js',{type:'text/javascript',content:read('carga-unica-cliente.txt')}],
 ['/cotizar/movil.js',{type:'text/javascript',content:read('asistente-movil-live.txt')}],
 ['/cotizar/flujo-live.js',{type:'text/javascript',content:read('flujo-presupuesto-live-cliente.txt')}],
 ['/cotizar/pc-v10.js',{type:'text/javascript',content:read('pc-v10-comercial.js.txt')}],
 ['/cotizar/pc-v10.css',{type:'text/css',content:read('pc-v10-comercial.css.txt')}]
]);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('JS: '+e.message.slice(0,240)));
page.on('console',e=>{if(e.type()==='error'||e.type()==='warning')errors.push(e.type()+': '+e.text().slice(0,240));});
let blocked=0;
await page.route('**/*',async route=>{
 const request=route.request(),u=new URL(request.url());
 // No permitir ninguna petición al dominio comercial: todo se simula en memoria.
 if(u.hostname!=='pedidos.libreriasaber.com.ar')return route.continue();
 blocked++;
 const headers={'cache-control':'no-store'};
 if(u.pathname==='/cotizar'){
  return route.fulfill({status:200,contentType:'text/html',body:parentHtml,headers});
 }
 if(u.pathname==='/cotizar/archivos'){
  return route.fulfill({status:200,contentType:'text/html',body:iframeHtml,headers});
 }
 const file=resources.get(u.pathname);
 if(file){
  return route.fulfill({status:200,contentType:file.type,body:file.content,headers});
 }
 if(u.pathname==='/api/pedido/live/materiales'){
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,materials:{a4:[],a3:[]}
  }),headers});
 }
 if(u.pathname==='/api/pedido/live/cotizar'){
  // No imitar importes comerciales: el objetivo es probar la navegación.
  return route.fulfill({status:503,contentType:'application/json',
   body:JSON.stringify({ok:false,error:'PRECIO_NO_SIMULADO_NO_COBRAR'}),headers});
 }
 return route.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"error":"ENSAYO_LOCAL"}',headers});
});
async function pdf(i){
 const doc=await PDFDocument.create();
 const pg=doc.addPage([473.67,841.89]);
 const font=await doc.embedFont(StandardFonts.Helvetica);
 pg.drawText('Prueba Saber PC comercial '+i,{x:38,y:800,font,size:15});
 return {name:'ensayo_pc_'+i+'.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())};
}
const buffers=await Promise.all([1,2,3,4,5].map(pdf));
const content=page.frameLocator('#pdf');
try{
 await page.goto(prefix+'/cotizar?pc=v10',{waitUntil:'domcontentloaded',timeout:30000});
 await content.locator('#archivos').setInputFiles([buffers[0]]);
 await page.waitForTimeout(1800);
 console.log('ESTADO_TRAS_CARGA_UNO '+JSON.stringify(await content.locator('#estado').innerText()));
 await content.locator('#pc-upload-summary').waitFor({state:'visible',timeout:30000});
 await content.locator('#pc-size-step').waitFor({state:'visible',timeout:30000});
 assert.equal(await content.locator('#modoConfiguracion').isVisible(),false);
 assert.equal(await content.locator('#pc-upload-summary').innerText().then(t=>t.includes('ensayo_pc_1.pdf')),true);
 const gap=await content.locator('#pc-size-step').evaluate(el=>
  el.getBoundingClientRect().top-document.getElementById('zonaArchivos').getBoundingClientRect().bottom);
 assert(gap<35,'Botones de 1 PDF demasiado separados: '+gap+'px');
 await content.locator('#pc-size-buttons [data-target-size=a4]').click();
 await content.locator('#pc-filebox').waitFor({state:'visible',timeout:30000});
 console.log('CHROME_COMERCIAL_UN_PDF_OK: botones '+Math.round(gap)+'px debajo de archivos, sin selección de lote');

 await page.reload({waitUntil:'domcontentloaded',timeout:30000});
 await content.locator('#archivos').setInputFiles(buffers);
 await content.locator('#pc-upload-summary').waitFor({state:'visible',timeout:30000});
 await content.locator('input[name=modoImpresionLote][value=comun]').check();
 await content.locator('#pc-size-step').waitFor({state:'visible',timeout:30000});
 await content.locator('#pc-size-buttons [data-target-size=a4]').click();
 await content.locator('#pc-batch').waitFor({state:'visible',timeout:30000});
 const button=await content.locator('#pc-batch-apply').innerText();
 assert(button.includes('5 archivos'),'No ofrece guardado de los cinco: '+button);
 assert.equal(await page.locator('#continuar').isDisabled(),true,'Preview habilitó confirmar pedido');
 assert.equal(await page.locator('#pc-v10-ensayo').isVisible(),true);
 console.log('CHROME_COMERCIAL_CINCO_PDF_OK: mismo analizador LIVE; tamaño común y guardado de 5');
 console.log('PREVIEW_SIN_PAGOS_OK: CTA comercial deshabilitado; peticiones comerciales interceptadas '+blocked);
 assert(errors.length===0,'Excepciones JS: '+errors.join(' | '));
 console.log('PC_V10_COMERCIAL_CHROME_LOCAL_APROBADO');
}catch(e){
 console.error('PC_V10_COMERCIAL_CHROME_LOCAL_FALLÓ: '+e.message);
 console.error('ERRORES_JS: '+JSON.stringify(errors));
 console.error('DOM: '+JSON.stringify(await content.locator('body').evaluate(el=>({
  classes:el.className,
  cards:el.querySelectorAll('#lista section.archivo').length,
  summary:el.querySelector('#pc-upload-summary')?.innerText.slice(0,180),
  step:el.querySelector('#pc-size-step')?.hidden,
  batch:el.querySelector('#pc-batch')?.hidden,
  general:el.innerText.slice(0,400),estado:el.querySelector('#estado')?.innerText,modo:el.querySelector('input[name=modoImpresionLote]:checked')?.value,input:el.querySelector('#archivos')?.files?.length,scripts:[...document.scripts].map(x=>x.src).filter(Boolean)
 })).catch(()=>({unavailable:true}))));
 throw e;
}finally{await browser.close();}
