/** Navegador real contra el dominio publicado. No crear órdenes ni pagos. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin='https://libreriasaber.com.ar';
const buyer='https://pedidos.libreriasaber.com.ar/cotizar';
const browser=await chromium.launch({channel:'chrome',headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const width of [390,1366]){
  const context=await browser.newContext({viewport:{width,height:860}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const home=await page.goto(origin+'/?validacion_publica='+Date.now(),
   {waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(home.status(),200);
  assert.match(await page.title(),/Librería Saber/i);
  await page.locator('.product img').first().waitFor({timeout:20000});
  await page.locator('.product img').evaluateAll(img=>
   img.forEach(node=>{node.loading='eager'}));
  await page.waitForFunction(()=>{
   const elements=[...document.querySelectorAll('.product img')];
   return elements.length>=3&&elements.every(x=>x.complete&&x.naturalWidth>0);
  },null,{timeout:20000});
  const visiblePhotos=await page.locator('.product img').count();
  assert.ok(visiblePhotos>=3);
  const size=await page.evaluate(()=>({
   innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth
  }));
  assert.ok(size.scrollWidth<=size.innerWidth+4,'HORIZONTAL_OVERFLOW_'+width);
  assert.deepEqual(errors,[],'BROKEN_JS_'+width);
  console.log('V3_LIVE_PUBLIC_HOME_PHOTOS_AND_LAYOUT_OK_'+JSON.stringify({width,visiblePhotos}));
  await page.goto(origin+'/cotizar.html?verificacion_publica=1',
   {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForURL(url=>url.origin==='https://pedidos.libreriasaber.com.ar'&&
    url.pathname==='/cotizar',{timeout:25000});
  assert.equal(new URL(page.url()).origin,'https://pedidos.libreriasaber.com.ar');
  const title=await page.title();
  assert.match(title,/Cotiz|Saber/i);
  const content=await page.locator('body').textContent();
  assert.match(content,/Librería Saber|presupuesto|impresi/i);
  console.log('V3_LIVE_PUBLIC_QUOTE_REACHES_REAL_BUYER_OK_'+width);
  await context.close();
 }
 console.log('V3_LIVE_BROWSER_VERIFIED_NO_ORDER_NO_PAYMENT_NO_R2_STORAGE');
}finally{await browser.close()}
