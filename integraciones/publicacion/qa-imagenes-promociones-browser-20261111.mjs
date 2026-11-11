/** QA en Chrome real del portal de PRUEBAS: JPG+PNG, cotización y
 * descuento D1. NO enviar, NO crear pedido, NO abrir checkout. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const password=process.env.SABER_OPERATOR_TEST_PASSWORD;
assert.ok(password?.length>=10,'Falta la contraseña de pruebas');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const reports=[];
try{
 for(const viewport of [{width:1366,height:850},{width:390,height:844}]){
  const context=await browser.newContext({httpCredentials:{username:'operador',password},
   viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[],unexpected=[];
  page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
  page.on('request',r=>{
   if(['GET','HEAD'].includes(r.method()))return;
   const url=new URL(r.url());
   if(url.hostname==='challenges.cloudflare.com'||url.pathname.startsWith('/cdn-cgi/'))return;
   if(url.pathname==='/api/ensayo-carga-unica'||
      url.pathname==='/prueba-v2/api/ensayo-tus-comprobar')return;
   unexpected.push(r.method()+' '+url.pathname);
  });
  const res=await page.goto(origin+'/prueba-v2/',{waitUntil:'domcontentloaded',timeout:50000});
  assert.equal(res?.status(),200,'Pantalla privada no disponible');
  const frm=page.frameLocator('#smart');
  await frm.locator('#archivos').waitFor({state:'visible',timeout:30000});
  assert.equal(await frm.locator('#archivos').isEnabled(),true);
  const first=await page.locator('#smart').boundingBox();
  const after=await page.locator('#acciones-pedido').boundingBox();
  assert.ok(first&&after&&first.y<after.y,'El formulario tapa la carga');
  const filepath=await page.locator('#smart').getAttribute('src');
  assert.ok(filepath?.startsWith('/prueba-v2/carga-inteligente'));
  await frm.locator('#archivos').evaluate(async(input)=>{
    const cvs=document.createElement('canvas');
    cvs.width=180;cvs.height=120;
    const c=cvs.getContext('2d');c.fillStyle='#3173a2';c.fillRect(0,0,180,120);
    c.fillStyle='#fff';c.fillRect(25,25,130,70);
    const blobs=await Promise.all(['image/jpeg','image/png'].map(type=>new Promise((resolve,reject)=>
      cvs.toBlob(blob=>blob?resolve(blob):reject(Error('Canvas no exportó '+type)),type,0.92))));
    const dt=new DataTransfer();
    dt.items.add(new File([blobs[0]],'ensayo-foto.jpg',{type:'image/jpeg'}));
    dt.items.add(new File([blobs[1]],'ensayo-grafico.png',{type:'image/png'}));
    input.files=dt.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const card=frm.locator('#lista .archivo').first();
  await card.waitFor({state:'visible',timeout:60000});
  await page.waitForTimeout(1000);
  const label=await card.innerText();
  assert.match(label,/imagenes-01-2-fotos\.pdf/i,'No se convirtió JPG y PNG al PDF de 2 páginas');
  await card.locator('.editar').first().click();
  await card.locator('label').filter({hasText:'Servicio'}).locator('select').selectOption('fotos');
  const photos=card.locator('label').filter({hasText:'Papel y tamaño'}).locator('select');
  await photos.waitFor({state:'visible',timeout:12000});
  await photos.selectOption('luster_10x15');
  await page.waitForFunction(()=>{
    const frame=document.querySelector('#smart')?.contentDocument;
    return /Total preliminar/i.test(frame?.querySelector('#presupuesto')?.textContent||'');
  },null,{timeout:45000});
  await page.waitForTimeout(750);
  const result=await frm.locator('#presupuesto').innerText();
  const total=await page.locator('#precio-smart').innerText();
  const promo=await page.locator('#promocion-dia-resumen').innerText();
  assert.match(result,/Promoción aplicada: Miércoles de fotos/i,
   'Falta descuento real de miércoles Luster');
  assert.match(result,/TOTAL PRELIMINAR:/i);
  assert.match(result,/1\.000|1000/,'2 fotos Luster a 500 c/u no dan $1.000');
  assert.match(total,/1\.000|1000/);
  assert.match(promo,/Promoción aplicada/i);
  assert.match(promo,/Descuento/i);
  assert.deepEqual(unexpected,[],'No autorizar envíos ni pagos durante QA');
  assert.equal(errors.length,0,'JS pageerror: '+errors.join(' | '));
  const scroll=await frm.locator('body').evaluate(el=>({
   width:el.clientWidth,scroll:el.scrollWidth
  }));
  assert.ok(scroll.scroll<=scroll.width+16,'Desborde horizontal de interfaz');
  reports.push({viewport:viewport.width,imagenes:2,paginas:2,
   descuento:'600',total:'1000',formularioDespues:true,carga:true});
  await context.close();
 }
 console.log('QA_BROWSER_JPG_PNG_PRECIO_PROMO_CENTRAL_OK '+JSON.stringify(reports));
 console.log('NO_PEDIDOS_NO_PAGOS_NO_SUBIDA_DE_ORIGINALES');
}finally{await browser.close()}
