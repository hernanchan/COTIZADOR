/** Prepublicación SOLO lectura web V3: CSV real, carrito e ingreso al cotizador LIVE.
 * Archivos locales de rama candidata. No despliega, crea pedidos, ni cobra.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import http from 'node:http';
import {once} from 'node:events';
const root=resolve(fileURLToPath(new URL('../../vidriera/',import.meta.url)));
const html=readFileSync(join(root,'index.html'),'utf8');
const offer=readFileSync(join(root,'ofertas.html'),'utf8');
const redirect=readFileSync(join(root,'cotizar.html'),'utf8');
const portal=JSON.parse(readFileSync(join(root,'portal-comercial.json'),'utf8'));
assert.equal(portal.schema,'saber-portal-comercial-v1');
// La rama y Pages main quedan en NO_GO. Ensayamos el contrato de lanzamiento
// en memoria: no modificar el portal real para probar su futura redirección.
assert.equal(portal.enabled,false);
assert.equal(portal.release,'NO_GO');
assert.equal(portal.buyerUrl,null);
const portalLive={schema:portal.schema,enabled:true,
 release:'GO_COMERCIAL_CONFIRMADO',buyerUrl:'https://pedidos.libreriasaber.com.ar/cotizar'};
assert.ok(html.includes('href="cotizar.html"'));
assert.match(redirect,/target\.hostname!=='pedidos\.libreriasaber\.com\.ar'/);
assert.match(redirect,/fetch\('portal-comercial\.json'/);
console.log('SABER_V3_CANDIDATE_PORTAL_POINTS_TO_LIVE_BUYER');

const csvUrl=(html.match(/const productsCsvUrl='([^']+)'/)||[])[1];
assert.ok(csvUrl?.startsWith('https://docs.google.com/spreadsheets/'),'No Google CSV');
const res=await fetch(csvUrl,{signal:AbortSignal.timeout(22000)});
assert.equal(res.status,200,'El CSV real no es legible');
const csv=await res.text();
assert.ok(csv.length>10&&csv.length<500000,'CSV sin contenido');
const cors=res.headers.get('access-control-allow-origin');
assert.ok(cors==='*'||cors==='https://libreriasaber.com.ar','CSV bloqueado por CORS');
console.log('SABER_CATALOG_SOURCE_HTTP_200_CORS_OK');

const server=http.createServer((req,resp)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const name=path==='/'?'index.html':path.slice(1);
 const allowed={'index.html':html,'cotizar.html':redirect,'ofertas.html':offer,
  'portal-comercial.json':JSON.stringify(portal)};
 if(!Object.hasOwn(allowed,name)){resp.writeHead(404).end();return}
 resp.writeHead(200,{'Content-Type':name.endsWith('.json')?'application/json':'text/html; charset=utf-8',
  'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}).end(allowed[name]);
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const local='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const width of [390,1366]){
  const context=await browser.newContext({viewport:{width,height:860}});
  const page=await context.newPage(),js=[];
  page.on('pageerror',e=>js.push(e.message));
  await page.route('https://docs.google.com/spreadsheets/**',route=>route.fulfill({
   status:200,contentType:'text/csv; charset=utf-8',
   headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'},body:csv
  }));
  const loaded=await page.goto(local+'/index.html',{waitUntil:'domcontentloaded',timeout:20000});
  assert.equal(loaded.status(),200);
  await page.locator('.product-actions .add').first().waitFor({state:'visible',timeout:18000});
  const photoBefore=await page.locator('.product img').count();
  assert.ok(photoBefore>0,'No hay ninguna foto de artículo del catálogo');
  await page.waitForFunction(()=>{
   const images=[...document.querySelectorAll('.product img')];
   return images.length>0&&images.every(img=>img.complete);
  },null,{timeout:15000}).catch(()=>{});
  const imageResults=await page.locator('.product img').evaluateAll(images=>
   images.map(img=>({ok:img.complete&&img.naturalWidth>0,
    width:img.naturalWidth,visible:getComputedStyle(img).visibility!=='hidden'})));
  const goodPhotos=imageResults.filter(img=>img.ok&&img.visible).length;
  console.log('SABER_V3_PRODUCT_PHOTOS='+JSON.stringify({width,goodPhotos,
   expected:photoBefore,results:imageResults}));
  assert.equal(goodPhotos,photoBefore,
   'Fotos de catálogo no visibles: no publicar V3 con fotografías ocultas');
  const before=await page.locator('#cartBadge').textContent();
  assert.equal(Number(before),0);
  await page.locator('.product-actions .add').first().click();
  const count=await page.locator('#cartBadge').textContent();
  assert.equal(Number(count),1,'Agregar no modifica el carrito');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('saberCartV1')||'[]'));
  assert.equal(stored.length,1);assert.equal(stored[0].qty,1);
  const horizontal=await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(horizontal.scroll<=horizontal.inner+4,'Desbordamiento horizontal '+width);
  assert.deepEqual(js,[],'JavaScript comercial inválido '+js.join('; '));
  console.log('SABER_V3_CATALOG_AND_CART_OK '+JSON.stringify({width,visibleCards:await page.locator('.product-actions .add').count(),photoTags:photoBefore,horizontal}));
  await context.close();
 }
 // Contrato de dominio real: simular origen de Pages sin ejecutar cobranza.
 const context=await browser.newContext();
 await context.route('https://libreriasaber.com.ar/**',r=>{
  const p=new URL(r.request().url()).pathname;
  const body=p==='/cotizar.html'?redirect:p==='/portal-comercial.json'?JSON.stringify(portalLive):'';
  r.fulfill({status:body?200:404,contentType:p.endsWith('.json')?'application/json':'text/html',
   headers:{'Access-Control-Allow-Origin':'*'},body});
 });
 await context.route('https://pedidos.libreriasaber.com.ar/cotizar',r=>r.fulfill({
  status:200,contentType:'text/html',body:'<!doctype html><title>Comprador LIVE simulado</title>'
 }));
 const page=await context.newPage();
 await page.goto('https://libreriasaber.com.ar/cotizar.html',{waitUntil:'domcontentloaded'});
 await page.waitForURL('https://pedidos.libreriasaber.com.ar/cotizar',{timeout:15000});
 console.log('SABER_V3_PUBLIC_DOMAIN_REDIRECTS_TO_LIVE_BUYER_OK_SIMULATED');
 await context.close();
 console.log('SABER_V3_CANDIDATE_LOCAL_QA_OK_NO_PUBLIC_DEPLOY_NO_PAYMENT');
}finally{await browser.close();await new Promise(r=>server.close(r))}
